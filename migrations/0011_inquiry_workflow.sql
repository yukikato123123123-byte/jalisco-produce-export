-- Additive: original submissions and receipt records remain immutable.
-- Rollback: redeploy prior Worker; retain this append-only table (no data loss).
CREATE TABLE inquiry_workflow (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT UNIQUE NOT NULL, inquiry_id TEXT NOT NULL REFERENCES inquiries(id),
 actor_id TEXT NOT NULL REFERENCES auth_users(user_id), project_ref TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('status','reply')),
 before_state TEXT NOT NULL, after_state TEXT NOT NULL CHECK(after_state IN ('received','reviewing','resolved')),
 message TEXT NOT NULL CHECK(length(message)<=5000),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500),
 language TEXT NOT NULL CHECK(language IN ('en','es')),
 email_status TEXT NOT NULL DEFAULT 'not_configured' CHECK(email_status='not_configured'),
 created_at TEXT NOT NULL,
 CHECK((action='reply' AND length(trim(message))>0 AND before_state=after_state) OR (action='status' AND message='' AND before_state!=after_state))
);
CREATE INDEX inquiry_workflow_recent ON inquiry_workflow(inquiry_id,sequence DESC);
CREATE TRIGGER inquiry_workflow_validate BEFORE INSERT ON inquiry_workflow BEGIN
 SELECT RAISE(ABORT,'scoped admin grant required') WHERE NOT EXISTS(
 SELECT 1 FROM admin_grants g JOIN admin_grant_events e ON e.id=g.last_event_id
 WHERE g.user_id=NEW.actor_id AND g.revoked_at IS NULL AND g.project_ref=NEW.project_ref
 AND e.project_ref=g.project_ref AND e.target_id=g.user_id AND e.action='grant');
 SELECT RAISE(ABORT,'inquiry state changed') WHERE NEW.before_state IS NOT COALESCE(
 (SELECT after_state FROM inquiry_workflow WHERE inquiry_id=NEW.inquiry_id ORDER BY sequence DESC LIMIT 1),
 (SELECT status FROM inquiries WHERE id=NEW.inquiry_id));
END;
CREATE TRIGGER inquiry_workflow_no_update BEFORE UPDATE ON inquiry_workflow BEGIN SELECT RAISE(ABORT,'inquiry workflow is append only'); END;
CREATE TRIGGER inquiry_workflow_no_delete BEFORE DELETE ON inquiry_workflow BEGIN SELECT RAISE(ABORT,'inquiry workflow is append only'); END;
