-- Server-only grants. No signup, onboarding or HTTP API can insert into this table.
-- Bootstrap only after the owner approves a verified Supabase subject ID.
CREATE TABLE admin_grants (
 user_id TEXT PRIMARY KEY NOT NULL,
 granted_by TEXT NOT NULL, granted_at TEXT NOT NULL,
 revoked_at TEXT
);
CREATE TABLE admin_audit (
 id TEXT PRIMARY KEY NOT NULL, actor_id TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('product_status','buyer_unpublish')),
 target_id TEXT NOT NULL, before_state TEXT NOT NULL, after_state TEXT NOT NULL,
 reason TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX admin_audit_recent ON admin_audit(created_at DESC,id);
-- Validation, mutation and audit insertion share one atomic SQLite statement.
-- Recheck grant and expected state inside the write, including concurrent revocation.
CREATE TRIGGER admin_action BEFORE INSERT ON admin_audit BEGIN
 SELECT RAISE(ABORT,'admin grant required') WHERE NOT EXISTS(
 SELECT 1 FROM admin_grants WHERE user_id=NEW.actor_id AND revoked_at IS NULL);
 SELECT RAISE(ABORT,'product state changed') WHERE NEW.action='product_status' AND (
 NEW.after_state NOT IN ('draft','public','private') OR NOT EXISTS(
 SELECT 1 FROM producer_items WHERE id=NEW.target_id AND status=NEW.before_state));
 SELECT RAISE(ABORT,'buyer state changed') WHERE NEW.action='buyer_unpublish' AND (
 NEW.after_state!='0' OR NEW.before_state!='1' OR NOT EXISTS(
 SELECT 1 FROM buyer_publications WHERE public_id=NEW.target_id AND published=1));
 UPDATE producer_items SET status=NEW.after_state,updated_at=NEW.created_at
 WHERE NEW.action='product_status' AND id=NEW.target_id;
 UPDATE buyer_publications SET published=0,revoked_at=NEW.created_at,updated_at=NEW.created_at
 WHERE NEW.action='buyer_unpublish' AND public_id=NEW.target_id;
END;
CREATE TRIGGER admin_audit_no_update BEFORE UPDATE ON admin_audit BEGIN SELECT RAISE(ABORT,'audit is append only'); END;
CREATE TRIGGER admin_audit_no_delete BEFORE DELETE ON admin_audit BEGIN SELECT RAISE(ABORT,'audit is append only'); END;
