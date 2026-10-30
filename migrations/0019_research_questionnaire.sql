-- Additive questionnaire metadata; original response values and immutable triggers remain intact.
ALTER TABLE research_responses ADD COLUMN questionnaire_version TEXT NOT NULL DEFAULT 'legacy-v1'
 CHECK(questionnaire_version IN ('legacy-v1','concept-11-v1'));
ALTER TABLE research_responses ADD COLUMN answers_json TEXT
 CHECK((questionnaire_version='legacy-v1' AND answers_json IS NULL) OR
 COALESCE(questionnaire_version='concept-11-v1' AND answers_json IS NOT NULL AND json_valid(answers_json)
 AND json_type(answers_json)='object'
 AND json_extract(answers_json,'$.interest')=interest
 AND json_extract(answers_json,'$.clarity')=clarity
 AND json_extract(answers_json,'$.preference')=preference
 AND json_extract(answers_json,'$.comment')=comment,0));
