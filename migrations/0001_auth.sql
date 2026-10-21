CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY, full_name TEXT NOT NULL, company TEXT NOT NULL,
  country TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('producer','buyer'))
);
CREATE TRIGGER IF NOT EXISTS immutable_profile_role BEFORE UPDATE OF role ON profiles
BEGIN SELECT RAISE(ABORT, 'Account role is immutable'); END;
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token TEXT NOT NULL,
  expires INTEGER NOT NULL, purpose TEXT NOT NULL CHECK(purpose IN ('normal','recovery'))
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS auth_limits (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL);
