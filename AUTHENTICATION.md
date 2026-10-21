# Local authentication implementation

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
   `AUTH_ORIGIN` is `http://localhost:8787` in the local Wrangler config. Use that
   exact hostname, not `127.0.0.1`, in the browser. Only loopback origins may use
   HTTP. No `VITE_` secret is required or supported.
5. Run `npm run db:local` (explicitly `--local`), `npm run build`, then
   `npm run dev:worker`. Vite alone (`npm run dev`) has no authentication backend.
   D1 uses the local placeholder binding; it is not a production database ID.
6. Open `http://localhost:8787/`. `/login`, `/signup`, `/forgot-password`,
   `/verify-email`, `/reset-password`, `/onboarding`, `/producer/dashboard`, and
   `/buyer/dashboard` use the same origin. API calls fail closed with a setup
   message when provider settings are absent. Public content remains available.

Do not deploy this local Wrangler config as a replacement for the existing
production deployment. The repository had no tracked Worker deployment config;
its production hosting integration is unknown. A future approved staging effort
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
