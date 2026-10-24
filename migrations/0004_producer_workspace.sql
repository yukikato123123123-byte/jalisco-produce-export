-- D1 is server-only: ownership is enforced in Worker queries, not Supabase RLS.
CREATE TABLE producer_profiles (
 user_id TEXT PRIMARY KEY REFERENCES profiles(user_id),
 company TEXT NOT NULL, country TEXT NOT NULL, region TEXT NOT NULL DEFAULT '',
 bio TEXT NOT NULL DEFAULT '', business_email TEXT NOT NULL DEFAULT '',
 business_phone TEXT NOT NULL DEFAULT '', public_contact INTEGER NOT NULL DEFAULT 0 CHECK(public_contact IN (0,1))
);
CREATE TABLE producer_items (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(user_id),
 name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
 quantity REAL NOT NULL CHECK(quantity >= 0), unit TEXT NOT NULL,
 price REAL CHECK(price >= 0), currency TEXT NOT NULL DEFAULT '',
 availability TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('draft','public','private')),
 updated_at TEXT NOT NULL
);
CREATE INDEX producer_items_owner ON producer_items(user_id);
CREATE INDEX producer_items_public ON producer_items(status, updated_at);
