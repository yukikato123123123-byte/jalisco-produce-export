-- Separate, scoped research permissions. No auth, grants or existing tables changed.
CREATE TABLE research_access (
 target TEXT PRIMARY KEY NOT NULL, bound_user_id TEXT,
 state TEXT NOT NULL CHECK(state IN ('allowed','revoked')),
 results INTEGER NOT NULL DEFAULT 0 CHECK(results IN (0,1)),
 granted_by TEXT NOT NULL, granted_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 last_event_id TEXT NOT NULL, project_ref TEXT NOT NULL
);
CREATE TABLE research_access_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL,
 target TEXT NOT NULL, actor_id TEXT NOT NULL, project_ref TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('research_grant','research_revoke')),
 results INTEGER NOT NULL CHECK(results IN (0,1)), expected_event_id TEXT,
 reason TEXT NOT NULL CHECK(length(reason)<=500), created_at TEXT NOT NULL
);
CREATE TRIGGER research_access_validate BEFORE INSERT ON research_access_events BEGIN
 SELECT RAISE(ABORT,'research administrator required') WHERE NOT EXISTS (
 SELECT 1 FROM admin_grants g JOIN admin_grant_events e ON e.id=g.last_event_id
 WHERE g.user_id=NEW.actor_id AND g.project_ref=NEW.project_ref AND g.revoked_at IS NULL
 AND e.target_id=g.user_id AND e.project_ref=g.project_ref AND e.action='grant');
 SELECT RAISE(ABORT,'research project mismatch') WHERE EXISTS(SELECT 1 FROM research_access WHERE target=NEW.target AND project_ref!=NEW.project_ref);
 SELECT RAISE(ABORT,'research access changed') WHERE NEW.expected_event_id IS NOT (SELECT last_event_id FROM research_access WHERE target=NEW.target);
END;
CREATE TRIGGER research_access_apply AFTER INSERT ON research_access_events BEGIN
 INSERT INTO research_access(target,state,results,granted_by,granted_at,updated_at,last_event_id,project_ref)
 VALUES(NEW.target,CASE WHEN NEW.action='research_grant' THEN 'allowed' ELSE 'revoked' END,NEW.results,NEW.actor_id,NEW.created_at,NEW.created_at,NEW.id,NEW.project_ref)
 ON CONFLICT(target) DO UPDATE SET state=excluded.state,results=excluded.results,
 granted_by=CASE WHEN NEW.action='research_grant' THEN NEW.actor_id ELSE research_access.granted_by END,
 granted_at=CASE WHEN NEW.action='research_grant' THEN NEW.created_at ELSE research_access.granted_at END,
 updated_at=NEW.created_at,last_event_id=NEW.id;
END;
CREATE TRIGGER research_access_events_no_update BEFORE UPDATE ON research_access_events BEGIN SELECT RAISE(ABORT,'research audit is append only'); END;
CREATE TRIGGER research_access_events_no_delete BEFORE DELETE ON research_access_events BEGIN SELECT RAISE(ABORT,'research audit is retained'); END;
CREATE TABLE research_responses (
 id TEXT PRIMARY KEY NOT NULL, user_id TEXT UNIQUE NOT NULL,
 project_ref TEXT NOT NULL,
 interest INTEGER NOT NULL CHECK(interest BETWEEN 1 AND 5),
 clarity INTEGER NOT NULL CHECK(clarity BETWEEN 1 AND 5),
 preference TEXT NOT NULL CHECK(preference IN ('powder','liquid','unsure')),
 comment TEXT NOT NULL CHECK(length(comment)<=500),
 language TEXT NOT NULL CHECK(language IN ('en','es')),
 consent_version TEXT NOT NULL CHECK(consent_version='nopahua-research-v1'),
 created_at TEXT NOT NULL
);
-- Recheck permission inside the insert, closing the read/revoke/write race.
CREATE TRIGGER research_response_permission BEFORE INSERT ON research_responses BEGIN
 SELECT RAISE(ABORT,'research access required') WHERE NOT EXISTS (
 SELECT 1 FROM research_access a WHERE a.project_ref=NEW.project_ref AND a.state='allowed'
 AND (a.target='user:'||NEW.user_id OR a.bound_user_id=NEW.user_id));
END;
CREATE TRIGGER research_response_no_update BEFORE UPDATE ON research_responses BEGIN SELECT RAISE(ABORT,'research response is immutable'); END;
CREATE TRIGGER research_response_no_delete BEFORE DELETE ON research_responses BEGIN SELECT RAISE(ABORT,'research response is retained'); END;
CREATE TRIGGER research_access_no_delete BEFORE DELETE ON research_access BEGIN SELECT RAISE(ABORT,'research permission is retained'); END;
CREATE TRIGGER research_projection_update BEFORE UPDATE ON research_access BEGIN
 SELECT RAISE(ABORT,'research projection requires audited event') WHERE NOT EXISTS (
 SELECT 1 FROM research_access_events e WHERE e.id=NEW.last_event_id AND e.target=NEW.target AND e.project_ref=NEW.project_ref
 AND NEW.state=CASE WHEN e.action='research_grant' THEN 'allowed' ELSE 'revoked' END AND NEW.results=e.results);
 SELECT RAISE(ABORT,'research identity binding is immutable') WHERE OLD.bound_user_id IS NOT NULL AND NEW.bound_user_id IS NOT OLD.bound_user_id;
END;
CREATE TRIGGER research_projection_insert BEFORE INSERT ON research_access BEGIN
 SELECT RAISE(ABORT,'research projection requires audited event') WHERE NOT EXISTS (
 SELECT 1 FROM research_access_events e WHERE e.id=NEW.last_event_id AND e.target=NEW.target AND e.project_ref=NEW.project_ref
 AND NEW.state=CASE WHEN e.action='research_grant' THEN 'allowed' ELSE 'revoked' END AND NEW.results=e.results);
END;
