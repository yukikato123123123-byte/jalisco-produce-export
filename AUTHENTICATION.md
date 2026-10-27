# Local authentication implementation

> Current isolation work supersedes the historical shared-provider instructions below.
> See [STAGING_ISOLATION.md](STAGING_ISOLATION.md). Do not apply shared-project setup instructions for the new staging cutover.

For the current integration proposal, owner-specified staging D1, explicit config
commands and remaining access requirements, see [AUTH_DEPLOYMENT.md](AUTH_DEPLOYMENT.md).
The historical runbook below is not evidence that any remote setup was performed.

No production resource was created or changed. The public homepage, presentation
views, Leaflet map, illustrative GIS layers and 2.5D effects remain public.

## Architecture and boundaries

Supabase Auth owns passwords, email verification, recovery codes and provider-side
abuse controls. The Worker uses the Auth REST API directly, avoiding a second
browser auth SDK. No service-role/admin key is needed. A browser never receives
provider access/refresh tokens. The Worker issues a random opaque HttpOnly cookie,
stores only its SHA-256 identifier in D1, and AES-GCM encrypts the provider access
token at rest using a separate server secret. No refresh token is persisted.
Sessions expire after at most one hour (recovery: ten minutes). Re-login is
intentional; automatic refresh is not implemented. Logout deletes the local
session immediately, independently of provider availability. Other devices remain
signed in after logout. A password-reset claim advances the user's generation
and revokes earlier sessions, even if cleanup is delayed or fails.

Every protected API validates the session with Supabase `/user`, checks confirmed
email and loads the authoritative role from D1. User metadata is only an onboarding
prefill, never authorization. Producer/buyer are self-selected account categories,
not verified commercial identities. First completed onboarding fixes the role;
there is no role-update endpoint and SQL disallows role updates. Recovery sessions
cannot onboard or access either dashboard. Cross-origin mutations are rejected,
JSON is required, API responses are not cached, and provider errors/secrets are
not logged or passed through. A durable per-IP bucket allows 30 mutations per ten
minutes; a separate 60-per-minute session bucket bounds outbound `/user` checks.
No identity/revocation cache is used. Supabase's additional provider limits apply. Production requires
review of proxy IP trust, abuse controls, privacy/retention and account lifecycle.

## Local setup (not performed against a real provider in this task)

1. Install project dependencies with `npm ci` (Node 22.23.2 was used).
2. In a **separate non-production Supabase project**, enable email/password login,
   require email confirmation, set minimum password length to at least 12 and
   configure suitable password/security policies. Configure a verified SMTP sender
   for confirmation and recovery mail. Do not assume the default mail sender can
   deliver to arbitrary addresses. This is external configuration and requires
   the owner's authorization; no provider setting was changed here.
3. Configure **Confirm signup** and **Reset password** email templates to display
   `{{ .Token }}` as the confirmation/recovery code and a link to
   `http://localhost:8787/verify-email`. Do not use the default implicit-flow link:
   this implementation accepts email + numeric OTP, not tokens in URL fragments.
   Keep the configured OTP length 6–10 digits and a short expiry. Configure Site
   URL/allowed URLs for the non-production origin. Update the link and origins
   explicitly for any later HTTPS staging deployment. Template changes must be
   verified by actual email delivery before staging readiness can be claimed.
4. Copy `.dev.vars.example` to `.dev.vars` and replace placeholders locally:
   - `SUPABASE_URL`: `https://<project-ref>.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY`: project's publishable (or legacy anon) key;
     **never** service-role/admin key.
   - `SESSION_ENCRYPTION_KEY`: exactly 64 hexadecimal characters, generated with
     `openssl rand -hex 32` into a secure local destination. Do not paste it into
     chat or commit it. Key rotation invalidates existing encrypted sessions.
   `AUTH_ORIGIN` is `http://localhost:8787` in `wrangler.local.jsonc`. Use that
   exact hostname, not `127.0.0.1`, in the browser. Only loopback origins may use
   HTTP. No `VITE_` secret is required or supported.
5. Run `npm run db:local` (explicitly `--local`), `npm run build`, then
   `npm run dev:worker`. Vite alone (`npm run dev`) has no authentication backend.
   D1 uses the local placeholder binding; it is not a production database ID.
6. Open `http://localhost:8787/`. `/login`, `/signup`, `/forgot-password`,
   `/verify-email`, `/reset-password`, `/onboarding`, `/producer/dashboard`, and
   `/buyer/dashboard` use the same origin. API calls fail closed with a setup
   message when provider settings are absent. Public content remains available.

Do not deploy the local Wrangler config as a replacement for production. The
original repository had no tracked Worker deployment config. The owner has since
confirmed a static-assets-only production Worker built from `main` using
`npm run build` and `npx wrangler deploy`. The current CLI account settings and
remote runtime bindings have not been inspected. A future approved staging effort
must provision its own D1, run migrations, bind secrets, configure HTTPS origin,
and verify all flows. No deployment or remote migration command belongs to the local workflow;
the approval-gated staging examples later in this document are operator plans only.

## Checks and manual acceptance

- `npm test`: existing tests, including presentation/charts/GIS modules.
- `npm run test:auth`: Worker integration tests with real in-memory SQLite and a
  **mock Supabase HTTP boundary**; no real email/account is created.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- `npm run test:browser`: local Worker + browser checks. Some API responses and
  map tiles are intercepted; this is not live-provider verification. Browser
  binaries/system libraries must be available (`npx playwright install chromium
  --only-shell`). In this WSL environment, see the completion report for the
  process-local ALSA library path needed to run Chromium.

With authorized staging credentials, manually register separate producer/buyer
addresses, check actual confirmation email/code expiry/reuse rejection, verify
login failures and success, complete onboarding, reload each dashboard, and try
the opposite role API. Change browser state/storage and verify no access is gained.
Check HttpOnly/Secure/SameSite and absence of provider tokens in browser storage
and responses. Log out and replay the old cookie: expect 401. Request recovery
for existing and nonexistent addresses: UI guidance must be indistinguishable.
Confirm email arrives, verify recovery code, ensure recovery cannot access business
APIs, reset the password, confirm old application cookies fail, then sign in with
the new password. Test slow/offline/429 provider behavior, mobile layouts and
public map interactions. Check the confirmation and recovery templates separately.

Not production-ready until these real-provider/manual tests, deployment routing,
SMTP delivery, configured security policies and operational controls are verified.
No inventory, supplier verification, orders, payments or logistics backend exists.

## Verification recorded before the security fixes (historical)

- Existing tests: 32 passed (`npm test`).
- Auth integration tests: 7 passed (`npm run test:auth`), with SQLite and mock
  provider responses, including role isolation, expiration, encryption, CSRF,
  recovery scope, rate limits and logout/session revocation.
- Browser tests: 10 passed in 9.0 seconds, using:
  `LD_LIBRARY_PATH=/home/administrator/.local/share/geoai-playwright-runtime/usr/lib/x86_64-linux-gnu WRANGLER_SEND_METRICS=false npm run test:browser`.
- Lint, frontend/Worker typecheck, production build, and `git diff --check` passed.
- Both SQL migrations applied successfully to **local** D1 only.
- Signup screenshots at desktop/mobile sizes reviewed against all four ZIP images.
- An actual local Worker request to a protected API without provider settings
  returned 503, rather than granting access or presenting simulated auth success.
- Real Supabase credentials, SMTP delivery, and live confirmation/recovery flows
  were unavailable and were not tested. No push, commit, deployment, remote
  migration or provider-configuration mutation was performed.


## Security fixes: database protocol and failure policy

Migration `0003_auth_generations.sql` is additive: it introduces `auth_users`, a
monotonic `auth_clock`, generation/claim fields on sessions, and SQLite triggers.
It intentionally invalidates all pre-migration sessions (`generation = -1`);
users must sign in again. It does not delete profiles or change account roles.
Apply migrations in order to local/disposable staging only, with authorization
for any remote operation. No remote database was accessed in this fix.

The Worker uses the direct D1 binding, whose queries run on the primary when the
Sessions/read-replication API is not used. Conditional writes and their triggers
are single atomic SQLite statements. Do not replace these reads with cached or
unconstrained replica reads. D1 batch transactions would also be valid for DB-only
operations, but cannot make an external Auth HTTP request transactional.
Reference: https://developers.cloudflare.com/d1/worker-api/d1-database/

At request start, BEFORE a password grant or OTP verification, issuance captures
the durable global revocation revision. This is necessary even on the first login,
when no trusted user ID is known yet. After `/user` confirms the identity and the
submitted email, the Worker obtains that user's generation. The conditional
session INSERT requires BOTH the same per-user generation and a reset revision
no later than the captured start revision. Each session stores the generation;
every protected authorization joins it against the current generation. A reset
for a different user does not revoke this user's sessions. This global revision
is an ordering barrier, not a global logout or an email-to-user guess.

Recovery first validates password shape, then conditionally changes one unclaimed,
unexpired, current-generation recovery row to claimed. Its SQL trigger increments
the clock and user generation, blocks normal logins and sets a two-minute pending
lease, all in the SAME statement. Exactly one claimant can call provider PUT.
An already claimed proof is NEVER rearmed. A definitive outcome ends the fence
with another atomic clock/generation increment, invalidating authentication that
started during the operation. Row deletion is only optional garbage collection.

| Outcome | Application state and user action |
| --- | --- |
| Invalid local password before claim | No claim/provider update; correct the input using the same proof. |
| Claim DB statement fails before committing | No provider call. Retry may use the proof if it was not consumed. |
| Claim committed but its reply was lost, or Worker crashes after claim | Proof consumed, normal login blocked. Request a fresh recovery code; retry reset after the two-minute lease. |
| Provider definitively rejects update (validation, rate limit, configuration) | Proof consumed; finish advances generation again and releases the block. Existing sessions remain revoked. Request a fresh code for another reset. Safe error/Retry-After is returned, not success. |
| Provider succeeds and DB finalization succeeds | Password update confirmed; generation advanced twice, cookie cleared. Sign in with the new password. |
| Transport timeout, provider 5xx, malformed success response | Password outcome is UNKNOWN. Proof remains consumed and normal login stays blocked. Request a new code and retry after the lease. |
| Finalization DB failure before commit | Same fail-closed recovery policy; the provider may already have changed the password. |
| Finalization committed but reply lost | Client receives uncertainty, but the stored generation has already revoked old sessions and unlocked new login. A fresh login may work; never reuse old recovery proof. |

Lease expiry alone NEVER restores normal login or revives a cookie. Only a fresh
provider-verified recovery proof can authorize a new reset after the lease, or
an authorized operator can reconcile a persistently stuck account. There is no
browser/admin bypass or automatic reset retry. A request already accepted by the
provider may outlive our HTTP timeout; two minutes is an application pending lease,
NOT proof that the upstream operation stopped. If repeated uncertainty occurs,
keep the account isolated and have an authorized operator confirm the provider
outcome before further recovery. Exactly-once cross-system password changes are
not claimed. Live-provider timeout/revocation behavior requires disposable staging.

## Structured provider errors and rate-control boundaries

Provider errors are classified by HTTP status, endpoint and allowlisted code,
not by provider message strings. Only known duplicate-signup/account-existence
cases receive the same conditional email guidance as accepted requests. Provider
401/403, disabled configuration, unrecognized errors, invalid responses and 5xx
are service failures. Recognized validation failures remain errors. 429 preserves
a bounded numeric Retry-After (default 60s); UI retains entered fields, disables
resubmission during cooldown, and never hides signup or claims acceptance on
failure. Consumed-recovery failures clear the cookie and hide the unusable reset
form while explaining how to restart. No raw provider body, token, OTP, session
identifier or personal error detail is logged or returned.
References: https://supabase.com/docs/guides/auth/debugging/error-codes and
https://github.com/supabase/auth/tree/master/internal/api

The session limiter is intentionally targeted: 60 primary-backed checks per
minute per session, with no provider-result caching and logout still available.
POST limits remain per IP, not an account-wide distributed-guessing defense. No
Sb-Forwarded-For or arbitrary trusted-IP header was introduced. Measure shared
Worker egress limits, NAT collisions, project email quotas, cooldown timing for
existing/nonexistent addresses, and bot/OTP abuse in disposable staging. Consider
account/action-specific challenge budgets and supported edge controls only after
those measurements. HTTPS origin, separate D1 and SMTP configuration remain
required; the local Wrangler placeholder must not be used for production.

## Test scope for the fixes

The original tests remain. `npm run test:auth` additionally imports deterministic
barrier-based concurrency tests, stateful provider-contract tests (distinct users,
passwords, bearer tokens, expiries, OTP purpose/consumption), fault-injected DB and
HTTP classifications, and an actual local workerd/D1 binding integration test.
The latter uses Wrangler's pinned runtime/build dependencies and a synthetic
outbound service; it cannot contact real Supabase. Browser regressions retain
existing homepage/map/role checks and add form-retention, failure, cooldown and
consumed-recovery states. OTP expiry and single use in the contract double prove
that the Worker honors provider rejection; their REAL enforcement is delegated
to Supabase and is not certified by the double. No live-provider test was run.

### Local verification after the security fixes

- `npm test`: 32 passed.
- `npm run test:auth`: 35 passed (the original 7 plus 28 additional tests,
  including the actual local workerd/D1 binding test).
- `LD_LIBRARY_PATH=/home/administrator/.local/share/geoai-playwright-runtime/usr/lib/x86_64-linux-gnu WRANGLER_SEND_METRICS=false npm run test:browser`:
  19 passed in 15.4 seconds.
- `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check`: passed.
- Migration 0003 was exercised on disposable SQLite and actual local D1 bindings,
  including existing session rows; no persistent/remote database migration was run.
- Initial runtime-harness SQL splitting and a Worker-incompatible redirect mode
  were corrected during verification. The first expanded browser run was 17/18:
  its consumed-proof locator also matched the containing section's heading. An
  exact input-label match fixed the test; the final suite above passes. A separate
  regression now checks that a failed resend clears earlier acceptance guidance.
- Server secret/generation-helper names were absent from the generated client
  bundle. No credentials were added, no live-provider requests were made, and no
  commit, push, merge, deployment or production operation was performed.

Ready for an approved, isolated disposable security-test staging exercise only.
SMTP delivery, real OTP consumption/revocation, timeout outcomes, deployed primary
D1 routing, and measured upstream abuse limits still need live non-production
verification. This is not a production-readiness claim.

## Manual staging setup and verification runbook — NOT EXECUTED

This section is an operator plan, not authorization to run it. During preparation
only local files and the installed Wrangler source/schema were inspected. No
remote service was contacted, no key was generated, no setup/migration/deployment
command below was executed, and no live-provider test was performed. Current
branch: `feature/secure-authentication`; the existing dirty/untracked working tree
must be preserved. Do not commit, push, merge, reset or clean as part of this plan.

### 1. Approvals and target inventory

All gates below start **pending**. Approval must name the owner, action, exact
account/project/database/Worker/hostname, cost/request budget and test window.
Approval can explicitly cover several named gates; this document itself does not.
A change of target or scope requires renewed approval. Production is excluded
from every gate, including rollback and cleanup.

| Gate | Explicit manual approval required BEFORE |
| --- | --- |
| A0 — scope and remote access | Signing in to Cloudflare/Supabase/SMTP/vault services, inspecting remote account state, selecting owners, regions, retention and spending limits. Confirm access is to non-production resources. |
| A1 — provider and mail | Creating the separate Supabase project, changing its Auth settings/templates/allowlist, provisioning staging SMTP credentials/sender, creating mailboxes or sink rules, and sending setup emails. Sender-domain DNS edits require the DNS owner's separate explicit approval; never overwrite production SPF/DKIM records. |
| A2 — Cloudflare isolation | Creating the dedicated staging Worker and D1, configuring exact staging hostname/DNS/TLS, and any outer Access/test-team policy. Restrict or disable alternate workers.dev/version-preview URLs. No wildcard route or production hostname is allowed. |
| A3 — credentials | Creating/importing the encryption key in an approved secret vault and setting/replacing staging Worker secrets or CLI credentials. `secret put` can create a draft Worker and change remote version state; treat it as a release-affecting mutation, not a harmless local setting. |
| A4 — database change | Remote migration inspection/listing, approved backup/export of an existing staging DB, migration application, and post-migration SQL checks on the exact staging D1 UUID. Do not assume CLI migration inspection is side-effect free. |
| A5 — release/routing | Uploading code/assets, deployment, attaching the exact staging route, changing bindings, and enabling test-team access. Approve the reviewed source fingerprint/config/binding inventory, not just the branch name. |
| A6 — live verification | Creating disposable users, sending confirmation/recovery emails, updating their passwords, replay/concurrency requests and any rate-limit measurements. Use only owned test mailboxes and a bounded request budget. |
| A7 — fault tests/rollback/cleanup | Introducing an isolated fault-test build/upstream, disabling routes or changing policies, rollback/redeployment, D1 restore/replacement, key rotation, and deletion of disposable users/resources. Each action needs its own named scope; test approval is not permission to destroy or reset shared state. |

Fill in a non-secret inventory before any remote command:

| Item | Required approved value |
| --- | --- |
| Cloudflare account | Exact staging account ID and owner; a separate account is preferred. If shared with production, owner must approve the isolation and available credential scope. |
| Worker | Dedicated name, for example `jalisco-auth-staging`; never the production Worker. |
| D1 | Dedicated name `jalisco-auth-staging-db`, actual staging UUID, owner and migration history. No production clone or production data. |
| Supabase | New non-production project reference and HTTPS URL; never the production project. |
| Canonical origin | One owned HTTPS hostname. This runbook uses **reserved illustrative** `https://auth-staging.example.com`; replace every occurrence with the SAME approved real hostname before use. |
| SMTP | Staging sender/subdomain, credential owner, owned recipient allowlist, quotas and retention. |
| Credentials | Vault entry names/versions only; no values in the inventory or test report. |
| Test users | Aliases `producer-A`, `buyer-A`, `recovery-A`; keep mailbox-to-user-ID mapping privately, not in shared logs. |
| Recovery owner | Named operator for uncertain password/reset outcomes and approved rollback window. |

Stop if any target is unknown, already contains unexplained data, resolves to a
production identifier, or needs broader permissions than approved. Do not use a
production-capable credential merely because it is already present in the shell.

### 2. Local preflight and separate staging config

These are future operator steps, not new test results. First inspect `git status
--short`, the branch and the actual diffs; do not erase any change. The HEAD commit
alone does NOT identify the implementation because much of it is uncommitted.
Record a private content fingerprint of the reviewed source, lockfile, migration
files and staging config. Inspect environment-variable NAMES without printing
values; prevent production `.env`/`VITE_` values from entering a build. Do not
attach `.dev.vars` or local secret files to an artifact.

Re-run the local checks before requesting A5:

```bash
cd /home/administrator/projects/jalisco-produce-export
npm test
npm run test:auth
npm run lint
npm run typecheck
npm run build
git diff --check
LD_LIBRARY_PATH=/home/administrator/.local/share/geoai-playwright-runtime/usr/lib/x86_64-linux-gnu WRANGLER_SEND_METRICS=false npm run test:browser
```

Do not install/update packages or browsers implicitly; if an offline dependency
is missing, stop and obtain approval for the required download. The existing
Playwright config starts a localhost Worker and intercepts auth APIs. Passing it
is NOT a live staging test; do not point it at staging and label mocks as live.

Prepare a new `wrangler.staging.jsonc` at the project root after target review.
The following is a template only: it has NOT been created or applied. Keep the
existing `wrangler.jsonc` unchanged. This is a separate top-level config, so use
`--config ./wrangler.staging.jsonc` on EVERY staging CLI command; do not mix it
with an inherited `--env staging` assumption.

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "jalisco-auth-staging",
  "account_id": "REPLACE_WITH_APPROVED_STAGING_ACCOUNT_ID",
  "main": "worker/index.ts",
  "compatibility_date": "2026-10-21",
  "workers_dev": false,
  "preview_urls": false,
  "routes": [{ "pattern": "auth-staging.example.com", "custom_domain": true }],
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [{
    "binding": "DB",
    "database_name": "jalisco-auth-staging-db",
    "database_id": "REPLACE_WITH_APPROVED_STAGING_D1_UUID",
    "migrations_dir": "migrations"
  }],
  "vars": { "AUTH_ORIGIN": "https://auth-staging.example.com" }
}
```

Never execute with unresolved `REPLACE_` values, the reserved example hostname,
the local zero UUID, or production identifiers. Resolve the actual D1 UUID only
after A2 provisioning. Have a second reviewer check account ID, Worker name,
D1 UUID, provider project, route and origin together. An outer test-team gate is
recommended before first access; it must not add an application-login requirement
to the public homepage/map. If an outer gate is used, anonymous application tests
run as an allowed tester without a Jalisco session. Direct API test harnesses must
also satisfy that outer gate. Do not expose an alternate ungated hostname.

### 3. Supabase, SMTP and exact OTP landing URLs (A0/A1)

1. Create a NEW non-production Supabase project with approved owner, region,
   spending cap and retention. Do not import production users/data or reuse a
   production API key. Do not change settings on any existing production project.
2. Enable email/password sign-in and require email confirmation. Set minimum
   password length to at least 12; UI/backend accept 12–128 characters. Record
   any stronger supported policy and test it. Do not assume MFA/reauthentication
   or CAPTCHA is supported by this UI; those flows are not implemented. If a
   required policy needs them, stop for an approved implementation change.
3. Configure a verified staging SMTP sender using separately scoped credentials
   in Supabase's SMTP settings. SMTP credentials belong THERE, not in Worker
   bindings or `VITE_` variables. Use owned disposable recipients or a test sink.
   Validate sender DNS only after its DNS approval; never replace an existing
   production SPF policy. Disable mail-link tracking for these templates. Record
   delivery quotas/cooldowns and prove delivery with an approved test mailbox.
   The default Supabase sender is not evidence that arbitrary recipients work.
4. Choose the actual canonical origin once. With the illustrative hostname, the
   exact settings are:
   - Worker `AUTH_ORIGIN`: `https://auth-staging.example.com` — no trailing slash.
   - Supabase Site URL: `https://auth-staging.example.com`.
   - Redirect allowlist: `https://auth-staging.example.com/verify-email` only for
     this email flow. Do not add `*`, localhost, production or preview wildcards.
   - Signup email link: `https://auth-staging.example.com/verify-email`.
   - Recovery email link: `https://auth-staging.example.com/verify-email`.
5. Configure supported numeric OTP length to 6 digits (the Worker accepts 6–10)
   and a short supported expiry, for example 300 seconds. Record the actual saved
   value and mail arrival timestamps; do not invent an expiry-test pass. Review
   the project's JWT lifetime too: application sessions cap at 3600 seconds,
   recovery sessions at 600 seconds, and provider expiry can be earlier.
6. Replace BOTH email templates with code-based messages such as these. Substitute
   the real approved hostname in both links before saving:

   **Confirm signup**
   ```html
   <h2>Confirm your Jalisco staging account</h2>
   <p>Your confirmation code is <strong>{{ .Token }}</strong>.</p>
   <p><a href="https://auth-staging.example.com/verify-email">Enter your code</a>
   and choose “Confirm my email”.</p>
   <p>Staging test only. If you did not request this, ignore this message.</p>
   ```

   **Reset password**
   ```html
   <h2>Recover your Jalisco staging account</h2>
   <p>Your recovery code is <strong>{{ .Token }}</strong>.</p>
   <p><a href="https://auth-staging.example.com/verify-email">Enter your code</a>
   and choose “Recover my password”.</p>
   <p>Staging test only. If you did not request this, ignore this message.</p>
   ```

7. Do not use `{{ .ConfirmationURL }}`, `{{ .TokenHash }}`, token query strings,
   or token fragments in these links. The current app has NO `/auth/callback`
   handler, OAuth exchange or implicit-fragment token consumer. `/reset-password`
   is the app's protected destination AFTER a recovery OTP establishes an
   HttpOnly cookie; it is not the provider email callback. Likewise `/onboarding`
   follows successful signup verification. No OTP or password belongs in a URL.
8. Inspect both delivered templates using owned mailboxes after A6. If a default
   link redirects with access/refresh tokens in the browser, STOP, correct the
   staging templates, and replace the affected test sessions; do not call that
   flow verified. Default/provider redirect behavior is not verified here.

Dashboard labels/options can vary by provider version. This document was prepared
without remote documentation/account access; confirm the currently supported
settings after A0 rather than changing an unrelated setting to match a guess.

### 4. Worker bindings and secret provisioning (A2/A3)

| Binding/setting | Staging source and handling |
| --- | --- |
| `ASSETS` | Static-assets binding to the reviewed `dist/`, with SPA fallback and `/api/*` Worker-first routing. Not a secret. |
| `DB` | Dedicated staging D1 UUID, never local zero/production/preview fallback. |
| `AUTH_ORIGIN` | Exact canonical HTTPS staging origin, no path or trailing slash; non-secret config variable. |
| `SUPABASE_URL` | Exact new project URL `https://<staging-project-ref>.supabase.co`; no slash/path. Set server-side; this plan uses a Worker secret. |
| `SUPABASE_PUBLISHABLE_KEY` | That project's publishable key (or approved legacy anon key), set server-side as a Worker secret. No service-role/admin/management key is needed. |
| `SESSION_ENCRYPTION_KEY` | Independently generated staging-only 32-byte key encoded as 64 hexadecimal characters, server-side Worker secret. Never reuse a production/local key. |
| SMTP password | Only in the staging Supabase SMTP configuration; no Worker binding. |
| Cloudflare CLI access | Owner-approved OAuth/account role or scoped token in a secure credential mechanism; not a Worker/client binding or command-line literal. |

Before secret commands, verify the dedicated empty staging Worker has been
provisioned under A2 with alternate URLs disabled. Confirm no production-capable
shell credential is being selected automatically. Approval A3 explicitly covers
remote secret/version changes; repeated secret updates on a deployed Worker may
change what version is active. Keep staging routing restricted while provisioning.
Do not enable HTTP debug output, shell tracing, terminal recording or request
body/cookie capture.

The following generation/validation commands are **local-only examples and were
not run**. Run them in a private Bash subshell with `set +x`, `set -euo pipefail`
and `umask 077`. Use a variable name dedicated to this task, not HOME/CODEX_HOME.
Generate a new private file; never `cat` it or paste its contents into a command:

```bash
set +x
set -euo pipefail
umask 077
jalisco_staging_key_file="$(mktemp /tmp/jalisco-staging-session-key.XXXXXX)"
openssl rand -hex 32 > "$jalisco_staging_key_file"
python3 - "$jalisco_staging_key_file" <<'PY'
import pathlib, re, sys
value = pathlib.Path(sys.argv[1]).read_text().strip()
if re.fullmatch(r'[0-9a-fA-F]{64}', value) is None:
    raise SystemExit('Invalid key format; stop without uploading')
print('Key format valid; value withheld')
PY
```

Import that private file into the approved vault using secure file import, without
revealing/displaying the value. Confirm its vault entry/version exists BEFORE
upload. File/vault handling is part of A3. Keep the path in that private subshell;
do not include it or the key in shared reports. Do not run the following remote
commands until A3 is approved and the config inventory is double-checked:

```bash
WRANGLER_SEND_METRICS=false WRANGLER_LOG=warn ./node_modules/.bin/wrangler secret put SESSION_ENCRYPTION_KEY --config ./wrangler.staging.jsonc < "$jalisco_staging_key_file"
WRANGLER_SEND_METRICS=false WRANGLER_LOG=warn ./node_modules/.bin/wrangler secret put SUPABASE_URL --config ./wrangler.staging.jsonc
WRANGLER_SEND_METRICS=false WRANGLER_LOG=warn ./node_modules/.bin/wrangler secret put SUPABASE_PUBLISHABLE_KEY --config ./wrangler.staging.jsonc
```

For the last two commands, enter the value only into Wrangler's masked prompt
from the approved vault; never use `echo SECRET`, shell history literals, `tee`,
arguments or screenshots. Inspect secret NAMES and successful command exit codes,
not values. Installed Wrangler reads redirected stdin and trims trailing newline;
no manual print is needed. If a command fails, stop and inspect sanitized error
classification/target names, not HTTP debug bodies. Do not generate a new key on
every retry: retry the same approved vault version if provisioning was incomplete.

After successful vault import/upload verification, remove ONLY the temporary
file created above with `rm -- "$jalisco_staging_key_file"` and unset that variable
inside the subshell. This is not a secure-erasure guarantee; use approved private
or encrypted temporary storage if policy requires it. Never delete other files.
Key rotation later requires A3/A7: existing ciphertext cannot be decrypted by a
new key. Retain approved key versions securely; do not weaken encryption or try
to retrieve/print Cloudflare secret values to recover sessions.

### 5. D1 provisioning and migration procedure (A2/A4)

1. Under A2, create a NEW staging D1 via the Cloudflare dashboard in the approved
   account. Copy only its non-secret UUID/name into the separate staging config.
   Do not attach a production DB or import a production backup.
2. Stop staging test traffic before A4. For an existing disposable staging DB,
   check owner, contents provenance and migration history first; obtain approval
   for any backup/export. Encrypt backups and restrict access: they may contain
   profile data and encrypted tokens. For a new empty DB, record empty-state
   evidence. Do not rely on assumed automatic rollback or backup availability.
3. Review these exact files and their content fingerprints:
   - `0001_auth.sql`: profiles, role-immutability trigger, sessions, auth limits.
   - `0002_limits_index.sql`: auth-limit expiry index.
   - `0003_auth_generations.sql`: clock/user state, generation/claim columns,
     single-claim and completion triggers, session generation guard.
4. **Migration 0003 invalidates ALL existing application sessions in the TARGET
   database** by assigning legacy rows generation -1. This includes recovery
   sessions. It does not change the Supabase password or delete profiles. Warn
   every staging tester to sign in/request a new code afterwards. Never apply it
   to another DB on the assumption that only one user's session is affected.
5. Rehearse on disposable local D1 first via `npm run test:auth`; its runtime test
   applies all three migrations and checks legacy-session invalidation. This is
   not proof of a remote DB's schema, permissions or migration ledger.
6. After A4, re-check the config/account/D1 UUID together. Both commands below are
   REMOTE operations, documented only. Review the pending list before approving
   the apply confirmation; do not use `--yes`, CI auto-confirmation, `--preview`,
   `wrangler dev --remote`, or an unqualified default config.

   ```bash
   WRANGLER_SEND_METRICS=false ./node_modules/.bin/wrangler d1 migrations list DB --remote --config ./wrangler.staging.jsonc
   WRANGLER_SEND_METRICS=false ./node_modules/.bin/wrangler d1 migrations apply DB --remote --config ./wrangler.staging.jsonc
   ```

7. A fresh DB should apply 0001 → 0002 → 0003. An already migrated staging DB must
   apply only its pending migrations, once. If ledger and schema disagree, STOP;
   do not manually mark 0003 applied, edit an applied migration, rerun ALTER TABLE
   blindly or remove triggers. Earlier completed migrations may remain after a
   later migration fails; inspect the actual result before continuing.
8. Still under A4, inspect schema/ledger with approved read-only dashboard SQL:
   `PRAGMA table_info(sessions);`, names in `sqlite_master`, the ordered
   `d1_migrations` ledger, and `SELECT revision FROM auth_clock WHERE id=1;`.
   Confirm all three new columns, both auth tables and all three new triggers.
   Do NOT select session IDs/tokens, export cookies, or dump profile rows into a
   report. Stop for errors; do not deploy around a missing security migration.
9. Keep direct primary-backed D1 behavior. No replica cache or unconstrained read
   path is part of this release. Do not change that during setup.

### 6. Staging release and first smoke checks (A5, then A6)

Before A5, confirm the artifact matches the approved local fingerprint and includes
no secret files. Verify the actual staging binding inventory and migration 0003,
HTTPS certificate/hostname, test-team gate, disabled alternate URLs, and rollback
owner. Public page/map code and style must remain the existing implementation.
Only after A5 may an operator execute the documented deployment command:

```bash
WRANGLER_SEND_METRICS=false ./node_modules/.bin/wrangler deploy --config ./wrangler.staging.jsonc
```

This may upload code/assets and attach the configured custom domain/DNS route.
It was NOT run here. Do not use the local config, production Worker name, or an
implicit deployment target. Record the staging version identifier and non-secret
binding/config fingerprint. Under A6, open only the approved canonical HTTPS URL:

- Without a Jalisco cookie, homepage and Logistics/Leaflet map load. Tile-provider
  domain authorization may be separately required; that is a separate approved
  map-provider action, not permission to change the map or embed a secret.
- `/login`, `/signup`, `/forgot-password`, `/verify-email` load directly and on
  refresh. An HTML dashboard shell returning 200 is NOT authorization evidence:
  its protected API must deny an anonymous request with 401 when configured.
- Expected auth APIs must reach the Worker and return JSON with `no-store`, not
  static SPA HTML. A 503 for missing configuration is fail-closed, not a passing
  login/role test.
- Verify cookie NAME/FLAGS only: `__Host-jalisco-session`, Secure, HttpOnly,
  SameSite=Lax, Path=/, no Domain. Inspect no provider tokens in application
  responses/storage/URLs. Do not export HAR, traces, storageState or cookie jars.

### 7. Manual verification matrix (all live rows NOT PERFORMED)

Use owned disposable users, isolated browser contexts and a bounded A6 test plan.
Keep passwords, codes and cookie jars only in private test memory/vault, never
console output, saved request examples or reports. An approved ephemeral harness
may replay HttpOnly cookies internally; browser page JS cannot read them. Do not
add a debug token endpoint. Record only alias, UTC time, case ID, HTTP status,
provider event category, generation-change outcome and pass/fail/blocked.

| Case | Steps | Expected result / evidence |
| --- | --- | --- |
| P1 — producer signup | Submit invalid fields, then valid owned producer address/name/farm/country/password. | Invalid inputs create no session. Accepted request gives conditional email guidance, not a claim that an account/email definitely exists or arrived. |
| B1 — buyer signup | Repeat with a distinct buyer mailbox and company. | Same validation/guidance policy; no producer access implied. |
| E1 — confirmation | Open delivered link, choose Confirm my email, enter email and current signup code. | Link is exact HTTPS `/verify-email` without tokens in URL; verification establishes cookie; onboarding opens. Confirmed email is not farm/business verification. |
| E2 — pre-verification login | Try correct password before confirming owned mailbox. | No authenticated application session (provider rejection typically 400; an unconfirmed identity granted by provider is rejected by app with 403). |
| E3 — OTP expiry/reuse | Record configured expiry; let a code expire. Request another, use once, then repeat it. | Expired/reused code rejected (normally 400), no new session. Preserve timestamps; do not infer expiry from the hardcoded mock sentinel. |
| E4 — wrong purpose | Submit a signup code as recovery and a recovery code as signup. | Rejected; no wrongly scoped session. Then verify with the correct purpose if provider has not consumed/invalidated the code. |
| E5 — resend/duplicate | Test resend and duplicate signup with known/unknown owned addresses; test a later resend failure after earlier acceptance. | Non-enumerating guidance for accepted/existence cases; no stale success guidance on failure; validation/config failures remain errors. Compare statuses and timing under identical cooldown conditions. |
| O1 — onboarding | Finish producer/buyer onboarding independently. Attempt to change role afterward through POST `/api/auth/onboarding`. | Correct role entry point; later role change 409. No verified supplier/inventory/order claims. |
| L1 — login | Use correct and incorrect passwords for both aliases; repeat login in the same context. | Correct login establishes role-appropriate session; incorrect login does not. Re-login rotates the cookie; prior same-browser cookie fails on the protected API. |
| A1 — authorization | Direct GET `/api/producer/dashboard` and `/api/buyer/dashboard` as anonymous, producer and buyer. Modify only browser role/storage presentation. | Anonymous 401; own role 200; opposite role 403; client changes cannot grant access. |
| S1 — logout | Retain old cookie privately in test memory, sign out, replay it. Also test with a controlled provider outage in the fault harness. | Logout 200/cookie cleared if D1 is available; replay 401; provider availability is not required for local logout. Other devices remain signed in by design. |
| S2 — expiry | Wait the configured session lifetime or provider expiry using a disposable session; do not alter a real staging clock/SQL row to fake a pass. | Expired session 401. Normal cap ≤1 hour, recovery cap ≤10 minutes. No automatic refresh. |
| R1 — recovery request | Request recovery for existing/nonexistent owned addresses. Inspect actual delivered template for the existing address. | Same conditional guidance; existing address receives code if service accepts/delivers it. No token fragments. Config/delivery failures are not logged as success. |
| R2 — recovery scope | Verify recovery OTP, then request either dashboard or onboarding before resetting. | 403; recovery proof cannot become ordinary business access. |
| R3 — reset success | With another normal session already open, set a strong new password from recovery. | Reset success only after provider update and DB completion; old sessions fail, old password fails, fresh new-password login works. Record generation outcome without session/token values. |
| R4 — local validation | Submit <12-character password to reset, then correct it. | 400 before claim/provider update; proof is not burned merely for invalid local shape. |
| C1 — simultaneous reset | From one verified recovery context, an approved in-memory harness sends two concurrent reset POSTs with the SAME cookie and same strong new password. | Exactly one claim/provider update; normally one 200 and one 401/409; later replay 401. Confirm one provider event when observable. If telemetry cannot establish event count, mark that evidence unverified. |
| C2 — delayed login | In the local deterministic suite/fault harness pause login before provider return and before/after INSERT while another reset completes. | Delayed issuance 409/no cookie, or an already-issued stale cookie cannot authorize (401). A fresh post-reset login succeeds; unrelated user's first login remains valid. Do not claim a live race test without controlled barriers. |
| F1 — provider rejection | Use synthetic contract tests for provider 400/401/403/422/429/5xx and unknown codes. If approved, reproduce a safe policy rejection using only a disposable account. | Known validation → safe 400; configuration/unknown/5xx → safe 503; 429 → cooldown. Email forms stay populated and do not show acceptance on errors. Raw provider detail is absent. |
| F2 — definitive reset failure | After a valid recovery code, make a controlled provider password-policy/rate-limit rejection. | Proof consumed; previous sessions revoked; finalization releases normal-login block if DB succeeds. Fresh code required for another reset. UI hides consumed form and does not claim success. |
| F3 — uncertain cross-system outcome | Use the existing local fault tests or a separately approved disposable fault build for transport timeout, provider 5xx, lost claim reply and failed/lost finalization reply. | See failure-policy table above. No reused recovery proof or stale session is authorized. Do not kill a shared DB/provider or disable security triggers to simulate failure. |
| T1 — POST budget | With a dedicated test IP, empty/new fixed window and explicit request budget, send at most 31 valid-JSON POSTs to `/api/auth/login` containing invalid email (no credentials). | First requests fail validation without provider calls; the first over-budget request is 429 with Retry-After. Earlier activity/window rollover may change the count; record it, don't reset limits with SQL. |
| T2 — session/upstream budget | Verify 60/minute session budget in the deterministic test; stage measurements only within approved upstream quotas. | Over-budget checks do not contact provider; logout remains usable. Upstream may throttle earlier: that is not evidence that 60 real-provider checks succeeded. No trusted-IP forwarding claim. |
| G1 — public regression | Log out; check desktop/mobile homepage, tabs, markers/popups, GIS layers and illustrative 2.5D effects. | Public functionality remains accessible; no auth requirement or visual redesign. Report tile-domain authorization separately. |

Deterministic ordering/failure guarantees are exercised locally; OTP expiry,
one-time-use, password verification, SMTP delivery and provider revocation are
ultimately provider responsibilities and need real disposable-project evidence.
Do not repeatedly spam unknown addresses or intentionally exhaust shared SMTP or
provider limits. A fault-test build/upstream needs A7, its own isolated route and
no real-provider credentials; it is NOT the normal staging release. Do not attach
it to the production or shared staging Worker. Never disable generation/claim
checks to make a live test easier.

### 8. Troubleshooting and rollback (A7 for remote intervention)

| Symptom | Safe investigation / response |
| --- | --- |
| Auth 503 / public site still loads | Check non-secret binding names, target IDs, key-format provisioning outcome, schema and provider service status. Do not print the encryption key or upstream body. Configuration failures must not be treated as accepted email requests. |
| Origin 403 / cookie missing | Compare actual browser origin with exact AUTH_ORIGIN; check HTTPS, hostname, no trailing slash, cookie flags and outer test gate. Do not allow `*`, remove Origin checks, or weaken Secure/SameSite to fix it. |
| Dashboard HTML loads but API denied | Expected for an unauthenticated SPA shell. Evaluate JSON API status and stored role, not page title. Wrong-role 403 is a security pass, not a reason to edit role data. |
| No email / invalid or expired code | Check staging sender DNS, recipient policy, quotas, saved templates, exact hostname and actual configured expiry. Use a fresh code with correct purpose. Do not log codes or promise delivery based on HTTP 200 alone. |
| 429 | Respect Retry-After and fixed windows; separate app IP/session quotas from upstream egress/project quotas. No arbitrary forwarded-IP header or limiter bypass. |
| SQL/missing migration/duplicate column | Stop staging traffic; inspect ledger and schema names. Do not rerun 0003 blindly, mark it applied manually, or remove triggers. Repair/replace only the approved disposable DB with a reviewed plan. |
| Generation conflict 409 | Discard in-flight authentication and sign in/request a new code. Do not retry a consumed OTP automatically or decrement generation/revision. |
| Reset 503 / password outcome unknown | Do not assume the password was unchanged or changed. Retire the recovery proof. Keep the account isolated; reconcile safe provider event categories and generation/block state with the owner. Wait at least the two-minute lease; expiry alone never unlocks normal login. Use a fresh verified recovery code for a new reset. Repeated uncertainty requires operator review, not repeated password writes or manual SQL unblocking. |
| Provider updated, D1 finalization failed/lost reply | A pre-commit failure can leave login blocked; a committed finalization with lost response can already have advanced the fence and unlocked fresh login. Both must reject old sessions. Distinguish these with approved metadata inspection, not token dumps. A late upstream operation may outlive the HTTP timeout; two minutes does NOT prove it ended. |
| Key mismatch after redeploy/rotation | Stop testing. Restore the approved matching vault version only under A3/A7, or provision a fresh disposable DB/key and re-onboard test users. Do not weaken crypto. A new key invalidates ciphertext, and changing the key back can revive rows unless the revocation plan also handles them. |

Rollback order:

1. Freeze tests and restrict only the staging route/test-team access after A7.
   Preserve sanitized timestamps, source/config version and migration ledger.
   Do not export cookies, passwords, tokens, OTPs, HAR or full traces.
2. A code rollback is permissible ONLY to a reviewed version compatible with
   migration 0003 and its generation/claim guarantees. Never roll back to the
   pre-fix Worker: it ignores the new revocation guarantees. On first deployment
   there may be no safe predecessor; keep staging closed and fix forward instead.
3. Do not undo migration 0003 with DROP statements, decrease clock/generation,
   unclaim cookies or restore old auth tables while serving traffic. Restoring a
   DB backup can resurrect revoked sessions, rolled-back generations and consumed
   proofs. D1 backup restore also cannot restore Supabase passwords/sessions.
4. For a disposable environment, prefer an approved NEW empty staging D1, apply
   0001–0003, use a NEW approved encryption key, and re-onboard disposable users.
   This is an A2/A3/A4/A5/A7 operation, not an automatic fallback. Quarantine the
   old DB/key so it cannot be rebound accidentally. Supabase test users/passwords
   still need independent reconciliation; a DB replacement does not undo them.
5. Stop for any uncertain cross-system outcome. An authorized operator must
   confirm the provider state and absence of pending requests before declaring
   recovery complete. Use fresh email proof, never a hand-edited browser state or
   direct generation reset. No atomic rollback across Supabase and D1 is claimed.
6. Re-run applicable matrix rows after a repair. Separate approval is required
   before deleting staging users, SMTP credentials, D1, Worker, DNS/Access routes
   or vault entries. Verify exact staging IDs again; production remains excluded.

### 9. Evidence status and final manual checklist

| Evidence | Status when this runbook was prepared |
| --- | --- |
| Code/config/migrations/package scripts and Git state | Inspected locally in this documentation task. |
| Prior local checks | Recorded earlier: 32 existing tests, 35 auth tests, 19 browser tests; lint/typecheck/build/diff checks passed. NOT re-run for this documentation-only task. |
| Actual local D1/runtime | Earlier disposable-runtime test passed; no live Supabase involved. |
| Remote account/project/SMTP/DNS settings | NOT contacted or verified. |
| Staging config, key, provisioning, migration, deployment | PLAN ONLY; not created/executed by this task. |
| Every live matrix case | NOT PERFORMED; no production or disposable remote test traffic sent. |
| Current documentation change | Only this file's runbook and its local wording corrections; no app/config/migration/test changes. |

Manual completion checklist — leave every remote item unchecked until approved
and actually performed:

- [ ] Preserve the dirty tree; confirm branch and reviewed source/config fingerprints.
- [ ] Obtain A0 scope/read-access approval with exact non-production targets, owners and budgets.
- [ ] Obtain A1; create separate Supabase/SMTP settings, exact OTP templates/allowlist and owned recipients.
- [ ] Obtain A2; provision isolated Worker/D1/hostname and test-team restriction; disable alternate URLs.
- [ ] Prepare/review the separate staging config; replace ALL placeholders consistently; keep local config untouched.
- [ ] Obtain A3; generate/validate/import the key without displaying it; set the three staging server secrets and verify names/exit codes.
- [ ] Re-run local tests/build; review artifact contents and record results separately from live results.
- [ ] Obtain A4; verify DB target/backup plan, apply pending migrations in order and inspect schema/ledger; notify testers that 0003 invalidates existing sessions.
- [ ] Obtain A5; deploy only the approved staging artifact/config and confirm exact HTTPS/API/static routing.
- [ ] Obtain A6; run and record each applicable matrix case with disposable accounts and bounded mail/request volume.
- [ ] Obtain A7 before fault injection, remote repair, rollback, key rotation, DB replacement or cleanup; never weaken generation/claim controls.
- [ ] Resolve all failures/uncertain states; mark unperformed or inconclusive cases honestly; get owner sign-off before any wider staging access.
- [ ] Keep production unchanged. Any future production operation needs a new, separately reviewed plan and explicit approval.

## Staging link repair — 2026-10-22 (supersedes earlier OTP-only callback notes)

Observed defects and evidence:

1. The frontend previously inspected only fragment `access_token` with `type=signup`; it ignored query `token_hash`, rejected recovery fragments as “not an email confirmation link”, and did not handle PKCE `code` callbacks explicitly. Signup and recovery both targeted the same unqualified verification page. Local mail templates were OTP-only; their installed remote counterparts have not been inspected.
2. Provider `invalid_credentials`, unconfirmed email and OTP expiry previously shared a generic public message. Password sign-in errors are now distinct from link/code failures. User-reported historical `400 invalid_credentials` belongs to password login, not proof that a confirmation link failed.
3. A live test with a well-shaped, unissued synthetic hash returned app HTTP 503. A short-lived staging Worker tail captured ONLY the fixed safe fields `endpoint=verify`, `status=403`, `category=otp_expired`. No request URLs, bodies, token values, cookies or raw logs were printed or retained. This is direct evidence of the current provider response via Worker diagnostics, NOT access to historical Supabase Auth logs. GoTrue's specific 403 otp_expired response was incorrectly classified as an API/configuration outage. It now maps to verification HTTP 400; key/configuration failures remain 503.
4. An actual password login with the approved test buyer's locally generated credential succeeded (200), normal buyer session lookup succeeded (200), and its own session was logged out (200). This establishes that this account is confirmed/onboarded and that its generated credential works; it does not explain what credentials a past caller entered.

Implemented changes:

- `src/authLinks.ts`: centralized untrusted query/fragment parsing. Signup/email aliases normalize to signup. Recognizes query token_hash with explicit signup/recovery purpose, keeps implicit signup callback compatibility, rejects conflicting/malformed/unsupported link actions, handles provider errors without echoing descriptions, and distinguishes PKCE authorization codes from numeric email OTPs.
- `src/components/AccountPages.tsx`: scrubs sensitive query/fragment parameters before callback requests; runs the callback once under React StrictMode; selects recovery purpose correctly; routes verified signup to onboarding and verified recovery to reset-password. Context-specific errors replace misleading blanket “not an email confirmation link”.
- `worker/index.ts`: adds POST `/api/auth/confirm-link`, exchanging `{token_hash,type}` with the provider before local session creation. Captures the existing authentication revision before exchange, validates the returned token/user, preserves cookie protections and previous-session replacement. Only provider-verified recovery hashes or existing recovery OTPs can establish recovery authority. Staging recover requests now use `/verify-email?purpose=recovery`; production request configuration remains unchanged.
- `worker/provider.ts`: separates password errors, unconfirmed email and invalid/expired/used verification proof errors, including actual 403 otp_expired. Provider/API configuration failures continue to fail closed; no raw provider text is exposed.
- `index.html`: no-referrer meta policy prevents authentication query values from being sent as resource/fetch referrers. History is scrubbed by the callback page. Do not log initial callback URLs at the platform level, since query proofs are sensitive.
- Staging email templates: signup links use `/verify-email?token_hash={{ .TokenHash }}&type=signup`; password-reset links use the same endpoint with `type=recovery`. Both retain matching numeric OTP fallback. These source templates are prepared only; no remote template was overwritten and no mail sent.
- Tests updated/added in `tests/auth-links.test.mjs`, `tests/browser/auth-links.spec.ts`, existing auth/browser/isolation suites and the disposable provider fixture.

Security/compatibility limits:

- A bare implicit recovery access token plus client-provided `type=recovery` is NOT treated as proof of recovery purpose. Accepting it would let a caller relabel a normal token to authorize password changes. Legacy recovery fragment users receive instructions to request the recovery-code/hash flow.
- This application does not initiate PKCE or store a PKCE verifier. A `?code=` callback therefore fails with an explicit missing-verifier message; it is never guessed, treated as an OTP or exchanged without its verifier.
- Supabase uses the same otp_expired classification for invalid, expired or already consumed proofs. The message deliberately lists these possibilities; it does not pretend to distinguish expiration from reuse.
- Existing implicit signup compatibility still validates the provider access token. One-time link reuse is enforced by the provider's hash/OTP exchange; a still-valid access token is not claimed to be a one-time proof.

Required remote configuration review (NOT applied):

Project must be `heaswpawzuuijxurlfoz`, never the production project. Verify Site URL is `https://jalisco-auth-staging.yukikato123123123.workers.dev`. Allow exact redirects:

- `https://jalisco-auth-staging.yukikato123123123.workers.dev/verify-email`
- `https://jalisco-auth-staging.yukikato123123123.workers.dev/verify-email?purpose=recovery`

Install the two staging email templates only after confirming current templates/settings. The second redirect is also prepared in `staging/isolation-plan.json`. Do not reset secrets or change production redirect/template/SMTP settings. Read historical Auth logs for the reported event using sanitized timestamp, endpoint, status and error code only. Supabase management app is available but unconnected in this session; historical logs and installed Site URL/redirects/SMTP/templates cannot currently be independently inspected.

Reference specifications: https://supabase.com/docs/guides/auth/auth-email-templates , https://supabase.com/docs/reference/javascript/auth-verifyotp , https://supabase.com/docs/guides/auth/sessions/pkce-flow .

Validation:

- Final typecheck/lint/build/diff checks passed. Existing Vite >500 kB bundle advisory remains nonfatal.
- Auth suite: 48 passed, including valid one-time signup/recovery proofs, wrong purposes, expired/reused hashes, secure recovery authority, password reset consumption, distinct password/unconfirmed-email errors and the actual-observed 403 otp_expired classification.
- Full browser suite: 36 passed; final six callback cases rechecked after referrer-policy changes and passed. These use synthetic callbacks, not actual mail.
- Existing prototype: 32 passed. Producer/buyer SQLite/API: 5 passed. Deployment config, staging check and dry-run passed.
- Actual first repaired deployment: valid password login 200; wrong password 400 with distinct login message; subsequent session remained 200; malformed/wrong-action proofs rejected 400; logout 200; stale own-session cookie rejected 401. A synthetic invalid proof revealed the 503 defect above, which triggered the additional narrow provider classification fix.
- Actual deployed browser: unsupported action, missing-PKCE-verifier and provider-expiry error handling displayed the correct messages, scrubbed URL values and exposed no referrer; legacy recovery purpose was selected with accurate guidance. A same-document navigation assumption in the initial probe was corrected with a fresh navigation/reload and the recovery guidance check passed.
- Real valid/expired/replayed email links and real password-reset delivery were not exercised: no emails or password changes were authorized for this diagnosis, and installed remote templates/settings remain unverified. No real-mail success is claimed.

No production deployment, database migration, account creation/deletion, user profile/item changes, secret/key rotation or Git staging/commit/push occurred. Only approved test-account sessions were created and revoked for login checks. No generated credential or real token was printed.

Final staging deployment and real recheck:

- Final active release reported by Wrangler: `5e466b97-94ab-4fd6-8092-da190a66a8c7` at `https://jalisco-auth-staging.yukikato123123123.workers.dev`. The earlier intermediate `de2ce31b-bc3d-42c9-8488-3e24de431b9e` was superseded to fix the live-discovered 403 classification defect. Both releases followed a report of changes/tests/configuration prerequisites; no remote Supabase setting was changed.
- Final deployed real-provider verification of a synthetic, unissued, well-shaped hash: HTTP 400 with “invalid, expired or already used” guidance (previously 503).
- Final approved buyer password login 200, normal session 200, own-session logout 200, stale own-cookie buyer API request 401. The approved test buyer is confirmed and onboarded; the earlier lack-of-buyer-session blocker no longer applies to this account. Its generated private credential remains available in the ignored mode-600 acceptance state; it was not printed. A second isolated test identity has not been authenticated in this diagnosis.
- Source changes and prepared staging templates are complete and deployed as applicable. Historical Supabase Auth logs, installed template/redirect settings and actual new-mail confirmation/recovery end-to-end tests remain pending management access and a separately authorized email test. Do not resend the prior signup just because old documentation describes that account as unconfirmed.

## Remaining real-email acceptance attempt — 2026-10-22

The user authorized one new confirmation-email request and one recovery-email request for the approved staging test account, with user-operated mailbox/link opening. Current deployed version remains `5e466b97-94ab-4fd6-8092-da190a66a8c7`; no source change or redeployment was performed.

Management access was checked again: no connected Supabase tools, available Supabase plugin not installed/connected, and no Supabase management credential available in the process environment. Therefore actual Site URL, redirect allowlist, installed templates, SMTP/quota configuration and historical Auth logs could not be read or modified. Desired settings remain those specified in the preceding repair section and the two source templates. Local file values are not evidence of remotely saved settings.

Actual requests, each sent once to `operator@example.test` through the existing staging Worker flow:

- POST `/api/auth/resend`: HTTP 200, conditional “If this address is eligible…” response. Delivery and a fresh confirmation proof are NOT verified. The account is already confirmed/onboarded, so a successful response need not produce a new confirmation message.
- POST `/api/auth/forgot-password`: HTTP 429, safe code `email_rate_limited`, message “Too many attempts. Please wait before trying again.” Recovery delivery was not successful/verified. No retries or alternate mail path were attempted.

A private mode-600 attempt ledger prevents duplicate execution of this exact test batch. No token, link, cookie, password or rendered mail body was recorded. The user was asked only to inspect the approved mailbox and, if a new confirmation mail exists, open its link and report the displayed outcome. No code or link was requested in chat.

Current acceptance outcomes:

- Exact desired URL/template values cross-checked with code: PASS locally.
- Actual Supabase configuration read/write: BLOCKED by unavailable management access.
- Confirmation request: accepted HTTP 200; actual delivery/link success BLOCKED pending mailbox evidence.
- Recovery request: FAIL HTTP 429 email_rate_limited; no resend.
- Real successful, expired and reused confirmation/recovery links: BLOCKED, not replaced with synthetic tests.
- Actual recovery password change and subsequent login: BLOCKED by recovery delivery failure. No test password was changed.

Next prerequisites: connect Supabase management access for staging ref `heaswpawzuuijxurlfoz`, inspect/apply the exact desired URL/template settings only if needed, diagnose the email quota/provider configuration without changing secrets, and obtain a fresh authorized delivery test after the limit is resolved. Do not assume a short Retry-After guarantees an SMTP/project quota reset. Do not alter existing confirmed status or create an extra account merely to force a confirmation test. Existing user/profile/produce data, production, secrets and session keys were untouched; no Git staging/commit/push occurred.

## Read-only mail non-delivery diagnosis — 2026-10-22

Scope: documentation and existing local evidence only. No new staging authentication requests, email sends, configuration changes, deployments, password changes or user/data updates were made. Only this diagnostic section was appended. Existing uncommitted files were preserved.

### Confirmed evidence

- Approved recipient: the previously created test buyer. Earlier real provider-validated login/session results established that this account was already confirmed and onboarded before the resend attempt.
- Private attempt ledger: confirmation resend at `2026-10-22 06:32:57 UTC` (13:02:57 Asia/Rangoon) returned HTTP 200. Recovery at `06:32:59 UTC` (13:02:59 Asia/Rangoon) returned HTTP 429 with `email_rate_limited`. Each was attempted once; no later resend was executed here. The user reports the confirmation email did not arrive.
- Worker signup/resend responses intentionally use a conditional eligibility message. HTTP 200 does not establish that the provider generated or delivered a message.
- `worker/provider.ts` maps provider HTTP 429 with `over_email_send_rate_limit` to internal `email_rate_limited`; `worker/index.ts` exposes that safe code for staging. The Worker's own per-IP request limiter does not produce this code. The recorded recovery failure therefore identifies a provider email-send restriction, rather than evidence of a broken callback or the Worker IP bucket.
- Supabase management discovery again found the plugin available but not installed/connected, no connected Supabase tools, and no management credential in the process environment. Historical Supabase Auth logs, installed SMTP settings, email limits, signup-confirmation settings and delivery records were NOT read. No attempt was made to expose or extract Worker secrets to bypass management access.
- `staging/isolation-plan.json` contains desired configuration and stale preparation placeholders. Its null mail-service fields do not prove that remote custom SMTP is absent; its requested confirmation/expiry values do not prove those settings are saved remotely.

### Likely explanations, not project-log confirmation

1. Confirmation resend most likely performed the provider's intentional no-op for an already-confirmed account. Supabase Auth's published `resend.go` returns HTTP 200 without sending a new signup-confirmation message when `user.IsConfirmed()` is true. This matches the known account state, request result and user-observed non-delivery. The project's exact provider version and transaction logs remain unavailable, so this is a strongly supported explanation rather than a directly inspected transaction. Do not unconfirm/reset/delete the account to force a message.
2. Recovery was rejected by the provider email-send limiter. The precise configured allowance, consumption window, other project traffic and whether a project quota or recipient frequency restriction was decisive cannot be recovered from the recorded safe response alone.
3. If built-in SMTP is active, Supabase's current documentation describes a very low project email allowance (2 messages/hour) and delivery restricted to project-team addresses. This is conditional documentation, NOT a finding that this project uses built-in SMTP, that either test recipient is unauthorized, or that its actual allowance equals 2/hour.
4. Custom SMTP provider suppression/bounce/quota, sender-domain authentication and mailbox filtering remain alternative unverified causes only if provider logs show a message was actually dispatched. No evidence currently establishes an SMTP credential failure or a Gmail deliverability problem. Redirect/template errors affect link processing; they do not by themselves explain a message that was never sent.

### Exact read-only checks required from the project administrator

Open only staging project `heaswpawzuuijxurlfoz`:

- Auth logs: inspect `/resend` and `/recover` around the two UTC timestamps above. Record status/error code and whether a send/audit/message event exists. Distinguish `over_email_send_rate_limit` from ordinary IP/request limits, SMTP errors and recipient-authorization failures. Inspect timestamps/status/message IDs only; do not share rendered email links, tokens, request credentials or raw sensitive payloads.
- Auth → Users: confirm the approved test buyer's email-confirmed status as it existed at the resend time. Do not alter it. A new confirmation-flow test later requires a separately authorized unconfirmed test account, not an already-confirmed user's reset state.
- Auth email provider/SMTP settings: determine whether built-in delivery or custom SMTP/Send Email hook is active. For custom SMTP, check that host, port/TLS, sender name/from address and credential-configured status are correct. Do not display/export `smtp_pass`, API keys or other secret values. Check provider delivery/suppression/bounce logs and verified sender-domain status only if a send exists. For built-in delivery, verify the recipient is permitted by the project's team-address restriction.
- Auth rate limits: read the actual `rate_limit_email_sent` value and any email/resend frequency setting (`smtp_max_frequency`), relevant recent send totals/window and external provider quota if applicable. Do not increase limits, switch providers or replace credentials in this diagnostic task; do not assume a 60-second client timer proves the allowance is restored.
- Email signup settings: check email provider enabled, Allow new users to sign up appropriate for staging (`disable_signup=false`), and Confirm email enabled (`mailer_autoconfirm=false`). These are expected values to verify, not current remotely observed settings. Do not disable confirmation to make tests pass.
- URL/template consistency, read-only: Site URL should be `https://jalisco-auth-staging.yukikato123123123.workers.dev`; redirect allowlist should contain `/verify-email` and `/verify-email?purpose=recovery` at that exact origin. Confirm Signup should use the staged template's token_hash link with `type=signup`; Reset Password should use `type=recovery`. Both source templates retain a matching numeric-code fallback. Do not overwrite remote templates or settings during this read-only diagnosis.

### Outcome and next action

Local-evidence diagnosis and documentation: COMPLETE. Recovery email restriction: CONFIRMED by the recorded response and code mapping. Confirmation no-op: LIKELY, supported by confirmed-user state and published provider behavior. Actual Auth/SMTP/settings/log inspection: BLOCKED by management access. Delivery repair and real successful/expired/replayed-link/password-reset acceptance: NOT COMPLETE. An administrator must perform the read-only checks above or connect authorized Supabase management access. No additional email should be sent in this task.

Primary references (checked for this diagnosis):

- https://github.com/supabase/auth/blob/master/internal/api/resend.go — already-confirmed signup resend returns 200 without a send.
- https://supabase.com/docs/guides/auth/auth-smtp — built-in SMTP recipient restrictions and low allowance; custom SMTP configuration.
- https://supabase.com/docs/guides/auth/rate-limits — email-send limits and `rate_limit_email_sent`.
- https://supabase.com/docs/guides/auth/debugging/error-codes — `over_email_send_rate_limit` classification.

## Standard implicit recovery callback repair — 2026-10-22

This section supersedes earlier statements that implicit recovery is a legacy/unsupported flow or always requires changing the email template. The earlier application-level rejection was incorrect.

### Root cause verified against upstream behavior

The supplied email format `/auth/v1/verify?token=…&type=recovery&redirect_to=…/verify-email?purpose=recovery` is a supported Supabase implicit flow. Upstream `verify.go` validates/consumes the original email proof, issues an OTP-authenticated access/refresh session, and redirects to the app with fragment parameters including `access_token` and `type=recovery`. The application must consume that resulting session, not attempt to reverify the already-consumed email proof. The query `purpose=recovery` supplies route context; it does not itself prove authentication. The observed redirect reached the intended application route; the immediate cause of this symptom was our parser's deliberate recovery-fragment rejection and the callback's signup-only handling, not evidence of a bad redirect allowlist.

Current upstream issues implicit verification sessions with AMR method `otp` for signup as well as recovery. A recovery-specific AMR value must not be invented or assumed. The fix checks the provider-validated identity and recent OTP authentication, while URL type chooses the app's limited recovery workflow. It does not claim OTP identifies an email action uniquely.

Primary specifications:

- https://supabase.com/docs/guides/auth/sessions/implicit-flow
- https://raw.githubusercontent.com/supabase/auth/master/internal/api/verify.go
- https://raw.githubusercontent.com/supabase/auth/master/internal/api/middleware.go

### Implementation

- `src/authLinks.ts`: accepts supported recovery access-token fragments alongside existing signup fragments and token_hash links; retains malformed/conflicting/purpose/expiry errors and PKCE-verifier checks.
- `src/components/AccountPages.tsx`: sends the actual parsed purpose to the callback, scrubs URL credentials before network activity, and sends a successful recovery callback to `/reset-password`.
- `worker/implicitRecovery.ts` (new): ONLY after the configured Supabase `/user` endpoint validates the exact bearer token, reads its claims and checks subject, exact project issuer, expiry and a recent OTP/recovery AMR entry. A normal password-authenticated token cannot be relabeled to gain a local recovery session. Parsed claims alone are never treated as signature verification. Recovery authority lasts at most ten minutes and is bounded by OTP age and access-token expiry.
- `worker/index.ts`: accepts recovery callbacks after provider verification and claim checks; reserves a namespaced, nonreversible proof identifier atomically in existing `auth_limits` storage until the JWT expiry. This prevents concurrent/replayed callback use, including after reset/logout. The existing expiration cleanup removes old reservations. A storage/session-creation failure burns the proof rather than permitting replay. No migration or remote schema change is required. Signup and hash/OTP confirmation flows remain supported.
- The existing `/api/auth/reset-password` continues to use the verified encrypted provider token for Supabase PUT `/auth/v1/user`, with existing atomic recovery claim, generation fence, one-use reset, session/cookie clearing and uncertain-outcome handling. No real password was changed in this task.

### Tests and limits

- Tests in `tests/auth-links.test.mjs`: valid provider-validated JWT-shaped implicit callback; recovery-only local session; synthetic provider password update and subsequent login; malformed/expired/stale/forged/wrong-project/wrong-subject/password-authenticated tokens; expiry caps; concurrent/replayed proof rejection.
- `tests/auth-d1.test.mjs`: added real local workerd/D1 callback parsing and atomic concurrent reservation check, without a live provider. Provider acceptance is modeled by exact issued-token lookup, not by trusting arbitrary modified claims.
- `tests/browser/auth-links.spec.ts`: a Supabase-shaped verify URL redirects via 303 to a recovery fragment, opens the new-password form, posts reset, and signs in with the changed synthetic password; expired/reused recovery errors tested separately. External provider/API responses are intercepted for this regression suite; it is not live-email evidence.
- `tests/browser/auth.spec.ts`: removed the old expectation that every implicit recovery callback must fail as legacy. Other malformed-link coverage retained.
- Authentication suite: 51 passed. Full browser suite: 38 passed. Typecheck, lint, build, staging config check, deployment configuration tests and staging dry-run passed. Existing Vite >500 kB asset advisory remains nonfatal.

No production changes, secrets/key changes, real user password changes, new accounts, email sends, Git staging/commit/push or remote migrations were performed. Actual delivered-mail-to-Supabase-password-change end-to-end validation remains unperformed because this task explicitly prohibits changing a user's password. Staging deployment status is recorded separately after final checks.

Final status for this repair: source/build preparation complete; staging redeployment is REQUIRED to replace the deployed `5e466b97-94ab-4fd6-8092-da190a66a8c7` behavior. No deployment was performed in this repair turn. Final added real local workerd/D1 concurrency coverage passed within the 51-test auth suite. Existing prototype tests (32) and producer/buyer API tests (5) also passed. No live recovery token, email send or password-update request was used. The claim parser comment was clarified to say OTP proof rather than assuming email-specific AMR semantics.

## Staging recovery deployment and interaction review — 2026-10-22

This record supersedes the preceding repair turn's “redeployment required” status. After reviewing the pending implicit recovery changes, deployed using the documented command `WRANGLER_SEND_METRICS=false npx wrangler deploy --config ./wrangler.staging.jsonc`. Cloudflare reported version `d6b2c7b8-b38c-4ead-80d3-ba6250dfb153` at https://jalisco-auth-staging.yukikato123123123.workers.dev. The previous version was `5e466b97-94ab-4fd6-8092-da190a66a8c7`. No migrations or secret changes were needed.

UI changes this turn: `src/components/account.css`, `src/styles.css`, `src/components/AccountPages.tsx`, `src/components/ProducerDashboard.tsx`, `src/components/BuyerCenter.tsx`, and `src/components/ExploreProduce.tsx`. Warm ivory/forest/sage surfaces, clearer typography and spacing, primary/secondary/destructive buttons, visible radio-card selection, keyboard focus, checkbox alignment, input validation states, status notices, touch targets, reduced motion and narrow-screen layout share one visual hierarchy. Workspace copy explains public visibility without API jargon. Existing submit labels and authentication behavior are retained. Added three UI behavior tests in `tests/browser/controls.spec.ts`. One initially failed: resetting unsubmitted search filters left edited input values when the URL was already empty. Fixed by explicitly resetting the form before resetting URL/search state. The final complete browser run passed.

Actual checks: authentication 51/51; browser 41/41 (all previous 38 plus three new); prototype 32/32; producer/buyer API 5/5; deployment config suite 1/1. `npm run check:staging`, `npm run test:deployment`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run dry-run:staging`, and `git diff --check` passed. Vite's existing >500 kB bundle advisory remains nonfatal. Browser provider contracts and successful password-update tests use isolated synthetic providers, not live accounts.

Postdeployment actual remote requests/browser results: public home, Explore, signup, recovery entry and reset entry return HTTP 200 and fit 390px/1440px without horizontal overflow. HTTP 200 for a page is not proof of authorized recovery. Role selection and resetting unsubmitted search filters work on deployed assets. Provider-style expired recovery arrival renders restart guidance. An intentionally invalid synthetic implicit recovery proof reaches the callback and is rejected HTTP 401 with sanitized session guidance, rather than the removed legacy-format rejection. Unauthenticated producer/buyer dashboard APIs return 401. The approved isolated buyer test account signed in with HTTP 200; buyer controls loaded and session survived a reload (session API 200); logout returned 200 and subsequent buyer dashboard API returned 401. No profile, shortlist, account password or existing business data was changed. The newly created acceptance-test session was logged out.

Deployed new-password screen presentation was also inspected after an implicit fragment, but ONLY with callback/session responses intercepted in a separate browser context. It displayed “Choose a new password” and “Update password”; no password was submitted. This is UI evidence, not a real Supabase recovery success. Actual delivered-mail → valid Supabase recovery session → password change remains unverified and was deliberately not executed under the restriction against actual password changes. No new emails were sent. Local screenshots and redacted acceptance results are in ignored `.wrangler/ui-review/`. No production changes, secrets/session-key changes or Git staging/commit/push occurred; previous uncommitted work was preserved.

### Final mobile header follow-up

The first remote visual review additionally found the retained public header squeezing the brand beside navigation on mobile. Added an <=800px single-column header layout in `src/styles.css` and a fourth UI regression test asserting separate brand/navigation bounds. Final browser total: **42/42**, retaining all previous 38. Re-ran build, lint, staging configuration/deployment tests and staging dry-run successfully. Deployed this verified follow-up to the same staging Worker; final version is **`2c661b0e-5691-4602-a8d2-c2391f56d00b`**, superseding the intermediate `d6b2c7b8-b38c-4ead-80d3-ba6250dfb153` version above. Worker authentication logic was unchanged in this CSS-only follow-up.

Public remote interaction checks at 390px and 1440px confirmed layer checkbox deselection/restoration, arrow-key tab selection, actual inquiry destination dropdown selection and no horizontal overflow. The inquiry form was not submitted. Two initial supplementary automation probes timed out because they targeted the header inquiry button intentionally hidden on mobile, then used an exact label that included select option text; using the existing Commercial tab's inquiry button and the actual named select completed these checks. These probe errors were not authentication or form-submission failures. No additional emails, password updates or business-data writes occurred.

Final-version remote header bounds also passed at 390px (navigation starts below the brand); both widths retained working map controls, tabs and dropdown, with no horizontal overflow. The final screenshot was visually reviewed. Remote result artifacts are `.wrangler/ui-review/public-controls.json` and `.wrangler/ui-review/live-results.json` (the latter records the same authentication Worker on the intermediate deployment).

Remaining external-map limitation: the final mobile screenshot showed Stadia basemap tiles displaying **401 Error / Invalid Authentication**. Local overlay controls and layer interactions passed, but this is not a fully healthy live basemap result. No map credentials, provider configuration or secrets were changed. The external tile-provider/domain authorization needs a separate check; the screenshot alone does not establish whether a missing domain allowlist or another provider authorization setting is responsible.

## Admin Console: server-only grants and audit (2026-10-22)

`/admin` uses `/api/admin/{overview,producers,buyers,products,inquiries,readiness,security}`.
Every endpoint runs the existing provider-verified HttpOnly session flow, rejects
recovery sessions, and checks an active `admin_grants` row for the verified subject.
Neither `user_metadata`, `app_metadata`, onboarding role, request body nor client
state can authorize administration. There is no HTTP grant-management endpoint.
D1 is accessed only through the Worker binding; Supabase stores authentication,
not these business tables. No service-role key is required or bundled.

Migration 0007 adds empty grants and append-only audit tables. No users receive
access through migration or deployment. The owner explicitly instructed **not to
automatically grant administrator privileges** in this task. A future bootstrap
requires a separate owner-approved identity decision, verification of that user's
confirmed subject in the configured Supabase project, and a trusted operator's
explicit grant in the matching D1 environment with `granted_by` and `granted_at`.
Do not grant the first user, derive authority from email text or metadata, or ask
for passwords/tokens in chat. Revocation is `revoked_at` on that trusted grant;
it is checked on every request and again atomically on every publication write.

POST `/api/admin/actions` accepts only a supported product visibility transition
or buyer unpublication, with target, expected previous state, new state and reason.
The SQL trigger performs grant/state validation, mutation and audit insertion as
one statement; a stale state, revoked grant or failed insertion rolls back all of
it. Audit includes server-generated ID/time, verified actor, target, before/after
states and reason. API callers cannot update or delete audit rows. Administrators
cannot publish buyers, grant consent, delete users or grant other administrators.

The console reports real profile/product/publication counts and stored profile
completeness. Draft counts do not imply an existing approval workflow. Inquiry
previews are browser-only; there is no persisted transaction, shipment, document,
image-management or inquiry workflow to administer. These sections state that
limitation explicitly rather than creating demonstration business records. Product
specifications remain owner-editable through the producer workspace; the console
inspects stored fields and manages visibility. No claim is made that Supabase
management settings/RLS or live email delivery were remotely audited in this task.

## 외부 시험 가입 전 관리자 점검 — 2026-10-22

### 현재 상태와 소유자 설정 절차

- 이번 점검은 관리자 권한 0명을 유지한다. 실제 사용자/업무 데이터, 마이그레이션,
  Auth 설정, 비밀값은 변경하지 않는다. 모든 쓰기 테스트는 합성 사용자와 폐기되는
  메모리 DB에서만 수행한다. 커밋·푸시·배포하지 않는다.
- 기존 문서에는 소유자 승인 후 신뢰된 운영자가 `admin_grants`를 설정한다는 원칙이
  있다. 하지만 소유자의 승인된 Supabase subject UUID, 실행 승인, 전용 bootstrap
  도구/소유자 본인확인 흐름은 없다. 현재 자동 설정 가능한 승인 절차는 아니다.
- 향후 별도 승인 시: (1) 소유자가 대상 환경과 자신의 기존 계정을 지정하고,
  (2) 신뢰된 Supabase 관리 경로에서 해당 프로젝트의 이메일 확인된 subject와
  소유자 신원을 대조하며, (3) 인증된 Cloudflare 운영자가 스테이징 Worker/DB와
  subject를 다시 확인하고, (4) 요청자·승인자·대상·사유·시간을 별도 변경 기록에
  남긴 다음 최소 범위의 명시적 grant를 수행해야 한다. 일반 가입, 이메일 문자열,
  클라이언트 role, 사용자 metadata, 첫 번째 사용자로 신원을 결정하면 안 된다.
- 이 절차의 실제 실행은 이번 범위 밖이다. 활성화 후 별도 승인된 실제 소유자
  세션으로 조회·최소한의 합의된 작업·감사 로그·권한 철회를 검증해야 한다.
  현재 `admin_audit`는 상품 상태/구매자 철회만 지원하여 관리자 권한 부여·철회의
  별도 이력은 기록하지 않는다. 권한 변경 감사는 승인된 외부 변경 기록으로
  보장하거나 향후 별도 승인된 스키마/도구 변경이 필요하다. 이번에 schema를
  변경하거나 소유자 grant를 생성하지 않는다.

### 로컬 구현 보완

- `/api/admin/accounts`와 Accounts 화면 추가: D1 `auth_users`/`profiles`를 조합해
  앱이 알고 있는 계정과 미완료 온보딩을 조회한다. Supabase 전체 가입자 목록이
  아니며, 아직 로그인하지 않은 Supabase 가입자는 표시할 수 없음을 명시한다.
  이메일, 세션·토큰·비밀번호는 조회하지 않는다.
- 생산자/상품·구매자·준비 상태는 가입 당시 값보다 저장된 최신 업무 프로필을
  우선한다. 구매자의 공개 동의 snapshot과 private 업무 프로필은 구분한다.
- 준비 상태에서 연락처 누락을 완료로 표시하지 않는다. 완료는 자체 입력 상태이며
  검증/인증을 의미하지 않는다. 감사 목록은 UUID 순서 대신 최신 시간순으로 정렬한다.
- 접근 확인 전 관리 메뉴/테이블을 표시하지 않고, 접근 거절 시 기존 데이터와 확인
  대화상자를 지운다. 작업 중 중복 제출을 동기적으로 막는다.
- DB 응답 유실 시 실제 commit 여부가 불확실할 수 있으므로 '적용되지 않았다'고
  단정하지 않고, 데이터와 감사 로그를 새로 확인한 뒤 재시도하도록 안내한다.

### 실제 데이터 대조와 접근 경계

스테이징 SELECT 결과: 관리자 grant 0, 활성 grant 0, 감사 이벤트 0, 계정 프로필 4,
앱이 세션을 발급한 subject 4, 온보딩 없는 subject 0, 생산자 계정/업무 프로필 각각 3,
구매자 계정 1·업무 프로필 0, 공개 상품 3, 동의된 공개 구매자 0. 공개 API 결과는
생산자 3·상품 3·구매자 0으로 일치했다. admin_action, admin_audit_no_update,
admin_audit_no_delete 트리거가 실제 DB에 존재한다. 비공개 개인 값은 출력하지 않았다.

라이브에서 `/api/admin` 및 overview/accounts/producers/buyers/products/inquiries/
readiness/security/actions GET은 모두 401이며 비공개 레코드를 반환하지 않는다.
`/admin`은 SPA 껍데기 자체는 HTTP 200이다. 인증된 관리자 데이터가 공개된다는 뜻은
아니지만, 페이지 URL 전체가 서버에서 401/403인 것으로 보고해서는 안 된다.
일반 로그인 사용자의 라이브 403은 기존 세션/자격증명을 쓰거나 새 세션을 생성하지
않았으므로 미검증이다. Worker+합성 인증 공급자 및 실제 로컬 workerd/D1에서는
일반 사용자 403, metadata 위조 거부, trusted grant만 허용, grant 철회 즉시 거부,
구매자 동의 보호, 변경/감사 atomicity, stale write 거부를 검증한다.

### 시험 가입 전 남은 차단 사항

1. 이번 로컬 수정은 배포하지 않았다. Accounts 등 개선 기능의 스테이징 사용에는
   별도 배포 지시와 배포 후 검증이 필요하다.
2. 운영자로 관리 콘솔을 실제 사용하려면 별도 소유자 신원 승인과 위의 통제된 권한
   설정/감사 절차가 필요하다. 관리자 0명 유지 자체는 가입 기능의 오류가 아니다.
3. 실제 일반 계정의 접근 거절 및 소유자 계정의 허용/철회는 승인된 live acceptance로
   남아 있다. 임시 DB의 성공을 실제 관리자 세션 성공으로 대체하지 않는다.
4. 외부 5~6명 가입의 이메일 확인/로그인/복구·공급자 메일 제한은 이번에 검증하지
   않았다. 관리 Auth/SMTP·테스트 메일함 확인과 실제 수신 검증을 별도 수행해야 한다.
5. 계정 잠금·삭제·Supabase 전체 가입자 목록, 문의 저장/발송, 이미지/문서/배송 관리는
   지원하지 않는다. 상품 관리 범위는 조회와 공개 상태 변경, 구매자 조작은 철회뿐이다.

검사 결과: 최종 lint·타입 검사·빌드·공백 검사 PASS, Node 회귀 188개 PASS,
브라우저 회귀 89개 PASS. 브라우저 권한 화면 검사는 API 응답 stub을 사용하고,
서버 권한/원자성은 별도 실제 로컬 workerd/D1 테스트로 검증했다. 실제 운영 DB에는
SELECT만 실행했다. 최종 재조회에서도 grant/활성 grant/감사 이벤트 0, 계정 프로필 4,
상품 3, 공개 구매자 0이었다. 미해결 자동 검사 실패는 없으며, 위 live 검증 차단은
테스트 성공과 구분한다. 빌드의 기존 JS 청크 크기 경고는 남아 있다.

## 소유자 관리자 설정 설계 — 2026-10-23 (미적용)

### 증거와 신원 경계

사용자가 기존 Supabase 관리 조회로 확인했다고 제공한 후보:
`11111111-1111-4111-8111-111111111111`, `administrator@example.test`,
프로젝트 `heaswpawzuuijxurlfoz`. 이번 세션에는 Supabase 관리 도구가 없으므로
그 조회를 독립 재실행하지 않았다. 이메일 확인 시각/계정 상태는 전달되지 않아
추가로 단정하지 않는다. 후보의 Auth 일치 정보는 사용자가 전달한 조회 결과에
근거하며, 소유자 신원 확인이나 관리자 권한 부여 승인을 뜻하지 않는다.

스테이징 D1 SELECT로 후보 UUID의 `auth_users`와 `profiles` 레코드 존재를 각각
확인했다. 이는 앱 기록의 존재이지, 이메일 일치·현재 Supabase 계정 확인 상태나
소유자임을 다시 증명하는 자료가 아니다. 전체 grant 0, 활성 grant 0, 후보 grant 0,
업무 감사 이벤트 0이다. 이번에는 어떤 실제 사용자에게도 grant하지 않았다.

### 저장소·검증·감사 대조

| 항목 | 실제 저장소와 구현 | 확인된 범위 |
| --- | --- | --- |
| Auth 사용자/로그인 | Supabase Auth; Worker가 `/auth/v1/user`를 서버에서 조회 | public 업무 테이블을 요구하지 않음 |
| 계정/업무 데이터 | D1 `profiles`, `producer_profiles`, `producer_items`, buyer 관련 테이블 | migrations 0001, 0004–0006과 실제 테이블 존재 일치 |
| 세션 | D1 `sessions`, `auth_users`, `auth_clock`, `auth_limits` | HttpOnly 쿠키, provider 토큰 암호화, 세대/만료/복구 fence 검사 |
| 관리자 권한 | D1 `admin_grants(user_id,granted_by,granted_at,revoked_at)` | migrations 0007과 실제 열 일치; `revoked_at IS NULL`만 허용 |
| 관리자 API | `worker/index.ts` → `readSession` → 복구 세션 거부 → `administrator` | provider의 확인된 subject와 D1 세션 user_id 일치 후 grant 검사 |
| 업무 변경 감사 | D1 `admin_audit`, `admin_action`, append-only 트리거 | 상품 상태/구매자 철회를 감사 INSERT와 원자 처리, write 내부 grant 재검사 |
| 권한 부여/철회 감사 | 현재 전용 테이블·도구 없음 | 기존 admin_audit CHECK는 두 업무 action만 허용 |

실제 staging binding은 Worker `jalisco-auth-staging`, DB `jalisco-auth-staging`
(`7712d6bb-2414-44d3-9282-cb5b941d740e`), Supabase 프로젝트는 위 ref다.
D1 ledger는 0001–0007이다. Supabase `public`에 테이블이 없다는 관리 조회 결과는
이 구조와 일치 가능하다. Supabase `auth` 스키마가 없다는 의미가 아니며,
public 테이블 조회 권한/필터와 실제 빈 스키마 여부는 여기서 독립 확인하지 않았다.
D1의 `auth_users`는 Supabase `auth.users`와 별개의 앱 세션 상태 테이블이다.

### 기존 경로의 적합성

런타임 권한 검사와 비공개 D1 권한 테이블은 이미 구현됐다. 그러나 수동 D1 INSERT만
실행하면 부여/철회 이력을 기존 업무 감사에 남길 수 없고, 소유자 승인·실행 대상
검증을 강제하는 운영 도구도 없다. 따라서 현재 상태를 승인·감사까지 갖춘 완성된
bootstrap 경로라고 판정하지 않는다. 일반 가입 role을 admin으로 바꾸거나 Supabase
metadata/public 테이블을 추가해서 해결하지 않는다. 기존 migration 0007은 수정하지 않는다.

### 제안 변경 계획 — 아래 파일·스키마·도구는 아직 구현하지 않음

1. `migrations/0008_admin_grant_events.sql` (새 파일 예정): 기존 레코드를 지우지 않는
   추가형 migration. `admin_grant_events`에 고유 event/request ID, grant/revoke 구분,
   target subject, Supabase project ref, 실행 Cloudflare 운영자 식별자, 소유자 승인
   기록 참조, 사유, 이전 event ID/이전 상태, 실행 시각을 저장한다. UPDATE/DELETE 금지.
   기존 `admin_grants`에 nullable project ref와 last_event_id를 추가한다. 기존 미분류
   grant를 자동 승인/재활성화하거나 역할을 backfill하지 않는다.
2. event INSERT의 트리거가 예상 이전 event/state를 검증하고 grant projection을
   원자 갱신한다. 중복 request ID/오래된 상태/잘못된 프로젝트는 실패한다. 직접
   grant 쓰기는 일치하는 신규 event 참조가 없으면 거부하고 DELETE를 금지한다.
   revoke는 행 삭제 대신 `revoked_at` 기록으로 처리한다. 이 제약은 테스트가 먼저
   통과해야 하며, 외부 D1 제어권 자체를 가진 운영자를 애플리케이션 SQL로 차단할 수
   있다고 주장하지 않는다. Cloudflare 운영자 접근도 별도로 최소화해야 한다.
3. `admin_audit`에 project ref를 추가하고 `admin_action`의 grant 재검사도 동일한
   프로젝트 범위를 검사하도록 갱신한다. 기존 업무 이벤트를 지우거나 프로젝트를
   추정해 backfill하지 않는다. migration은 승인된 사용자 UUID를 INSERT하지 않는다.
4. `scripts/admin-grant.mjs` (새 파일 예정): 브라우저/API가 아닌 승인된 운영자 전용.
   기본은 계획 출력만 하며, 별도 실행 승인·명시적 apply·정확한 stage/config/DB/project/
   UUID·승인 기록 참조·사유가 모두 있을 때만 한 이벤트를 제출한다. 승인 기록은
   임의 요청 필드의 approved=true가 아니라 별도 신뢰 경로에서 확인한 기록이어야 한다.
   Supabase 관리 검증과 Cloudflare 운영자/현재 배포 binding 검증이 없으면 중단한다.
   비밀값은 출력/파일 저장하지 않고 실행 결과는 event ID와 상태만 보고한다.
5. `worker/admin.ts`, `worker/index.ts` (후속 수정 예정): 서버에서 검증한 설정의
   Supabase project 범위를 grant 검사 및 업무 감사 INSERT에 전달한다. body/metadata가
   제공하는 project/actor/role은 권한 근거로 사용하지 않는다. 읽기는 매 요청 검사하고,
   쓰기는 같은 조건을 DB trigger에서도 다시 검사한다. 기존 세션 검증을 약화하지 않는다.
6. `worker/admin.ts`, `src/components/AdminPage.tsx` (후속 수정 예정): 기존 업무 감사와
   권한 이벤트를 구분해 읽기 전용으로 표시한다. 웹에서 grant/revoke할 endpoint는
   추가하지 않는다. owner라는 명칭이 사용자 삭제·임의 SQL·구매자 동의 부여·다른
   관리자 생성 권한을 뜻하지 않는다. 기존의 조회/상품 상태/구매자 철회만 허용한다.
7. `tests/admin*.test.mjs`, 운영 도구 테스트, `tests/browser/admin-review.spec.ts`:
   프로젝트 혼동, 승인 없는 apply, event 재사용, 잘못된 UUID, 감사 실패 시 rollback,
   직접 grant 쓰기 차단, revoke/재부여 CAS, grant 철회와 업무 write의 경합, 비밀값
   미출력, 감사 조회 권한을 추가 검증한다. 이 신규 설계의 기능 테스트는 아직 없다.

### 향후 부여·철회와 검증 순서

- 별도 승인 필요: 위 구현/추가형 migration 검토, 정확한 대상 환경, 후보의 소유자
  신원·기존 Auth 확인 상태, 실행자, 최초 grant 및 권한 변경 감사 방법을 확정한다.
- 코드/임시 DB 테스트 → 별도 승인된 스테이징 migration/배포 → 운영 도구 dry-run 검토
  → 별도 명시 승인된 grant 이벤트 1건 실행 순서다. 이 문서는 실행 승인이 아니다.
- 실행 전후 grant/event와 원본 업무 데이터가 기대대로 유지되는지 조회한다. 승인된
  실제 소유자 로그인으로 허용, 일반 사용자/비로그인 거절을 검증한다. 기존 사용자
  세션/토큰을 읽어 재사용하지 않는다. 인증 동작은 rate/session 기록을 쓰므로 이번
  단계의 무변경 검증과 별도로 승인받는다.
- 철회도 승인된 revoke 이벤트 1건으로 원자 처리한다. 다음 admin 요청의 403과 write
  거절을 검증하며 기존 업무 기록/계정/세션/감사 이벤트를 삭제하지 않는다. 오류나
  응답 유실 시 event ID 및 projection을 조회해 확정하고 무조건 재실행하지 않는다.
- Supabase public에 업무 테이블을 만들 필요는 없다. Supabase schema migration,
  Auth 설정/비밀값 변경, 기존 producer/buyer 역할 변경, Home 수정은 계획에 없다.

### 이번 단계에서 실제 준비한 테스트

`tests/admin-owner-boundary.test.mjs`는 합성 신원과 임시 메모리 DB만 사용한다.
첫 가입/온보딩 자동 관리자 금지, signup의 admin/owner 역할 거부, provider metadata
owner/admin 위조 거부, 비로그인/일반 사용자 bootstrap/grant/revoke 요청 거부,
기존 trusted admin에게도 웹 grant endpoint 없음, provider subject 불일치/미확인
계정의 grant 우회 거부를 검증한다. 실제 후보 UUID는 테스트 grant나 코드 allowlist에
넣지 않았다. lint·타입 검사 PASS, 관련 Node 29개 PASS(신규 경계 테스트 5개 포함).
새 migration 파일 생성/실행, runtime 변경, 실제 권한 부여, 배포·커밋·푸시는 하지 않았다.

추가 스키마 대조: 실제 D1의 admin_grants/admin_audit 테이블과 admin_action/
admin_audit_no_update/admin_audit_no_delete 트리거 정의를 읽어 migration 0007과
주석·공백·문장 종결자를 제외하고 비교했으며 5개 모두 일치했다. 이 작업도 SELECT만
실행했으며 migration runner나 D1 쓰기 명령은 실행하지 않았다.

## 관리자 권한 기능 구현 — 2026-10-23 (로컬 구현, 라이브 미적용)

위의 '미구현' 설계 설명을 다음 구현으로 보완한다. 이 절은 실행 승인이 아니다.
이번 작업에서는 원격 관리 API 조회/쓰기, 실제 migration 실행, 사용자 권한 변경,
배포·커밋·푸시를 하지 않는다. 실제 소유자 후보나 Ed에게 권한을 미리 넣는 seed도 없다.

### 구현과 신뢰 경계

- `0008_admin_grant_events.sql`: grant/revoke 이벤트와 projection 변경을 단일 INSERT의
  트리거로 원자 처리한다. 이벤트에는 실행 Cloudflare token ID, 승인자 key ID,
  대상 subject, 프로젝트, 작업, 시각, 사유, 승인 참조/서명 envelope SHA-256,
  예상 이전 event ID를 기록한다. 이벤트는 append-only이며 REPLACE도 거부한다.
- `admin_grants`에 nullable project_ref/last_event_id, 업무 감사에 project_ref를
  추가했다. 기존 행을 삭제·승인·재활성화하거나 scope를 추정해 backfill하지 않는다.
  기존의 scope 없는 grant는 새 런타임에서 차단되며 별도 검토가 필요하다.
- 직접 grant INSERT/UPDATE/DELETE는 일치하는 신규 감사 이벤트 없이는 차단한다.
  revoke는 행 삭제 대신 revoked_at을 남긴다. event ID 중복/예상 상태 불일치는
  상태 변경을 일으키지 않는다. 감사/검증/projection 오류는 전체 문장을 rollback한다.
- Worker는 기존 provider/session 검증 후 서버 설정에서 project ref를 계산한다.
  활성 grant, 최신 grant event, subject와 프로젝트가 모두 맞아야 접근한다. 업무
  변경도 같은 scope를 SQL trigger에서 다시 검사한다. metadata/body의 actor/role/
  project는 권한 근거가 아니다. 웹 grant/revoke/bootstrap endpoint는 추가하지 않았다.
- Admin Console의 Access History는 실제 권한 이벤트를 검색·필터·페이지 조회하며
  승인자·실행자·대상·시각·사유·승인 참조를 상세 표시한다. 부여/철회 버튼은 없다.
  소유자와 Ed는 동일한 제한된 console admin 권한이다. 계정 삭제, 임의 SQL, 구매자
  동의 부여, 웹에서 다른 관리자 생성은 지원하지 않는다.
- 기존 Accounts 화면의 액션 열에 상태명 배열이 출력되던 조건식을 함께 바로잡았다.
  계정 화면에 권한 변경 기능을 추가한 것은 아니다. Home/공개 페이지는 수정하지 않았다.

### 운영 도구

`scripts/admin-grant.mjs`는 **기본 dry-run**이다. 온라인 모드는 현재 단계에서 실행하지
않았다. `--apply`와 정확한 `--confirm` 문자열, 신뢰된 서명이 모두 없으면 쓰지 않는다.
현재 도구는 검토된 **기존 스테이징만** 지원한다. production config/다른 ref/DB/Worker는
거부하며, scope 확장은 향후 별도 코드 검토가 필요하다.

온라인 검증 순서:
1. 로컬 staging config의 account/DB/Worker/Auth origin/Supabase ref를 고정 범위와 비교.
2. 환경의 `CLOUDFLARE_API_TOKEN`을 Cloudflare verify API로 확인하고 token ID를
   `cf-token:<id>` 실행자로 사용. 실제 배포 Worker settings의 DB/Auth binding도 비교.
3. 환경의 `SUPABASE_ACCESS_TOKEN`으로 해당 프로젝트의 read-only SQL management
   endpoint에서 **UUID와 이메일이 정확히 일치하는 Auth 사용자 1명**만 조회한다.
   grant에는 이메일 확인·미삭제·미차단 상태를 요구한다. revoke는 이미 차단된
   기존 계정도 처리할 수 있으나, UUID/이메일 일치는 여전히 요구한다. 계정 자체가
   사라졌거나 관리 조회 권한이 없으면 별도 검토가 필요하며 추정하지 않는다.
4. D1의 기존 auth_users와 profiles가 모두 있어야 한다. 가입만 하고 앱 로그인/온보딩을
   완료하지 않은 사용자는 먼저 정상 가입 흐름을 마쳐야 한다. 기존 grant/event와
   예상 이전 event ID를 확인한다. 승인 서명은 대상·작업·사유·프로젝트·DB·Worker·
   실행 token ID·request ID·예상 event ID에 바인딩된다.
5. apply에서 서명·최대 1시간 유효기간·승인 참조를 검증한 뒤 event INSERT 1건만 실행.
   무조건 재시도하지 않는다. 응답이 유실되면 event ID와 현재 상태를 조회한다.
   동일한 원래 승인/예상 event ID의 재실행은 이미 기록된 event를 확인만 한다.
   재실행이 과거 grant를 다시 활성화하지 않는다.

관리 API 응답 원문/토큰·비밀번호·서비스 역할 키는 출력하지 않는다. service-role 키는
사용하지 않는다. 외부 권한 부족/스키마 차이는 중단 사유이며 보안 설정을 약화하거나
다른 API로 자동 우회하지 않는다. API 계약은 공식 문서의
[Supabase read-only query](https://supabase.com/docs/reference/api/v1-read-only-query),
[Cloudflare token verify](https://developers.cloudflare.com/api/resources/user/subresources/tokens/methods/verify/),
[D1 query](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/)를 참조했다.
실제 계정/토큰 종류의 외부 호환성은 아직 라이브 검증하지 않았다.

DB는 이벤트의 원자성/상태/scope를 검사하고, CLI는 Auth와 서명을 검사한다. D1 자체를
직접 제어할 수 있는 Cloudflare 운영자는 신뢰 경계 안에 있다. 이 도구나 트리거가
그 운영자의 코드/스키마 변조까지 방지한다고 주장하지 않는다.

### 승인 키 준비 — 별도 승인 필요, 이번에는 수행하지 않음

`staging/admin-approval-policy.example.json`에는 공개 scope와 **빈 approvers 배열**만 있다.
실제 `staging/admin-approval-policy.json`은 만들지 않았다. 따라서 현재 apply는 차단된다.
신원이 확인된 소유자/승인자가 별도의 보호된 경로에서 Ed25519 키를 준비하고, 공개키와
key ID를 고정 policy 파일에 등록하는 변경부터 독립적으로 승인/검토해야 한다.
CLI의 `--policy` 같은 임의 신뢰키 선택 옵션은 없다. 일반 앱 사용자는 이 파일이나
운영 도구 환경에 쓰기 권한이 없어야 한다. 승인 키를 승인하는 절차와 실제 계정 권한
부여 승인은 서로 별개다. private key를 프로젝트/브라우저/채팅/명령 인자에 넣지 않는다.

`scripts/admin-approve.mjs`는 외부 DB/API를 호출하지 않는 서명 도구다. 검토된 payload와
정확한 request ID의 명시적 확인을 요구하고, private key는 보호된 stdin으로만 받는다.
고정 policy의 신뢰된 키로 검증되는 경우에만 새 승인 파일을 저장한다(기존 파일 덮어쓰기
거부). 서명 envelope에는 private key가 포함되지 않는다.

### dry-run과 실제 실행 예시 — 아래 온라인/apply 명령은 이번에 실행하지 않음

먼저 승인/계정 검증 없이 로컬 계획만 확인할 수 있다. 이 결과는 verified=false이며
계정 존재·확인 상태를 증명하지 않는다. 아래 request ID는 예시이므로 실제 요청에는
새 UUID를 사용한다.

```bash
node scripts/admin-grant.mjs --offline \
  --project heaswpawzuuijxurlfoz \
  --user 11111111-1111-4111-8111-111111111111 \
  --email administrator@example.test \
  --action grant --expected none \
  --request 22222222-2222-4222-8222-222222222222 \
  --reason 'Prepare owner access review only'
```

온라인 dry-run은 같은 명령에서 `--offline`을 빼면 된다. 보안 운영 환경에 두 관리
토큰을 미리 주입해야 하며, 이 도구는 .env/Worker secret/기존 사용자 세션을 읽지 않는다.
최초 grant는 `--expected none`, revoke/재부여는 직전 event UUID를 `--expected`에 넣는다.
출력의 intent와 approval_payload_template를 보호된 파일로 옮기고, 실제 승인 참조와
현재 유효기간을 검토한다. 신뢰된 서명자가 다음처럼 별도 환경에서 서명할 수 있다.
경로·request ID·key ID는 실제 검토한 값으로 대체한다.

```bash
node scripts/admin-approve.mjs \
  --payload /secure/operator/owner-payload.json --key-id OWNER_KEY_ID \
  --out /secure/operator/owner-approved.json \
  --confirm 'APPROVE REQUEST_UUID' < /secure/approver/ed25519-private.pem
```

서명이 승인된 후 별도 실행 승인까지 있어야 apply한다. dry-run 때의 모든 인자와
request ID/expected event를 그대로 유지하고 다음 인자를 추가한다.

```text
--apply --approval /secure/operator/owner-approved.json
--confirm "APPLY grant SUBJECT_UUID REQUEST_UUID"
```

실제 소유자 설정 순서: 소유자 신원/현재 Auth 확인 상태/대상 scope 승인 → 공개 승인 키
검토·설치 → 격리 테스트 → 별도 승인된 migration 0008 적용과 호환 코드 배포 → 온라인
계획 검증 → 서명 및 명시적 최초 grant 승인 → event/상태 조회 → 실제 소유자 로그인
허용·일반/비로그인 거부 확인. migration/배포 전에는 이 도구로 권한을 넣지 않는다.
기존 schema 0007만 있는 DB는 새 도구/런타임이 거부할 수 있으므로 순서를 지켜야 한다.

Ed는 기존 이메일·UUID를 추정/예약하지 않는다. Ed가 실제 가입·이메일 확인·앱 로그인·
온보딩을 완료하면 실제 ref/UUID/이메일로 **새 request ID**의 grant dry-run을 만들고
같은 독립 승인/서명/apply 절차를 반복한다. Ed에게 소유자의 private 승인 키나
Cloudflare/Supabase 관리 토큰을 제공하지 않는다. Ed의 콘솔 접근만 허용한다.

철회는 동일 도구의 `--action revoke`, 현재 grant의 last_event_id를 `--expected`에 지정하고
새 request ID·사유로 dry-run → 서명 → `APPLY revoke SUBJECT_UUID REQUEST_UUID` 확인 순서다.
다음 관리자 요청/업무 변경 거부와 감사 event를 확인한다. 재부여 역시 새 grant 이벤트로
처리하며 이전 이벤트·업무 데이터·계정은 삭제하지 않는다.

### 검증 범위와 남은 작업

추가 테스트는 합성 계정·일회용 SQLite/실제 로컬 workerd-D1·HTTP stub만 사용한다.
서명/유효기간/실행자·프로젝트 바인딩, dry-run 무쓰기, 중복·stale/CAS, 응답 유실,
직접 수정/REPLACE 거부, grant/revoke 원자성·감사 실패 rollback, 기존 행 보존,
비로그인/일반 사용자·owner metadata 거부, Access History 조회와 웹 권한 변경 부재를
검증한다. Supabase public 테이블 생성/인증 설정 변경은 필요하지 않다.
외부 관리 토큰 접근, 신뢰된 공개 승인 키의 실제 설치, 실제 소유자 신원 검증,
온라인 dry-run, migration 적용/배포/실제 부여·철회 및 live acceptance는 미실행이다.

최종 로컬 검증: Node 207개 PASS, 브라우저 90개 PASS, lint/typecheck/build 및
check:staging/dry-run:staging PASS. DB 쓰기 실패·서명 위조/만료·승인 누락·프로젝트
혼동·중복/CAS·owner metadata 오남용·실제 로컬 D1의 감사 실패 rollback을 포함한다.
초기 fixture의 새 열 개수와 lint 전역 선언 오류는 수정 후 전체 검사에서 해소했다.
빌드의 기존 큰 JS 청크 경고(약 550 kB 비압축)는 남아 있다. 실제 소유자 후보의
--offline 계획 명령만 실행했으며 verified=false/changed=false였다. 관리 토큰을
사용한 온라인 dry-run이나 실제 grant/revoke가 통과했다고 보고하지 않는다.
Home/공개 컴포넌트·라우팅·에셋·staging config는 작업 시작 해시와 같았다.

## Owner recovery — PIN + offline key, remote disabled

See `OWNER_RECOVERY.md`. The current scope excludes passkeys/WebAuthn. The optional
`/api/owner/*` protocol requires a root-signed bootstrap, an independent offline
Ed25519 recovery key AND the 11-digit PIN. Recovery atomically rotates keys and
policy, invalidates old native owner sessions and issues a fresh owner session.
It never fabricates a Supabase identity or promotes ordinary administrators.

No current deployment config enables it and no real owner/key/secret is enrolled.
D1 migrations remain unchanged. The legacy grant CLI remains fail-closed with a
pinned owner root until an epoch-fenced grant gateway is implemented.
