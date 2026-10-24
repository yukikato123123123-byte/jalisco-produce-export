-- Local candidate only; no key, trust anchor or administrator is enrolled.
-- Batch this receipt with the unchanged 0008 audited grant/projection transition.
CREATE TABLE owner_command_receipts (
 id TEXT PRIMARY KEY NOT NULL,
 epoch INTEGER NOT NULL CHECK(epoch >= 1),
 command_sha256 TEXT NOT NULL CHECK(length(command_sha256)=64),
 approval_sha256 TEXT NOT NULL CHECK(length(approval_sha256)=64),
 outcome TEXT NOT NULL CHECK(outcome IN ('applied','cancelled'))
);
CREATE TRIGGER owner_command_receipts_no_update BEFORE UPDATE ON owner_command_receipts
BEGIN SELECT RAISE(ABORT,'owner receipt is immutable'); END;
CREATE TABLE owner_action_receipts (
 id TEXT PRIMARY KEY NOT NULL,
 request_sha256 TEXT NOT NULL CHECK(length(request_sha256)=64),
 outcome TEXT NOT NULL CHECK(outcome IN ('applied','cancelled'))
);
CREATE TRIGGER owner_action_receipts_no_update BEFORE UPDATE ON owner_action_receipts
BEGIN SELECT RAISE(ABORT,'owner action receipt is immutable'); END;
CREATE TRIGGER owner_action_receipts_no_delete BEFORE DELETE ON owner_action_receipts
BEGIN SELECT RAISE(ABORT,'owner action receipt is immutable'); END;
CREATE TRIGGER owner_command_receipts_no_delete BEFORE DELETE ON owner_command_receipts
BEGIN SELECT RAISE(ABORT,'owner receipt is immutable'); END;
