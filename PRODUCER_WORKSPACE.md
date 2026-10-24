# Producer workspace

The existing application uses Supabase Auth and a server-only Cloudflare D1 binding for profiles and sessions. This change keeps that architecture; it does not introduce Supabase storage, RLS policies, service-role credentials, or a second authentication mechanism.

## Storage and authorization

`0004_producer_workspace.sql` adds `producer_profiles` (extended business profile) and `producer_items`. Existing onboarding profiles, immutable account roles, sessions and encryption keys are untouched. Apply this migration after 0001–0003 using the existing staging D1 ledger; do not rerun earlier migrations or copy production data.

Every producer endpoint uses the existing verified normal session and producer role. The server supplies the owner ID, and every private read/update/delete filters by it. D1 is unavailable directly to browsers; Supabase RLS does not apply to D1. Database constraints enforce nonnegative amounts and valid status values; the Worker also checks lengths, finite numeric bounds, required fields, business email and currency format.

- `GET /api/producer/dashboard`: private profile, items and computed summary.
- `POST /api/producer/profile`: upsert extended profile. Account role/name remain in onboarding storage.
- `POST /api/producer/items`: create (without id), edit (with id), delete (with id and action `delete`). Unknown or foreign IDs return 404.
- `GET /api/public/produce`: anonymous discovery, 50 public items per page with `page` and `hasMore`, and optional `q`, `country`, `region`, `category`, `id` filters. Explicit field projection excludes account name, account email, owner IDs, sessions and credentials. Publishing an item shares company/country/region/introduction. Business email/phone require separate profile consent. Draft/private items are excluded. The Explore Produce page and Buyer Center reuse this endpoint.

Summary: item count includes all owner items; public count and available supply include public items only, grouped by exact unit without unit conversions. Profile completeness measures company, country, region, introduction and at least one business contact (five fields). A contact need not be public to count.

## Staging procedure

Run typecheck, lint, build, prototype/auth/producer/deployment/browser tests, staging configuration check and staging dry-run. Test fixtures use synthetic providers and disposable SQLite/workerd databases; no real accounts or email are needed.

Read the remote staging ledger first:

```sh
WRANGLER_SEND_METRICS=false npx wrangler d1 migrations list DB --remote --config wrangler.staging.jsonc
```

After confirming only 0004 is pending, use the existing migration apply procedure targeting this same staging config. Confirm the new tables/ledger, then deploy using `wrangler deploy --config wrangler.staging.jsonc`. Do not deploy code before the migration, change secrets, or target production. Existing sessions should remain valid. Remote application and deployment remain unverified until actual CLI and HTTP checks succeed.

Orders, payment, logistics tracking, file uploads, buyer search UI and commercial verification are not implemented.

## Verification record (2026-10-22, Asia/Rangoon)

- TypeScript, ESLint, Vite production build, staging config check, staging bundle dry-run and diff whitespace check passed.
- Prototype: 32 passed. Authentication: 43 passed, including actual local workerd/D1 item create/public read/delete and existing session/role/recovery/logout checks. Producer SQLite/API: 2 passed (profile persistence, item CRUD/validation, foreign owner isolation, private/public/contact projection, anonymous/recovery/buyer blocking). Deployment config: 8 passed.
- Browser: 24 passed, including producer profile/item save and reload against intercepted API responses. Initial runs were blocked by restricted localhost permissions and then missing `libasound.so.2`; final run used existing libraries at `/home/administrator/.local/share/geoai-playwright-runtime/usr/lib/x86_64-linux-gnu` via `LD_LIBRARY_PATH` with localhost runtime permitted. Browser tests do not prove remote persistence.
- Remote staging migration ledger lookup failed twice because Cloudflare's expired token could not refresh through the auth server. Direct staging URL check failed with connection reset. No remote migration or deployment was attempted, and no live URL was verified in this task.
- No production changes, secrets changes, real account creation, email delivery, Git staging/commit/push occurred. Existing uncommitted changes were retained.

## Staging continuation: connection diagnosis (2026-10-22, Asia/Rangoon)

The existing implementation was preserved; no feature rewrite was performed. The working directory and pre-existing uncommitted changes were reviewed. Staging configuration and documented deployment commands were checked:

- Worker: `jalisco-auth-staging`; Cloudflare account: `89dd3e659cece6bdf3181b991a2a0bd2`.
- Binding `DB`: database `jalisco-auth-staging`, ID `7712d6bb-2414-44d3-9282-cb5b941d740e`, migrations directory `migrations`.
- `npm run check:staging` and `git diff --check`: passed.
- `wrangler whoami`: failed both in the sandbox and with network execution permitted. Wrangler reports an expired stored token that cannot refresh because the Cloudflare auth server cannot be reached. Credentials were left unchanged.
- Independent unauthenticated DNS/HTTPS diagnostics: `dash.cloudflare.com` and `api.cloudflare.com` returned `EAI_AGAIN` / `[Errno -3] Temporary failure in name resolution`. The configured resolver is `10.255.255.254`. No proxy environment variables were set. No resolver or network settings were changed.
- Staging hostname resolves to IPv4 and IPv6, but its dashboard HTTPS request fails with `ECONNRESET` / `[Errno 104] Connection reset by peer`. Forced IPv4 curl returns error 35 (connection reset); forced IPv6 returns error 7 (connection failure). There was no HTTP response; this is not evidence of an application authorization failure.
- Remote staging migration ledger command `wrangler d1 migrations list DB --remote --config ./wrangler.staging.jsonc` failed at the same authentication refresh step. Account membership and actual remote D1 identity/schema cannot be confirmed; neither account mismatch nor D1 configuration failure has been established.
- As the ledger could not be read, migration 0004 was NOT applied. No deploy command was issued and no deployment version was obtained. Real authenticated CRUD, reload persistence, public/private and cross-owner isolation, login/session/logout remain unverified remotely. No test data was created, so cleanup was unnecessary.
- No production resource, secret, session encryption key, authentication file or source implementation was changed. No Git staging, commit, push, reset or checkout occurred. Only this continuation record was appended.

Continuation prerequisite: working DNS/HTTPS access from the execution environment to Cloudflare OAuth/API and the staging Worker, followed by successful `whoami` and remote ledger inspection. If authentication still fails after connectivity is restored, renew access through a secure Cloudflare authentication flow; do not send tokens or secrets in chat. Resume the existing documented staging procedure only after the ledger is available.

## Successful staging release (2026-10-22, Asia/Rangoon)

Connection diagnostics were each executed once with network access permitted:

| Command | Exit code | Result |
| --- | --- | --- |
| `getent hosts api.cloudflare.com` | 0 | IPv4 addresses resolved; no DNS error |
| `getent hosts dash.cloudflare.com` | 0 | IPv4 addresses resolved; no DNS error |
| `curl -I --connect-timeout 10 https://api.cloudflare.com/client/v4/` | 0 | HTTP/2 400 from the API root; HTTPS transport succeeded |
| `npx wrangler whoami` (telemetry disabled) | 0 | Existing OAuth authentication succeeded; expected staging account matched |

No manual login or secret changes were required. Earlier network failures no longer reproduced. No tokens, secret values or response cookies are recorded here.

Remote ledger confirmed 0001–0003 applied, only 0004 pending, and neither producer table present. Applied `0004_producer_workspace.sql` only using the existing staging migration command with `--remote --config ./wrangler.staging.jsonc`. Exit code 0. Remote ledger records application at `2026-10-22 04:28:15 UTC` (10:58:15 Asia/Rangoon). Verified both new tables and every column remotely. The target remained D1 `7712d6bb-2414-44d3-9282-cb5b941d740e`.

Staging config check, TypeScript and production asset build passed. Executed the existing documented command `npx wrangler deploy --config ./wrangler.staging.jsonc` with telemetry disabled; exit code 0. Worker `jalisco-auth-staging` deployed successfully. Version `40597ecc-72c3-4450-9bc2-ba282c9a2be8`, independently confirmed as 100% active by `wrangler deployments list`. Version created `2026-10-22 04:28:43.541 UTC` (10:58:43 Asia/Rangoon).

Actual remote checks (no API mocks):

- Homepage and `/producer/dashboard`: HTTP 200. Dashboard references the current `index-CBaaWgbo.js` asset.
- `/api/auth/session` and `/api/producer/dashboard` without authentication: 401.
- Anonymous profile/item POST with valid Origin: 401.
- Wrong-Origin profile POST: 403, `Request origin rejected.`
- `/api/public/produce`: 200, empty items array.
- Invalid login input: 400, `Enter a valid email address.` This does not verify successful login.
- Anonymous logout: 200 and cookie clearing. This does not verify revocation of an authenticated session.
- Real isolated Chromium browser, no intercepts: dashboard HTML 200; actual session request caused the access-unavailable alert, and no Save profile button was rendered.
- Initial default Python client smoke run received unexpected dashboard HTTP 403 and then stopped on non-JSON parsing. A bounded diagnostic and final smoke run with browser User-Agent returned the expected statuses; actual Chromium also succeeded. The first 403's underlying cause was not established.

Authenticated profile save/reload, item CRUD, populated public/private projections, cross-producer ownership and successful login/session/logout remain UNVERIFIED remotely: no authorized authenticated staging test sessions for two producers are available to this execution. No credentials were requested, existing session records were not extracted, and no sessions were forged. No real account or email was created and no test data was inserted. Local/mock tests are not presented as remote acceptance evidence.

Production, secret values and session encryption keys were untouched. Existing uncommitted implementation was preserved; no Git staging/commit/push/reset/checkout occurred. This turn appended this record without rewriting the feature.

## Three-area integration (2026-10-22, Asia/Rangoon)

Current routes and implementation:

- `/explore`: Explore Produce. Anonymous, live public directory with produce/producer text, country, region and variety/category filters. `?id=` links to an individual public listing and its producer details. Empty state and reset are available. Public contact data remains opt-in. Search filters execute on D1 before pagination (50 per page, stable order, page/hasMore).
- `/buyer/dashboard`: Buyer Center. Verified normal buyer session required by the server. Private company/country/region/introduction upsert; saved public produce list with save/remove and pagination; public producer/supply details and search. Unpublished/deleted produce disappears from saved results; deleting a producer item cascades its saved links. Orders/payments/logistics are explicitly planned, unavailable features.
- `/producer/dashboard`: My Workspace. Existing real profile and produce CRUD maintained, including saved-data summary and profile completeness. Optional currency is validated as exactly three uppercase letters when supplied; a priced item requires currency. Browser validation now matches the server.
- `/account`: uses the existing verified session to route to the appropriate workspace or onboarding. Anonymous users receive sign-in/sign-up guidance. Wrong-role users receive a link to their own workspace. `/workspace` and `/buyer` are compatibility entry paths; all existing auth/dashboard URLs and the root public presentation/map remain usable.
- Shared responsive navigation provides Explore Produce, Buyer Center, My Workspace, Sign in / Account. The root original public presentation remains at `/`.

New files: `src/components/SiteNav.tsx`, `ExploreProduce.tsx`, `BuyerCenter.tsx`, `worker/buyer.ts`, `migrations/0005_buyer_center.sql`, `tests/browser/areas.spec.ts`. Updated existing account/main/producer components, styles, Worker routing/public query, test fixtures and API/browser tests. No dependencies added.

Buyer API:

- `GET /api/buyer/dashboard[?page=N]`: own effective profile and own saved public items.
- `POST /api/buyer/profile`: upsert own business profile.
- `POST /api/buyer/saved-items`: `{id,action:'save'|'remove'}`; saves require currently public produce, duplicate saves are idempotent.

All owner IDs come from the existing provider-verified HttpOnly session. Client owner fields do not select another account. Buyer and producer routes enforce roles server-side, after normal-session/recovery checks. D1 remains server-only; no Supabase RLS or auth redesign. No new secret, token handling, auth provider, cookies, session encryption, email flow or account-role mutation was introduced.

Validation actually executed:

- `npm run typecheck`, `npm run lint`, `npm run build`: passed. Vite emitted its nonfatal >500 kB chunk advisory (main JS 502.31 kB, gzip 152.05 kB).
- `npm test`: 32 passed, existing public presentation/map/localization preserved.
- `npm run test:producer`: 5 passed with actual Worker handlers and disposable SQLite; profile/item CRUD, persistence reads, draft/private/contact exclusion, server currency validation, filtered pagination, query binding, buyer profiles/saved lists, forged owner isolation, cross-role blocking, unpublishing/deletion cleanup and logout protection.
- `npm run test:auth`: 43 passed, including actual local workerd/D1 and synthetic provider login/signup/confirmation/recovery/session/logout regressions. These do not prove real email delivery.
- `npm run test:browser`: 30 passed using existing runtime libraries, including six new public search/mobile navigation, buyer save/reload/shortlist, wrong-role, account routing and compatibility-path tests. API responses are intercepted in this local browser suite, so its save/reload results are not remote acceptance evidence.
- `npm run test:deployment`, `npm run check:staging`, `npm run dry-run:staging` (telemetry disabled), `git diff --check`: passed.

Staging migration/deployment:

- Remote ledger showed 0001–0004 applied, only 0005 pending, and buyer tables absent. Applied only 0005 to `7712d6bb-2414-44d3-9282-cb5b941d740e` with the existing explicit staging config. Exit 0. Remote ledger records `2026-10-22 05:41:21 UTC` (12:11:21 Asia/Rangoon). Verified both table definitions and `buyer_saved_items.item_id` cascading foreign key remotely.
- Deployed with the existing documented `wrangler deploy --config ./wrangler.staging.jsonc` command, exit 0. Active version independently confirmed at 100%: `809d16f8-86d3-4f23-8f4d-e120d4063ec0`, created 12:11:59 Asia/Rangoon.
- URL: `https://jalisco-auth-staging.yukikato123123123.workers.dev`.

Actual remote checks, no mocks:

- Root, explore, buyer dashboard, producer dashboard, account and both compatibility paths: HTTP 200, referencing current `index-s4Zn61Es.js` assets. HTML for private routes is a shared shell, not authorization to read private data.
- Public API: 200 with one existing published item. Real search/country/region/category filters matched that existing listing, `id` returned the same single listing, unmatched search returned empty. Public responses contained no owner IDs, account name/email, session token or private status fields. Remote aggregate query independently confirmed one public producer item; no draft/private rows were available for live exclusion testing.
- Invalid public page number: 400. Anonymous session and buyer/producer dashboard APIs: 401. Anonymous buyer profile/saved-item and producer profile/item POSTs: 401. Wrong-Origin buyer profile POST: 403.
- Isolated real Chromium at 390 and 1440 px: Explore Produce shows the actual public listing, all four navigation links visible, live search/reset works, and no horizontal overflow. Anonymous buyer/producer pages show access guidance and no save-profile controls. Existing public Leaflet map renders at both widths without horizontal overflow.
- Remote aggregate counts of buyer profiles and saved entries were both zero; no live test data was inserted or removed.

Remaining remote acceptance: authenticated buyer/producer profile save/reload, item CRUD, populated private/draft exclusion and business contact consent, normal login/session/logout and cross-account role/owner tests need isolated, authorized test accounts with completed confirmation and secure login access. Prior recipient allowlist is retained, but Supabase management/mail configuration access needed for safe duplicate-account/delivery preflight is still unavailable. No accounts, email requests or existing-user changes were made in this integration task; no authentication bypass or extracted sessions were used.

Production resources, all secrets/session encryption keys and existing user rows were unchanged. Pre-existing uncommitted edits were preserved. No Git add/commit/push/reset/checkout was executed.

## Authentication diagnosis follow-up (2026-10-22)

See the final staging link-repair section of `AUTHENTICATION.md`. Staging is now version `5e466b97-94ab-4fd6-8092-da190a66a8c7`. Actual approved buyer login/session/logout passed with 200/200/200 and stale-cookie rejection 401; this buyer is now confirmed/onboarded and its private generated test credential remains locally available. Earlier statements that no usable buyer session is available are historical. No buyer profile, saved-list or producer data was changed by this diagnosis. Prepared signup/recovery hash-link templates and the extra recovery redirect have not been applied to remote Supabase settings. No actual email was sent. Cross-account testing and live email-link/reset acceptance remain unverified.
