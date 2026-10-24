-- Opt-in public snapshots. No backfill from private buyer profiles, saved items,
-- auth metadata, contacts, inquiries or contracts. Existing buyers remain private.
CREATE TABLE buyer_publications (
 user_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(user_id),
 public_id TEXT UNIQUE NOT NULL,
 company TEXT NOT NULL, country TEXT NOT NULL, region TEXT NOT NULL DEFAULT '',
 markets TEXT NOT NULL DEFAULT '', interests TEXT NOT NULL DEFAULT '',
 introduction TEXT NOT NULL DEFAULT '',
 published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
 consent_version TEXT NOT NULL DEFAULT '', consented_at TEXT,
 revoked_at TEXT, updated_at TEXT NOT NULL,
 CHECK(published=0 OR (consent_version='buyer-directory-v1' AND consented_at IS NOT NULL AND revoked_at IS NULL))
);
CREATE INDEX buyer_publications_visible ON buyer_publications(published,updated_at);
