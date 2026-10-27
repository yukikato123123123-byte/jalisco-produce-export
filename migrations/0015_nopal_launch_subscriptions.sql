-- Additive NOPAL launch requests only. No auth, business or grant table changes.
-- Addresses are unverified requests: no email has been delivered by this migration/API.
CREATE TABLE nopal_launch_subscriptions (
 id TEXT PRIMARY KEY NOT NULL,
 email TEXT UNIQUE NOT NULL CHECK(length(email) BETWEEN 3 AND 254 AND email=lower(trim(email))),
 language TEXT NOT NULL CHECK(language IN ('en','es')),
 consent_version TEXT NOT NULL CHECK(consent_version='nopal-launch-v1'),
 consented_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'requested' CHECK(status='requested'),
 email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified=0)
);
CREATE TABLE nopal_launch_events (
 id TEXT PRIMARY KEY NOT NULL,
 subscription_id TEXT NOT NULL REFERENCES nopal_launch_subscriptions(id),
 action TEXT NOT NULL CHECK(action='requested'),
 consent_version TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TRIGGER nopal_launch_requested AFTER INSERT ON nopal_launch_subscriptions BEGIN
 INSERT INTO nopal_launch_events(id,subscription_id,action,consent_version,created_at)
 VALUES(NEW.id||':requested',NEW.id,'requested',NEW.consent_version,NEW.consented_at);
END;
CREATE TRIGGER nopal_launch_events_no_update BEFORE UPDATE ON nopal_launch_events BEGIN
 SELECT RAISE(ABORT,'launch history is append only');
END;
CREATE TRIGGER nopal_launch_events_no_delete BEFORE DELETE ON nopal_launch_events BEGIN
 SELECT RAISE(ABORT,'launch history is append only');
END;
-- Separate from auth_limits: public intake cannot consume authentication limits.
CREATE TABLE nopal_launch_limits (id TEXT PRIMARY KEY NOT NULL,attempts INTEGER NOT NULL,expires INTEGER NOT NULL);
