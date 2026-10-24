-- Additive, server-only buyer storage; existing profiles, roles and sessions untouched.
CREATE TABLE buyer_profiles (
 user_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(user_id),
 company TEXT NOT NULL, country TEXT NOT NULL, region TEXT NOT NULL DEFAULT '',
 bio TEXT NOT NULL DEFAULT ''
);
CREATE TABLE buyer_saved_items (
 user_id TEXT NOT NULL REFERENCES profiles(user_id),
 item_id TEXT NOT NULL REFERENCES producer_items(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,item_id)
);
CREATE INDEX buyer_saved_items_item ON buyer_saved_items(item_id);
