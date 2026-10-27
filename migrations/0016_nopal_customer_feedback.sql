-- Private customer opinions, isolated from launch requests and existing business data.
CREATE TABLE nopal_feedback (
 id TEXT PRIMARY KEY NOT NULL,
 submission_hash TEXT UNIQUE NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('idea','opinion','question','other')),
 message TEXT NOT NULL CHECK(length(message) BETWEEN 10 AND 4000),
 reply_email TEXT,
 reply_consent INTEGER NOT NULL CHECK(reply_consent IN (0,1)),
 privacy_version TEXT NOT NULL CHECK(privacy_version='nopal-voice-v1'),
 language TEXT NOT NULL CHECK(language IN ('en','es')),
 created_at TEXT NOT NULL,
 CHECK((reply_email IS NULL AND reply_consent=0) OR (reply_email IS NOT NULL AND reply_consent=1))
);
CREATE INDEX nopal_feedback_recent ON nopal_feedback(created_at DESC,id);
CREATE TABLE nopal_feedback_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT UNIQUE NOT NULL,
 feedback_id TEXT NOT NULL REFERENCES nopal_feedback(id),
 actor_id TEXT REFERENCES auth_users(user_id),
 project_ref TEXT,
 action TEXT NOT NULL CHECK(action IN ('received','review')),
 before_state TEXT CHECK(before_state IN ('received','reviewing','resolved','archived')),
 after_state TEXT NOT NULL CHECK(after_state IN ('received','reviewing','resolved','archived')),
 expected_event_id TEXT,
 note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=2000),
 created_at TEXT NOT NULL
);
CREATE TRIGGER nopal_feedback_event_validate BEFORE INSERT ON nopal_feedback_events BEGIN
 SELECT RAISE(ABORT,'invalid feedback receipt') WHERE NEW.action='received' AND
 (NEW.actor_id IS NOT NULL OR NEW.project_ref IS NOT NULL OR NEW.before_state IS NOT NULL OR NEW.expected_event_id IS NOT NULL OR NEW.after_state!='received' OR NEW.note!='' OR EXISTS(SELECT 1 FROM nopal_feedback_events WHERE feedback_id=NEW.feedback_id));
 SELECT RAISE(ABORT,'feedback administrator access revoked') WHERE NEW.action='review' AND NOT EXISTS(
  SELECT 1 FROM admin_grants g JOIN admin_grant_events e ON e.id=g.last_event_id WHERE g.user_id=NEW.actor_id AND g.revoked_at IS NULL AND g.project_ref=NEW.project_ref AND e.project_ref=g.project_ref AND e.target_id=g.user_id AND e.action='grant');
 SELECT RAISE(ABORT,'feedback changed') WHERE NEW.action='review' AND
 (NEW.note='' OR NEW.expected_event_id IS NOT (SELECT id FROM nopal_feedback_events WHERE feedback_id=NEW.feedback_id ORDER BY sequence DESC LIMIT 1)
 OR NEW.before_state IS NOT (SELECT after_state FROM nopal_feedback_events WHERE feedback_id=NEW.feedback_id ORDER BY sequence DESC LIMIT 1));
END;
CREATE TRIGGER nopal_feedback_received AFTER INSERT ON nopal_feedback BEGIN
 INSERT INTO nopal_feedback_events(id,feedback_id,action,after_state,created_at) VALUES(NEW.id||':received',NEW.id,'received','received',NEW.created_at);
END;
CREATE TRIGGER nopal_feedback_no_update BEFORE UPDATE ON nopal_feedback BEGIN SELECT RAISE(ABORT,'feedback submissions are immutable'); END;
CREATE TRIGGER nopal_feedback_events_no_update BEFORE UPDATE ON nopal_feedback_events BEGIN SELECT RAISE(ABORT,'feedback history is append only'); END;
CREATE TRIGGER nopal_feedback_events_no_delete BEFORE DELETE ON nopal_feedback_events BEGIN SELECT RAISE(ABORT,'feedback history is append only'); END;
CREATE VIEW nopal_feedback_current AS SELECT f.*,e.after_state AS state,e.id AS last_event_id FROM nopal_feedback f JOIN nopal_feedback_events e ON e.feedback_id=f.id WHERE e.sequence=(SELECT MAX(sequence) FROM nopal_feedback_events WHERE feedback_id=f.id);
CREATE TABLE nopal_feedback_limits(id TEXT PRIMARY KEY NOT NULL,attempts INTEGER NOT NULL,expires INTEGER NOT NULL);
