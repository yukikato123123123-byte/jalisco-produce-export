-- Additive only. No identity, approver key or administrator is provisioned here.
CREATE TABLE admin_grant_events (
 id TEXT PRIMARY KEY NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('grant','revoke')),
 target_id TEXT NOT NULL REFERENCES profiles(user_id),
 project_ref TEXT NOT NULL CHECK(length(project_ref) BETWEEN 1 AND 200),
 operator_id TEXT NOT NULL CHECK(length(operator_id)>0),
 approver_id TEXT NOT NULL CHECK(length(approver_id)>0),
 approval_ref TEXT NOT NULL CHECK(length(approval_ref)>0),
 approval_sha256 TEXT NOT NULL CHECK(length(approval_sha256)=64),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500),
 expected_event_id TEXT,
 created_at TEXT NOT NULL CHECK(length(created_at)>0)
);
ALTER TABLE admin_grants ADD COLUMN project_ref TEXT;
ALTER TABLE admin_grants ADD COLUMN last_event_id TEXT REFERENCES admin_grant_events(id);
ALTER TABLE admin_audit ADD COLUMN project_ref TEXT;
CREATE INDEX admin_grant_events_recent ON admin_grant_events(project_ref,created_at DESC,id);
CREATE TRIGGER admin_grant_event_validate BEFORE INSERT ON admin_grant_events BEGIN
 SELECT RAISE(ABORT,'event already exists') WHERE EXISTS(SELECT 1 FROM admin_grant_events WHERE id=NEW.id);
 SELECT RAISE(ABORT,'application account required') WHERE NOT EXISTS(SELECT 1 FROM profiles WHERE user_id=NEW.target_id) OR NOT EXISTS(SELECT 1 FROM auth_users WHERE user_id=NEW.target_id);
 SELECT RAISE(ABORT,'legacy grant requires review') WHERE EXISTS(SELECT 1 FROM admin_grants WHERE user_id=NEW.target_id AND (project_ref IS NULL OR last_event_id IS NULL));
 SELECT RAISE(ABORT,'project mismatch') WHERE EXISTS(SELECT 1 FROM admin_grants WHERE user_id=NEW.target_id AND project_ref!=NEW.project_ref);
 SELECT RAISE(ABORT,'grant state changed') WHERE NEW.expected_event_id IS NOT (SELECT last_event_id FROM admin_grants WHERE user_id=NEW.target_id);
 SELECT RAISE(ABORT,'already active') WHERE NEW.action='grant' AND EXISTS(SELECT 1 FROM admin_grants WHERE user_id=NEW.target_id AND revoked_at IS NULL);
 SELECT RAISE(ABORT,'not active') WHERE NEW.action='revoke' AND NOT EXISTS(SELECT 1 FROM admin_grants WHERE user_id=NEW.target_id AND revoked_at IS NULL);
END;
CREATE TRIGGER admin_grant_projection_insert BEFORE INSERT ON admin_grants BEGIN
 SELECT RAISE(ABORT,'audited grant event required') WHERE EXISTS(SELECT 1 FROM admin_grants WHERE user_id=NEW.user_id) OR NOT EXISTS(
 SELECT 1 FROM admin_grant_events e WHERE e.id=NEW.last_event_id AND e.target_id=NEW.user_id AND e.project_ref=NEW.project_ref AND e.action='grant' AND e.expected_event_id IS NULL AND NEW.revoked_at IS NULL AND NEW.granted_by=e.operator_id AND NEW.granted_at=e.created_at);
END;
CREATE TRIGGER admin_grant_projection_update BEFORE UPDATE ON admin_grants BEGIN
 SELECT RAISE(ABORT,'audited transition required') WHERE NEW.user_id!=OLD.user_id OR NEW.project_ref IS NOT OLD.project_ref OR NEW.last_event_id IS OLD.last_event_id OR NOT EXISTS(
 SELECT 1 FROM admin_grant_events e WHERE e.id=NEW.last_event_id AND e.target_id=OLD.user_id AND e.project_ref=OLD.project_ref AND e.expected_event_id IS OLD.last_event_id AND (
 (e.action='grant' AND OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL AND NEW.granted_by=e.operator_id AND NEW.granted_at=e.created_at) OR
 (e.action='revoke' AND OLD.revoked_at IS NULL AND NEW.revoked_at=e.created_at AND NEW.granted_by=OLD.granted_by AND NEW.granted_at=OLD.granted_at)));
END;
CREATE TRIGGER admin_grant_projection_no_delete BEFORE DELETE ON admin_grants BEGIN SELECT RAISE(ABORT,'use audited revoke'); END;
CREATE TRIGGER admin_grant_event_apply AFTER INSERT ON admin_grant_events BEGIN
 INSERT INTO admin_grants(user_id,granted_by,granted_at,revoked_at,project_ref,last_event_id)
 SELECT NEW.target_id,NEW.operator_id,NEW.created_at,NULL,NEW.project_ref,NEW.id WHERE NEW.action='grant' AND NOT EXISTS(SELECT 1 FROM admin_grants WHERE user_id=NEW.target_id);
 UPDATE admin_grants SET granted_by=NEW.operator_id,granted_at=NEW.created_at,revoked_at=NULL,last_event_id=NEW.id
 WHERE NEW.action='grant' AND user_id=NEW.target_id AND revoked_at IS NOT NULL;
 UPDATE admin_grants SET revoked_at=NEW.created_at,last_event_id=NEW.id WHERE NEW.action='revoke' AND user_id=NEW.target_id;
END;
CREATE TRIGGER admin_grant_event_no_update BEFORE UPDATE ON admin_grant_events BEGIN SELECT RAISE(ABORT,'grant audit is append only'); END;
CREATE TRIGGER admin_grant_event_no_delete BEFORE DELETE ON admin_grant_events BEGIN SELECT RAISE(ABORT,'grant audit is append only'); END;
DROP TRIGGER admin_action;
CREATE TRIGGER admin_action BEFORE INSERT ON admin_audit BEGIN
 SELECT RAISE(ABORT,'scoped admin grant required') WHERE NOT EXISTS(
 SELECT 1 FROM admin_grants g JOIN admin_grant_events e ON e.id=g.last_event_id
 WHERE g.user_id=NEW.actor_id AND g.revoked_at IS NULL AND g.project_ref=NEW.project_ref
 AND e.project_ref=g.project_ref AND e.target_id=g.user_id AND e.action='grant');
 SELECT RAISE(ABORT,'product state changed') WHERE NEW.action='product_status' AND (
 NEW.after_state NOT IN ('draft','public','private') OR NOT EXISTS(SELECT 1 FROM producer_items WHERE id=NEW.target_id AND status=NEW.before_state));
 SELECT RAISE(ABORT,'buyer state changed') WHERE NEW.action='buyer_unpublish' AND (
 NEW.after_state!='0' OR NEW.before_state!='1' OR NOT EXISTS(SELECT 1 FROM buyer_publications WHERE public_id=NEW.target_id AND published=1));
 UPDATE producer_items SET status=NEW.after_state,updated_at=NEW.created_at WHERE NEW.action='product_status' AND id=NEW.target_id;
 UPDATE buyer_publications SET published=0,revoked_at=NEW.created_at,updated_at=NEW.created_at WHERE NEW.action='buyer_unpublish' AND public_id=NEW.target_id;
END;
