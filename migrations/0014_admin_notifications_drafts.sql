-- New completed registrations only: no historical notifications or approvals are invented.
-- This event, the profile and its pending review commit in one SQLite statement.
CREATE TABLE registration_notifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT UNIQUE NOT NULL REFERENCES auth_users(user_id),
 full_name TEXT NOT NULL CHECK(length(trim(full_name)) BETWEEN 1 AND 120),
 company TEXT NOT NULL CHECK(length(trim(company)) BETWEEN 1 AND 120),
 country TEXT NOT NULL CHECK(length(trim(country)) BETWEEN 1 AND 120),
 role TEXT NOT NULL CHECK(role IN ('producer','buyer')),
 email TEXT NOT NULL CHECK(length(email) BETWEEN 3 AND 254), created_at TEXT NOT NULL
);
CREATE TRIGGER registration_completed AFTER INSERT ON registration_notifications BEGIN
 INSERT INTO profiles(user_id,full_name,company,country,role) VALUES(NEW.user_id,NEW.full_name,NEW.company,NEW.country,NEW.role);
END;
CREATE TRIGGER registration_notifications_no_update BEFORE UPDATE ON registration_notifications BEGIN SELECT RAISE(ABORT,'registration event is immutable'); END;
CREATE TRIGGER registration_notifications_no_delete BEFORE DELETE ON registration_notifications BEGIN SELECT RAISE(ABORT,'registration event is retained'); END;
CREATE TABLE admin_notification_reads (
 notification_id INTEGER NOT NULL REFERENCES registration_notifications(id),
 admin_id TEXT NOT NULL, project_ref TEXT NOT NULL, read_at TEXT NOT NULL,
 PRIMARY KEY(notification_id,admin_id)
);
CREATE TRIGGER notification_read_grant BEFORE INSERT ON admin_notification_reads BEGIN
 SELECT RAISE(ABORT,'scoped admin grant required') WHERE NOT EXISTS(
 SELECT 1 FROM admin_grants g JOIN admin_grant_events e ON e.id=g.last_event_id
 WHERE g.user_id=NEW.admin_id AND g.revoked_at IS NULL AND g.project_ref=NEW.project_ref
 AND e.project_ref=g.project_ref AND e.target_id=g.user_id AND e.action='grant');
END;
CREATE TRIGGER notification_reads_no_update BEFORE UPDATE ON admin_notification_reads BEGIN SELECT RAISE(ABORT,'notification read is immutable'); END;
CREATE TRIGGER notification_reads_no_delete BEFORE DELETE ON admin_notification_reads BEGIN SELECT RAISE(ABORT,'notification read is retained'); END;
-- Draft actions are append-only and atomically validate authority, ownership and revision.
-- Existing publication, grant and review audits remain untouched.
CREATE TABLE admin_draft_events (
 id TEXT PRIMARY KEY NOT NULL, actor_id TEXT NOT NULL REFERENCES auth_users(user_id),
 project_ref TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('draft_keep','draft_delete')),
 target_id TEXT NOT NULL, target_name TEXT NOT NULL, expected_updated_at TEXT NOT NULL,
 expected_revision INTEGER NOT NULL, reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500),
 created_at TEXT NOT NULL
);
CREATE TRIGGER admin_draft_validate BEFORE INSERT ON admin_draft_events BEGIN
 SELECT RAISE(ABORT,'scoped admin grant required') WHERE NOT EXISTS(
 SELECT 1 FROM admin_grants g JOIN admin_grant_events e ON e.id=g.last_event_id
 WHERE g.user_id=NEW.actor_id AND g.revoked_at IS NULL AND g.project_ref=NEW.project_ref
 AND e.project_ref=g.project_ref AND e.target_id=g.user_id AND e.action='grant');
 SELECT RAISE(ABORT,'owned unapproved draft required') WHERE NOT EXISTS(
 SELECT 1 FROM producer_items i JOIN registration_reviews r ON r.kind='product' AND r.target_id=i.id
 WHERE i.id=NEW.target_id AND i.user_id=NEW.actor_id AND i.status='draft'
 AND i.updated_at=NEW.expected_updated_at AND r.revision=NEW.expected_revision AND r.state!='approved'
 AND NOT EXISTS(SELECT 1 FROM registration_review_events e WHERE e.kind='product' AND e.target_id=i.id AND e.after_state='approved')
 AND NOT EXISTS(SELECT 1 FROM buyer_saved_items s WHERE s.item_id=i.id));
END;
CREATE TRIGGER admin_draft_apply AFTER INSERT ON admin_draft_events WHEN NEW.action='draft_delete' BEGIN
 DELETE FROM producer_items WHERE id=NEW.target_id AND user_id=NEW.actor_id AND status='draft';
END;
CREATE TRIGGER admin_draft_no_update BEFORE UPDATE ON admin_draft_events BEGIN SELECT RAISE(ABORT,'draft audit is append only'); END;
CREATE TRIGGER admin_draft_no_delete BEFORE DELETE ON admin_draft_events BEGIN SELECT RAISE(ABORT,'draft audit is append only'); END;
CREATE INDEX admin_draft_recent ON admin_draft_events(created_at DESC,id);
