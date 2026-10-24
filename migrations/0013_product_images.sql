-- Files stay in private object storage; D1 holds only immutable paths and references.
CREATE TABLE product_image_files (
 id TEXT PRIMARY KEY, product_id TEXT REFERENCES producer_items(id) ON DELETE SET NULL,
 owner_id TEXT NOT NULL REFERENCES profiles(user_id), object_path TEXT NOT NULL UNIQUE,
 thumb_path TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, bytes INTEGER NOT NULL,
 width INTEGER NOT NULL, height INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('uploading','ready','deleting')), created_at TEXT NOT NULL
);
CREATE INDEX product_image_owner ON product_image_files(owner_id,product_id,state);
CREATE TABLE product_image_sets (
 product_id TEXT PRIMARY KEY REFERENCES producer_items(id) ON DELETE CASCADE,
 image_ids TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(image_ids) AND json_type(image_ids)='array' AND json_array_length(image_ids)<=5),
 version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0)
);
CREATE TRIGGER product_image_reservation BEFORE INSERT ON product_image_files BEGIN
 SELECT RAISE(ABORT,'image owner mismatch') WHERE NOT EXISTS(SELECT 1 FROM producer_items p JOIN profiles a ON a.user_id=p.user_id WHERE p.id=NEW.product_id AND p.user_id=NEW.owner_id AND a.role='producer');
 SELECT RAISE(ABORT,'too many pending images') WHERE (SELECT COUNT(*) FROM product_image_files f WHERE f.owner_id=NEW.owner_id AND f.state IN ('uploading','ready') AND NOT EXISTS(SELECT 1 FROM product_image_sets s,json_each(s.image_ids) j WHERE j.value=f.id))>=10;
 SELECT RAISE(ABORT,'too many pending images') WHERE (SELECT COUNT(*) FROM product_image_files WHERE product_id=NEW.product_id AND state!='deleting')>=10;
END;
CREATE TRIGGER product_image_manifest BEFORE UPDATE OF image_ids ON product_image_sets BEGIN
 SELECT RAISE(ABORT,'invalid image version') WHERE NEW.product_id!=OLD.product_id OR NEW.version!=OLD.version+1;
 SELECT RAISE(ABORT,'invalid image references') WHERE EXISTS(SELECT 1 FROM json_each(NEW.image_ids) j WHERE j.type!='text' OR NOT EXISTS(SELECT 1 FROM product_image_files f JOIN producer_items p ON p.id=f.product_id WHERE f.id=j.value AND f.product_id=NEW.product_id AND f.owner_id=p.user_id AND f.state='ready')) OR (SELECT COUNT(*) FROM json_each(NEW.image_ids))!=(SELECT COUNT(DISTINCT value) FROM json_each(NEW.image_ids));
END;
CREATE TRIGGER product_image_manifest_changed AFTER UPDATE OF image_ids ON product_image_sets WHEN NEW.image_ids!=OLD.image_ids BEGIN
 UPDATE product_image_files SET state='deleting' WHERE product_id=NEW.product_id AND id IN (SELECT value FROM json_each(OLD.image_ids)) AND id NOT IN (SELECT value FROM json_each(NEW.image_ids));
 UPDATE registration_reviews SET revision=revision+1,state='pending',last_event_id=NULL,submitted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE kind='product' AND target_id=NEW.product_id;
END;
CREATE TRIGGER product_image_product_deleted BEFORE DELETE ON producer_items BEGIN
 UPDATE product_image_files SET state=CASE WHEN state='uploading' THEN 'uploading' ELSE 'deleting' END,product_id=NULL WHERE product_id=OLD.id;
 DELETE FROM product_image_sets WHERE product_id=OLD.id;
END;
CREATE TRIGGER product_image_set_initial BEFORE INSERT ON product_image_sets WHEN NEW.image_ids!='[]' OR NEW.version!=0 BEGIN SELECT RAISE(ABORT,'new image sets start empty'); END;
CREATE TRIGGER product_image_file_immutable BEFORE UPDATE ON product_image_files WHEN NEW.id!=OLD.id OR NEW.owner_id!=OLD.owner_id OR NEW.object_path!=OLD.object_path OR NEW.thumb_path!=OLD.thumb_path OR NEW.mime!=OLD.mime OR NEW.bytes!=OLD.bytes OR NEW.width!=OLD.width OR NEW.height!=OLD.height OR NEW.created_at!=OLD.created_at OR (NEW.product_id IS NOT OLD.product_id AND NEW.product_id IS NOT NULL) BEGIN SELECT RAISE(ABORT,'image identity is immutable'); END;
