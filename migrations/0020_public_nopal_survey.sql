-- Public participation is separate from the original permission-bound immutable responses.
-- No legacy data, grant, audit or trigger is altered.
CREATE TABLE public_research_responses (
 id TEXT PRIMARY KEY NOT NULL,
 submission_hash TEXT UNIQUE NOT NULL,
 project_ref TEXT NOT NULL,
 questionnaire_version TEXT NOT NULL CHECK(questionnaire_version='concept-11-v1'),
 answers_json TEXT NOT NULL CHECK(json_valid(answers_json) AND json_type(answers_json)='object'),
 language TEXT NOT NULL CHECK(language IN ('en','es')),
 consent_version TEXT NOT NULL CHECK(consent_version='nopahua-research-v1'),
 is_test INTEGER NOT NULL DEFAULT 0 CHECK(is_test IN (0,1)),
 created_at TEXT NOT NULL
);
CREATE INDEX public_research_project_date ON public_research_responses(project_ref,is_test,created_at);
CREATE TRIGGER public_research_no_update BEFORE UPDATE ON public_research_responses BEGIN SELECT RAISE(ABORT,'research response is immutable'); END;
CREATE TRIGGER public_research_no_delete BEFORE DELETE ON public_research_responses BEGIN SELECT RAISE(ABORT,'research response is retained'); END;
