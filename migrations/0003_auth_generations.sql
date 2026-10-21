-- Old sessions intentionally fail closed: -1 cannot match a nonnegative generation.
ALTER TABLE sessions ADD COLUMN generation INTEGER NOT NULL DEFAULT -1 CHECK(generation >= -1);
ALTER TABLE sessions ADD COLUMN recovery_claimed INTEGER NOT NULL DEFAULT 0 CHECK(recovery_claimed IN (0, 1));
ALTER TABLE sessions ADD COLUMN claim_deadline INTEGER NOT NULL DEFAULT 0 CHECK(claim_deadline >= 0);
CREATE TABLE auth_clock (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  revision INTEGER NOT NULL CHECK(revision >= 0)
);
INSERT INTO auth_clock (id, revision) VALUES (1, 0);
CREATE TABLE auth_users (
  user_id TEXT PRIMARY KEY NOT NULL,
  generation INTEGER NOT NULL DEFAULT 0 CHECK(generation >= 0),
  reset_revision INTEGER NOT NULL DEFAULT 0 CHECK(reset_revision >= 0),
  reset_blocked INTEGER NOT NULL DEFAULT 0 CHECK(reset_blocked IN (0, 1)),
  reset_deadline INTEGER NOT NULL DEFAULT 0 CHECK(reset_deadline >= 0)
);
-- A recovery claim and its revocation fence commit in the SAME SQLite statement.
CREATE TRIGGER recovery_claim_fence AFTER UPDATE OF recovery_claimed ON sessions
WHEN OLD.recovery_claimed = 0 AND NEW.recovery_claimed = 1
BEGIN
  UPDATE auth_clock SET revision = revision + 1 WHERE id = 1;
  UPDATE auth_users SET generation = generation + 1, reset_blocked = 1,
    reset_revision = (SELECT revision FROM auth_clock WHERE id = 1),
    reset_deadline = NEW.claim_deadline
    WHERE user_id = NEW.user_id;
END;
-- Completing a definitive provider outcome fences authentication started DURING reset.
CREATE TRIGGER recovery_finish_fence AFTER UPDATE OF reset_blocked ON auth_users
WHEN OLD.reset_blocked = 1 AND NEW.reset_blocked = 0
BEGIN
  UPDATE auth_clock SET revision = revision + 1 WHERE id = 1;
  UPDATE auth_users SET generation = generation + 1, reset_deadline = 0,
    reset_revision = (SELECT revision FROM auth_clock WHERE id = 1)
    WHERE user_id = NEW.user_id;
END;
CREATE TRIGGER sessions_generation_guard BEFORE INSERT ON sessions
WHEN NOT EXISTS (SELECT 1 FROM auth_users WHERE user_id = NEW.user_id AND generation = NEW.generation)
BEGIN SELECT RAISE(ABORT, 'Stale authentication generation'); END;
