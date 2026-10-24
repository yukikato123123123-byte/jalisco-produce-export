-- Authenticated inquiry intake; no administrator or owner authority is provisioned.
CREATE TABLE inquiries (
 id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES auth_users(user_id),
 company TEXT NOT NULL CHECK(length(company) BETWEEN 2 AND 120),email TEXT NOT NULL CHECK(length(email) BETWEEN 3 AND 254),
 destination TEXT NOT NULL CHECK(length(destination) BETWEEN 1 AND 120),product TEXT NOT NULL CHECK(length(product) BETWEEN 1 AND 120),
 quantity_kg REAL NOT NULL CHECK(quantity_kg>=0.001),packaging TEXT NOT NULL CHECK(length(packaging)<=1000),
 terms TEXT NOT NULL CHECK(length(terms) BETWEEN 1 AND 120),questions TEXT NOT NULL CHECK(length(questions)<=2000),
 status TEXT NOT NULL DEFAULT 'received' CHECK(status='received'),created_at TEXT NOT NULL
);
CREATE INDEX inquiries_owner_recent ON inquiries(user_id,created_at DESC,id);
CREATE INDEX inquiries_recent ON inquiries(created_at DESC,id);
CREATE TABLE inquiry_events (id TEXT PRIMARY KEY NOT NULL,inquiry_id TEXT NOT NULL REFERENCES inquiries(id),actor_id TEXT NOT NULL REFERENCES auth_users(user_id),action TEXT NOT NULL CHECK(action='received'),created_at TEXT NOT NULL);
CREATE TRIGGER inquiry_received AFTER INSERT ON inquiries BEGIN
 INSERT INTO inquiry_events(id,inquiry_id,actor_id,action,created_at) VALUES(NEW.id||':received',NEW.id,NEW.user_id,'received',NEW.created_at);
END;
CREATE TRIGGER inquiries_no_update BEFORE UPDATE ON inquiries BEGIN SELECT RAISE(ABORT,'inquiry submissions are immutable'); END;
CREATE TRIGGER inquiries_no_delete BEFORE DELETE ON inquiries BEGIN SELECT RAISE(ABORT,'inquiry submissions are retained'); END;
CREATE TRIGGER inquiry_events_no_update BEFORE UPDATE ON inquiry_events BEGIN SELECT RAISE(ABORT,'inquiry history is append only'); END;
CREATE TRIGGER inquiry_events_no_delete BEFORE DELETE ON inquiry_events BEGIN SELECT RAISE(ABORT,'inquiry history is append only'); END;
