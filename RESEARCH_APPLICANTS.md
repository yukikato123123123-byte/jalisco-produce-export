# Research applicants and administrator review

## Entry points

- `/signup`: existing Supabase signup; server metadata adds `registration_type: research` for research signup only.
- `/account`: signed-in existing users can explicitly request research participation without another Auth account.
- `/research` redirects to the existing protected `/research/nopahua` page. The destination still checks session and current research permission server-side.
- `/admin?workspace=nopahua&section=research-applicants`: paginated applicant list, explicit existing-account linking, audited approval/rejection.
- Existing `/api/admin/research-access`, research responses/results and legacy workspace contracts remain.

## Data and failures

`0018_research_applicants.sql` adds only research intent records keyed by provider subject, scoped by project and unique email. It records provider timestamps when available, source, requesting/recording actor and request time. Unknown timestamps are null, not fabricated. It creates no Auth account, profile, administrator grant or research permission. A retention trigger prevents deleting applicant records.

Successful identifiable research signup writes an applicant record after the provider accepts the account. Duplicate-signup obfuscation with empty identities is not treated as a new user. Auth and D1 cannot share a transaction: a D1 failure after account creation returns a real failure and retains the Auth account. The same account can repair the record on verified research-metadata login or with an explicit signed-in application from `/account`; it is never deleted/recreated as compensation. Upserts do not duplicate records or reset access decisions.

Existing users without the historical research marker are not automatically classified. An administrator must explicitly link a research applicant by email, or the user must explicitly apply. The specified real test account must not be recreated.

## API and security

- `POST /api/research/application`: existing verified, non-recovery session; stores the caller's own research intent only.
- `GET /api/admin/research-applicants?q=&status=&page=`: existing session and `hasAdministratorGrant`, server pagination (10 rows), exact total and clamping. Filters: pending/approved/rejected.
- `POST` same admin endpoint with `action: register_existing, email`: resolves an existing Auth account server-side, then links intent. Bounded lookup: at most 25 pages of 100 Auth records; other accounts are never returned or auto-enrolled.
- `POST` same endpoint with `user_id, action: research_grant|research_revoke, expected_event_id, reason`: rechecks current Auth identity and delegates to the existing research event/trigger path. Results sharing is false. No projection update bypass is used.

The existing server-only `SUPABASE_STORAGE_SERVICE_ROLE_KEY` is reused for Auth Admin GETs; no new secret is invented or sent to the client. Only selected page subjects are refreshed for email verification and provider creation time. Missing/invalid server credentials produce 503, not invented verification results. Official provider references: [listUsers](https://supabase.com/docs/reference/javascript/auth-admin-listusers), [getUserById](https://supabase.com/docs/reference/javascript/auth-admin-getuserbyid).

Existing Origin/CSRF, session revocation, recovery limits, administrator grants and research project checks remain. The Owner dispatch remains before the new D1-admin endpoint; Owner configuration is not enabled or bypassed. Ambiguous parallel email/user permissions require explicit Research Access review instead of silently leaving another grant enabled. Research response permission triggers and immutable response/audit history remain unchanged.

## Administrator cleanup

Product Concept, Ritual and Origin menus and their administrator-only content component, imports, icon keys, styles and unused administrator translations are removed. Their public homepage content and server API contracts are retained. Legacy products, approvals, inquiries and other existing business-administrator functionality are unchanged. Tests explicitly verify removed menus in EN/ES and navigation in all five existing administrator languages.

## Staging migration

Apply only `0018` using a temporary copy of the pinned staging D1 configuration whose migration directory contains only `0018_research_applicants.sql`. Use Wrangler's migration runner so successful application is recorded and failed migration is rolled back. Do not run the complete pending migration set: `0009` is still intentionally unapplied. Target is the existing `jalisco-auth-staging` D1 UUID, never production. No original migration is edited.

## Verification and actual-account limits

Tests cover administrator/ordinary/logged-out access, explicit classification, signup intent and retry repair, no automatic grant, audited decisions and stale/concurrent conflicts, protected survey submission/results, exact pagination and provider failure. Browser tests cover 375/768/1440px, EN/ES, keyboard-capable controls, approval/rejection, list navigation and removed menus.

Real staging verification uses only operator-provided accounts. Never fabricate research answers, recreate an existing account, alter administrator grants, reset passwords or weaken the 12-character password policy to complete a test. If the supplied participant credential does not meet that existing policy, authenticated participant submission remains unverified and is reported separately from isolated fixture tests.
