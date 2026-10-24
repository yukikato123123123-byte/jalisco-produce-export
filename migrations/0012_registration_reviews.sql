-- Review is separate from owner/admin authority and publication consent.
-- Existing registrations start pending; no historical approval is fabricated.
CREATE TABLE registration_reviews (
 kind TEXT NOT NULL CHECK(kind IN ('producer','product','buyer')), target_id TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected')),
 last_event_id TEXT, submitted_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(kind,target_id)
);
CREATE TABLE registration_review_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL,
 kind TEXT NOT NULL, target_id TEXT NOT NULL, revision INTEGER NOT NULL,
 actor_id TEXT NOT NULL REFERENCES auth_users(user_id), project_ref TEXT NOT NULL,
 before_state TEXT NOT NULL, after_state TEXT NOT NULL CHECK(after_state IN ('approved','rejected')),
 expected_event_id TEXT, reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500), created_at TEXT NOT NULL,
 FOREIGN KEY(kind,target_id) REFERENCES registration_reviews(kind,target_id),
 CHECK(before_state IN ('pending','approved','rejected') AND before_state!=after_state)
);
CREATE INDEX registration_review_pending ON registration_reviews(kind,state,submitted_at);
CREATE INDEX registration_review_history ON registration_review_events(kind,target_id,sequence DESC);
INSERT INTO registration_reviews(kind,target_id,submitted_at,updated_at)
 SELECT role,user_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM profiles;
INSERT INTO registration_reviews(kind,target_id,submitted_at,updated_at)
 SELECT 'product',id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM producer_items;
CREATE TRIGGER registration_review_validate BEFORE INSERT ON registration_review_events BEGIN
 SELECT RAISE(ABORT,'scoped admin grant required') WHERE NOT EXISTS(
 SELECT 1 FROM admin_grants g JOIN admin_grant_events e ON e.id=g.last_event_id
 WHERE g.user_id=NEW.actor_id AND g.revoked_at IS NULL AND g.project_ref=NEW.project_ref
 AND e.project_ref=g.project_ref AND e.target_id=g.user_id AND e.action='grant');
 SELECT RAISE(ABORT,'review revision changed') WHERE NOT EXISTS(
 SELECT 1 FROM registration_reviews r WHERE r.kind=NEW.kind AND r.target_id=NEW.target_id
 AND r.revision=NEW.revision AND r.state=NEW.before_state AND r.last_event_id IS NEW.expected_event_id);
 SELECT RAISE(ABORT,'registration not found') WHERE
 (NEW.kind IN ('producer','buyer') AND NOT EXISTS(SELECT 1 FROM profiles WHERE user_id=NEW.target_id AND role=NEW.kind)) OR
 (NEW.kind='product' AND NOT EXISTS(SELECT 1 FROM producer_items i JOIN profiles p ON p.user_id=i.user_id WHERE i.id=NEW.target_id AND p.role='producer'));
 SELECT RAISE(ABORT,'approve producer first') WHERE NEW.kind='product' AND NEW.after_state='approved' AND NOT EXISTS(
 SELECT 1 FROM producer_items i JOIN registration_reviews r ON r.target_id=i.user_id AND r.kind='producer' AND r.state='approved' WHERE i.id=NEW.target_id);
END;
CREATE TRIGGER registration_review_apply AFTER INSERT ON registration_review_events BEGIN
 UPDATE registration_reviews SET state=NEW.after_state,last_event_id=NEW.id,updated_at=NEW.created_at WHERE kind=NEW.kind AND target_id=NEW.target_id;
END;
CREATE TRIGGER registration_review_events_no_update BEFORE UPDATE ON registration_review_events BEGIN SELECT RAISE(ABORT,'review audit is append only'); END;
CREATE TRIGGER registration_review_events_no_delete BEFORE DELETE ON registration_review_events BEGIN SELECT RAISE(ABORT,'review audit is append only'); END;
CREATE TRIGGER registration_reviews_no_delete BEFORE DELETE ON registration_reviews BEGIN SELECT RAISE(ABORT,'review records are retained'); END;
CREATE VIEW approved_public_items AS SELECT i.* FROM producer_items i
 JOIN registration_reviews product ON product.kind='product' AND product.target_id=i.id AND product.state='approved'
 JOIN registration_reviews producer ON producer.kind='producer' AND producer.target_id=i.user_id AND producer.state='approved'
 JOIN profiles p ON p.user_id=i.user_id AND p.role='producer';
CREATE TRIGGER profiles_review_insert AFTER INSERT ON profiles BEGIN INSERT INTO registration_reviews(kind,target_id,submitted_at,updated_at) VALUES(NEW.role,NEW.user_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(kind,target_id) DO UPDATE SET revision=revision+1,state='pending',last_event_id=NULL,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at; END;
CREATE TRIGGER profiles_review_update AFTER UPDATE OF full_name,company,country ON profiles WHEN NEW.full_name IS NOT OLD.full_name OR NEW.company IS NOT OLD.company OR NEW.country IS NOT OLD.country BEGIN INSERT INTO registration_reviews(kind,target_id,submitted_at,updated_at) VALUES(NEW.role,NEW.user_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(kind,target_id) DO UPDATE SET revision=revision+1,state='pending',last_event_id=NULL,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at; END;
CREATE TRIGGER producer_profiles_review_insert AFTER INSERT ON producer_profiles BEGIN INSERT INTO registration_reviews(kind,target_id,submitted_at,updated_at) VALUES('producer',NEW.user_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(kind,target_id) DO UPDATE SET revision=revision+1,state='pending',last_event_id=NULL,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at; END;
CREATE TRIGGER producer_profiles_review_update AFTER UPDATE OF company,country,region,bio,business_email,business_phone,public_contact ON producer_profiles WHEN NEW.company IS NOT OLD.company OR NEW.country IS NOT OLD.country OR NEW.region IS NOT OLD.region OR NEW.bio IS NOT OLD.bio OR NEW.business_email IS NOT OLD.business_email OR NEW.business_phone IS NOT OLD.business_phone OR NEW.public_contact IS NOT OLD.public_contact BEGIN INSERT INTO registration_reviews(kind,target_id,submitted_at,updated_at) VALUES('producer',NEW.user_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(kind,target_id) DO UPDATE SET revision=revision+1,state='pending',last_event_id=NULL,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at; END;
CREATE TRIGGER buyer_profiles_review_insert AFTER INSERT ON buyer_profiles BEGIN INSERT INTO registration_reviews(kind,target_id,submitted_at,updated_at) VALUES('buyer',NEW.user_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(kind,target_id) DO UPDATE SET revision=revision+1,state='pending',last_event_id=NULL,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at; END;
CREATE TRIGGER buyer_profiles_review_update AFTER UPDATE OF company,country,region,bio ON buyer_profiles WHEN NEW.company IS NOT OLD.company OR NEW.country IS NOT OLD.country OR NEW.region IS NOT OLD.region OR NEW.bio IS NOT OLD.bio BEGIN INSERT INTO registration_reviews(kind,target_id,submitted_at,updated_at) VALUES('buyer',NEW.user_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(kind,target_id) DO UPDATE SET revision=revision+1,state='pending',last_event_id=NULL,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at; END;
CREATE TRIGGER buyer_publications_review_insert AFTER INSERT ON buyer_publications BEGIN INSERT INTO registration_reviews(kind,target_id,submitted_at,updated_at) VALUES('buyer',NEW.user_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(kind,target_id) DO UPDATE SET revision=revision+1,state='pending',last_event_id=NULL,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at; END;
CREATE TRIGGER buyer_publications_review_update AFTER UPDATE OF company,country,region,markets,interests,introduction ON buyer_publications WHEN NEW.company IS NOT OLD.company OR NEW.country IS NOT OLD.country OR NEW.region IS NOT OLD.region OR NEW.markets IS NOT OLD.markets OR NEW.interests IS NOT OLD.interests OR NEW.introduction IS NOT OLD.introduction BEGIN INSERT INTO registration_reviews(kind,target_id,submitted_at,updated_at) VALUES('buyer',NEW.user_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(kind,target_id) DO UPDATE SET revision=revision+1,state='pending',last_event_id=NULL,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at; END;
CREATE TRIGGER producer_items_review_insert AFTER INSERT ON producer_items BEGIN INSERT INTO registration_reviews(kind,target_id,submitted_at,updated_at) VALUES('product',NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(kind,target_id) DO UPDATE SET revision=revision+1,state='pending',last_event_id=NULL,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at; END;
CREATE TRIGGER producer_items_review_update AFTER UPDATE OF user_id,name,description,category,quantity,unit,price,currency,availability ON producer_items WHEN NEW.user_id IS NOT OLD.user_id OR NEW.name IS NOT OLD.name OR NEW.description IS NOT OLD.description OR NEW.category IS NOT OLD.category OR NEW.quantity IS NOT OLD.quantity OR NEW.unit IS NOT OLD.unit OR NEW.price IS NOT OLD.price OR NEW.currency IS NOT OLD.currency OR NEW.availability IS NOT OLD.availability BEGIN INSERT INTO registration_reviews(kind,target_id,submitted_at,updated_at) VALUES('product',NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(kind,target_id) DO UPDATE SET revision=revision+1,state='pending',last_event_id=NULL,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at; END;
CREATE TRIGGER registration_reviews_initial BEFORE INSERT ON registration_reviews
 WHEN NEW.state!='pending' OR NEW.revision!=1 OR NEW.last_event_id IS NOT NULL
 BEGIN SELECT RAISE(ABORT,'new reviews start pending'); END;
CREATE TRIGGER registration_reviews_projection BEFORE UPDATE ON registration_reviews BEGIN
 SELECT RAISE(ABORT,'audited review transition required') WHERE NEW.kind!=OLD.kind OR NEW.target_id!=OLD.target_id OR NOT (
 (NEW.revision=OLD.revision+1 AND NEW.state='pending' AND NEW.last_event_id IS NULL) OR
 (NEW.revision=OLD.revision AND NEW.submitted_at=OLD.submitted_at AND NEW.last_event_id IS NOT OLD.last_event_id AND EXISTS(
 SELECT 1 FROM registration_review_events e WHERE e.id=NEW.last_event_id AND e.kind=OLD.kind AND e.target_id=OLD.target_id
 AND e.revision=OLD.revision AND e.before_state=OLD.state AND e.expected_event_id IS OLD.last_event_id AND e.after_state=NEW.state AND e.created_at=NEW.updated_at)));
END;
