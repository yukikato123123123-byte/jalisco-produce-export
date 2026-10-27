-- Research intent only. This does not create accounts, grants or research permission.
CREATE TABLE research_applicants (
 user_id TEXT PRIMARY KEY NOT NULL,
 project_ref TEXT NOT NULL,
 email TEXT NOT NULL,
 auth_created_at TEXT,
 email_confirmed_at TEXT,
 requested_at TEXT NOT NULL,
 source TEXT NOT NULL CHECK(source IN ('signup','self','administrator')),
 recorded_by TEXT NOT NULL,
 UNIQUE(project_ref,email)
);
CREATE INDEX research_applicants_requested ON research_applicants(project_ref,requested_at DESC,user_id);
CREATE TRIGGER research_applicants_no_delete BEFORE DELETE ON research_applicants BEGIN
 SELECT RAISE(ABORT,'research applicant is retained');
END;
