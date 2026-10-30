# Nopal public questionnaire and private administrator results

`/research/nopahua` is public. Its title is **Nopal**; the eleven existing questions, option IDs, optional reflections, EN/ES translations, reference image, progress, previous navigation, review/edit and explicit consent remain. Draft answers remain in memory when changing language or navigating questions. A successful screen requires a confirmed server save or a database-backed submitted state on reload.

## Storage and compatibility

`shared/researchSurvey.ts` is the shared eleven-question contract (`concept-11-v1`). The existing additive migration 0019 and permission-bound `research_responses` are preserved. Historical records remain unchanged and contribute only answers actually asked. The pre-existing legacy convention (comment beginning `STAGING VERIFICATION` and explicitly containing `synthetic`) is projected as verification-only, without rewriting its row. Existing administrator grants, sessions, research-access audit events and immutable-response triggers are unchanged.

Migration **0020_public_nopal_survey.sql** adds `public_research_responses` with complete normalized answer JSON, language, consent version, project, timestamp, unique hashed submission identity and an explicit verification flag. Its update/delete triggers retain responses. Public participation is separate so it does not bypass or weaken the original permission-bound response insert trigger. No existing response is updated, deleted or populated with invented answers.

## Public API

GET `/api/public/nopal-survey` issues an opaque HttpOnly, SameSite=Strict cookie and a durable expiring submission challenge; it returns only this browser's submitted boolean. POST to the same endpoint validates all eleven answers, EN/ES, consent, origin/content type, an 8 KiB body bound and the challenge. It waits at least three seconds after challenge issuance and applies an atomic salted per-IP bucket (30 requests per ten minutes, including challenge requests and submissions). A unique submission hash makes concurrent requests and retries idempotent. A stored row must be confirmed before returning `saved: true`. Raw IPs and cookie values are not stored with answers. Existing auth-limit expiry cleanup removes old challenges.

Cookie-based duplicate prevention cannot prove one human per response: clearing cookies or changing devices can permit another response. Rate limits and the minimum duration reduce simple automation; a determined distributed bot may require a future managed challenge service. No new secret, external challenge dependency or login requirement is introduced.

Staging `?verification=1` visibly labels the survey as verification. Its submissions use `verification: true`; the server stores `is_test=1`. Non-staging environments reject that flag. Administrator results exclude these records by default and provide an explicit verification-only filter. Tests must use this mode; they never rewrite or remove stored responses.

## Administrator results and security

GET `/api/admin/research-responses` uses the unchanged provider session, recovery restrictions, administrator grant verification and Owner gateway routing. It combines the two immutable response sources. Pagination and full-dataset question statistics share one materialized D1 snapshot. It returns at most ten full records per page, overall count, per-option counts and per-question answered counts. Percentages use all responses matching the filters (multiple-choice totals may exceed 100%). Optional written answers appear in each response's full questionnaire with the submission time and EN/ES language.

Supported filters: `page`, `from`, `to` (UTC calendar dates), `language=en|es`, `sort=asc|desc`, `tests=0|1`. Default is newest first and non-test responses only. Question-specific counts include all filtered stored responses, not just the visible page. Historical questionnaires show their original answers and an earlier-questionnaire label. Empty and error states do not use sample data.

Ordinary users receive 403 from the administrator endpoint; logged-out requests receive 401. The former participant aggregate endpoint `/api/research/results` and `/research/nopahua/results` no longer share results with participants. The old authenticated submission API remains compatible and retains its permission checks. No browser receives service-role secrets or administrator credentials.

## Verification and deployment

Local tests cover validation, anonymous complete storage, duplicate/concurrent submission, expired/too-fast challenges, origin rejection, rate limiting, simulated database failure, immutability, test isolation, eleven-question statistics, filters, sorting, pagination, ordinary-user denial and administrator revocation. Real workerd/D1 tests exercise the public write and combined administrator query. Browser tests cover mobile/desktop, both survey languages, retained answers, review/edit, failed/unconfirmed saves and existing administrator language/operations behavior.

Deploy only the existing `wrangler.staging.jsonc` target. Apply **only 0020** through a temporary configuration whose migration directory contains that migration; do not apply the unrelated pending Owner migration. Before and after deployment compare counts and hashes of original response rows, administrator grants and existing trigger definitions, without printing response contents. Live verification uses the existing administrator/ordinary accounts and clearly flagged verification submissions. No Owner enrollment, secret installation, Supabase setting change or production deployment is part of this release.

## Staging release evidence — 2026-10-30

- Application commit: `0b560e4` on `feature/secure-authentication`, pushed successfully.
- Applied only migration `0020_public_nopal_survey.sql`; 0019 was already present remotely. Pending Owner migration 0009 was not applied.
- Worker version: `0badec1b-0eab-4ace-bf60-32de2d72bd98`, staging only.
- Typecheck, lint, build, translation checks and staging configuration check passed. Full regression: 324 passed; related browser regression: 50 passed; subsequent legacy-verification isolation/D1 regression: 12 passed.
- Live EN/ES anonymous submissions at 375/1440px both returned confirmed saves, survived reload and duplicate retries, and appeared with all eleven answers in the administrator verification view. Both were explicitly stored as test responses and excluded from the default total. Default total remained 1; verification view contained the pre-existing explicitly marked test and two new verification records.
- Live ordinary account: session verified without administrator grant, results request 403. Logged-out request: 401. Existing administrator login and results read: successful. Public and administrator detail views had no horizontal overflow at 375px or desktop.
- Original two response rows, one administrator grant and all 74 pre-existing trigger definitions retained their exact pre-deployment hashes. No original response, grant, secret, Supabase setting or production deployment was changed.
- The live verification script takes owner-only existing session files. It writes no credentials to Git and logs out its supplied verification sessions when complete. Its intentional test records remain retained and clearly separated from real statistics.


## Administrator graph extension

The same materialized D1 snapshot now includes UTC daily response counts and an independently paginated written-answer table (`writtenPage`). Changing the individual response page or the written-answer page does not change full-filter statistics. The response bodies, schema and administrator checks are unchanged; no migration is needed.

The results UI renders a date trend with an accessible data table, per-question count/percentage bars, a format-preference donut and count-scaled stacked comparisons with complete question/choice legends. All eleven questions remain visible even with no answers. Written questions show answered/missing distributions plus the original text table; they do not acquire fabricated choices. Percentages use the full filtered response total, with a zero denominator rendered as 0%. Historical unasked questions remain missing. Multi-select selection counts can exceed response totals and the UI explains this explicitly.

Every displayed count comes from the existing administrator API; dates, language, verification status and both paginations share the same filtered record set. Stale charts are hidden while a new filter query is pending. EN/ES labels, numeric text accompanying colors, wrapped legends, keyboard-accessible chart-data disclosure and mobile original-text cards preserve the existing visual style. Browser charts are native SVG/CSS and add no third-party dependencies or secret values.
