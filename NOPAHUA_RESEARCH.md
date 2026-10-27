# NopaHua private research (staging)

Routes: `/research/nopahua` and `/research/nopahua/results`. Both HTML and API requests require an existing, email-verified Supabase session. Recovery sessions are excluded. First visits without a saved language preference use Spanish; existing EN/ES preferences persist.

Administrator menu: **Research Access** (`/admin?section=research-access`). Email permissions bind to the first matching verified provider subject; alternatively an existing application user ID can be specified. No invitation, account creation, alternate token, admin grant, or email delivery is implemented. Email permissions do not prove the account exists until its verified login occurs.

## Separate permissions

- `research_access`: scoped target, bound provider subject, allowed/revoked state, explicit aggregate-results flag, grant/change timestamps, actor and last audit event.
- `research_access_events`: append-only grant/revoke audit ledger, surfaced in existing Activity Log.
- `research_responses`: one immutable response per existing account. Collects concept interest, clarity, format preference, optional comment, consent/version and language. Account ID is retained for access control and deduplication; no contact email is copied into answers.
- Page permission permits survey submission. Aggregate results require an additional explicit permission. Individual comments are never included in shared aggregates. Raw response review and permission management always require existing administrator authority.
- Every protected request checks the current permission. A database insert trigger rechecks submission authority to close a revoke/submit race. Open pages recheck on focus and every 30 seconds. Revocation does not delete responses or audit history.

## APIs

- `GET /api/research/access`: current permission and submission state only.
- `POST /api/research/responses`: validated, consented submission; duplicate requests report already submitted. There is no respondent response-list GET.
- `GET /api/research/results`: separately authorized aggregates only.
- `GET/POST /api/admin/research-access`: existing admin guard; grant/revoke use expected last event for concurrency protection. Lists use existing 10-row pagination.
- `GET /api/admin/research-responses`: admin-only paginated raw answers and aggregate counts, excluding account identifiers.

D1 is accessible through the existing private Worker binding; it has no Supabase-style RLS. Supabase RLS and all existing authentication/admin grants remain unchanged. D1 audit/projection/response triggers enforce the new write invariants, and server routes enforce all reads. Existing owner-gateway write restrictions are preserved; that mode does not gain new write endpoints implicitly.

## Staging deployment

Only staging/local Worker-first routing adds `/research/nopahua*`; production configuration remains unchanged. Strict staging preflight requires the protected route. Migration `0017_nopahua_research.sql` is additive. At implementation time staging also had an unrelated pending `0009_owner_command_receipts.sql`; it was deliberately not applied. Only 0017 and its normal `d1_migrations` ledger entry were executed with the existing staging D1 command.

No credentials belong in this file, source code, URLs, screenshots, or logs. Real staging verification uses separately supplied existing accounts; any verification survey response must be clearly labeled synthetic and excluded from interpretation as market evidence.
