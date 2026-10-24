# Authentication integration and deployment proposal

> Current isolation work supersedes the historical shared-provider instructions below.
> See [STAGING_ISOLATION.md](STAGING_ISOLATION.md). Do not apply shared-project setup instructions for the new staging cutover.

## Current status and production boundary

The existing homepage, layout, localization, Leaflet map and GIS code are unchanged by this integration patch. The existing authentication commit already added its account link and account pages. No replacement homepage is introduced. The production Worker name and origin remain `jalisco-produce-export` and `https://jalisco-produce-export.yukikato123123123.workers.dev`.

The owner confirmed production Builds uses branch `main`, build command `npm run build`, and deploy command `npx wrangler deploy`, with a static-assets-only deployed Worker. The auth commit did not contain a Wrangler config, so it did not specify an executable Worker entry point during that build. A dashboard binding alone cannot add the missing Worker module. The feature build failed at `npx wrangler preview`, not at Vite compilation; that command requires a separate Preview configuration. Do not fix this by pointing the existing production Worker's feature builds at a production deployment.

Wrangler `whoami` reports **not authenticated** in this environment. No Cloudflare runtime inspection, D1 remote inspection/migration, staging deployment, secret registration, Supabase setting change or real email test was performed. GitHub feature-branch push is allowed by the current request; merge/push to `main`, production migrations, and production deployment are not authorized. None of the configurations or local checks below authorizes production.

## Explicit configs and bindings

| File | Purpose | Current completeness |
| --- | --- | --- |
| `wrangler.jsonc` | Pre-existing user-local config | Preserved byte-for-byte, remains untracked; not used by the updated local scripts and not committed |
| `wrangler.local.jsonc` | Reproducible local Worker/assets setup | Local placeholder D1 and loopback origin; `dev:worker` and `db:local` explicitly select this file |
| `wrangler.staging.jsonc` | Temporary, isolated authentication verification Worker `jalisco-auth-staging` | Owner-specified D1 name `jalisco-auth-staging`, UUID `7712d6bb-2414-44d3-9282-cb5b941d740e`; account and HTTPS origin/address are still unconfirmed |
| `wrangler.production.jsonc` | **Proposal only** for existing production Worker | Exact existing name/origin; dedicated production D1/account remain placeholders. Never substitute the staging DB |

Both remote proposals use `main: worker/index.ts`, the existing Vite `dist/` as `ASSETS`, SPA fallback and `/api/*` Worker-first routing. The Worker serves non-API requests via `ASSETS.fetch()` before checking auth configuration. `/api/*` reaches the runtime; dashboard HTML alone is not an authorization test. Existing SPA/static routes must also pass deployed smoke tests.

`workers_dev` and preview URLs remain disabled for staging until the owner confirms one staging address. Either approve a temporary workers.dev origin, or add one exact owned custom domain/route with the matching `AUTH_ORIGIN`. Do not reuse the production origin or create an unrelated permanent public website. Restrict staging to the test team and retire/restrict its access after acceptance under an approved cleanup plan.

Required runtime configuration:

- `DB`: the target's confirmed D1 binding and reviewed schema.
- `ASSETS`: existing `dist/`, configured by Wrangler, not a manually uploaded replacement site.
- `AUTH_ORIGIN`: exact HTTPS origin with no path or trailing slash.
- `SUPABASE_URL`: the owner-specified existing project `https://xchkkdfelwzzpyorjeks.supabase.co`. This non-secret URL is configured server-side for both proposals.
- `SUPABASE_PUBLISHABLE_KEY`: that project's publishable/approved anon key, supplied as a Worker secret. No service-role/admin key is needed.
- `SESSION_ENCRYPTION_KEY`: separate per-environment 32-byte AES key encoded as 64 hexadecimal characters, supplied as a Worker secret. Never reuse a production key in staging.

Using the existing Supabase project means staging and production provider users, email quotas and global Auth settings are not isolated. Only use owned disposable addresses. Do not change global confirmation, SMTP or templates without first documenting exact changes, existing behavior and impact and obtaining the owner's approval. The database/key separation does not create a separate Supabase user namespace.

## Local checks and safe limitations

```bash
npm run typecheck
npm run build
npm run lint
npm test
npm run test:auth
npm run test:deployment
WRANGLER_SEND_METRICS=false npm run dry-run:staging
WRANGLER_SEND_METRICS=false npm run dry-run:production
git diff --check
```

`npm run check:staging` and `npm run check:production` are additional non-secret **release preflights**. They deliberately fail while account/origin/production DB placeholders remain. They reject the known staging DB in production, a production origin in staging, routing loss, plaintext keys, and wildcard/custom-domain mismatches. They do not contact Cloudflare and cannot establish account ownership, remote DB identity, registered secrets, live provider policies, or approval. Do not bypass them by replacing unknown IDs with made-up values.

The `dry-run:*` commands package locally and do not deploy. Wrangler can accept placeholder identifiers during dry-run, so packaging success is not release readiness. Keep inherited secret files/variables out of these checks. The local scripts do not automatically migrate remote databases or deploy anything. The default `npm run build` is unchanged.

## Staging D1: inspect before migration

The owner supplied the name/UUID above, but its account ownership, existing schema, data and migration ledger have not been remotely verified. The currently blocked operator procedure is:

1. Authenticate to the approved Cloudflare account and fill only its confirmed account ID and approved staging address/origin.
2. Verify that the exact UUID resolves to `jalisco-auth-staging`. Inspect its existing tables and migration ledger. If it contains unexplained data or a partially applied schema, stop; do not drop, reset or replay SQL.
3. Review SQL and obtain a scoped backup/export if it contains data before migration.
4. Apply only pending migrations using the explicit staging config. Do not run on an unknown DB or against production.

Migration review:

- `0001_auth.sql` creates profiles, immutable-role trigger, sessions and indexes. It does not delete data, but existing tables must match the reviewed schema.
- `0002_limits_index.sql` creates the auth-limit expiry index.
- `0003_auth_generations.sql` adds session generation/claim columns, the auth clock and per-user generation/block state, and recovery/generation triggers. It has no DROP/DELETE operation, but **invalidates all older sessions in the target DB** through generation `-1`. Profiles remain; Supabase passwords are not modified. ALTER/CREATE statements must not be blindly reapplied outside the migration ledger.

Owner-access commands, after target and impact confirmation (not executed):

```bash
npm run check:staging
WRANGLER_SEND_METRICS=false npx wrangler d1 info jalisco-auth-staging --config ./wrangler.staging.jsonc
WRANGLER_SEND_METRICS=false npx wrangler d1 migrations list DB --remote --config ./wrangler.staging.jsonc
WRANGLER_SEND_METRICS=false npx wrangler d1 migrations apply DB --remote --config ./wrangler.staging.jsonc
```

Afterward verify `d1_migrations`, session generation/claim columns and recovery/generation triggers using schema-only queries. Do not export sessions, user data or tokens into shared logs. Remote migration listing can initialize the ledger; treat it as a remote database action. Earlier successful migrations may remain if a later migration fails. No production migration is authorized; first present its actual target, SQL, backup and invalidation impact separately.

## Consolidated account-owner completion checklist

All commands below remain **not executed**. Do not provide credential values in chat or source control.

1. **Cloudflare access and isolation:** authenticate in a trusted terminal using `npx wrangler login`, or use an appropriately scoped credential from a secure vault. Confirm the account, exact staging D1 UUID/name and one temporary staging address. Fill only those non-secret config fields, then run `npm run check:staging`. Do not use temporary-account auto-deploy options or create a replacement production Worker.
2. **Supabase compatibility:** obtain the existing project's publishable key securely. Confirm email confirmation is actually required, supported OTP length is 6–10 digits, configured expiry, and SMTP recipient limits. The app verifies email+numeric code through `/auth/v1/verify`; no OAuth/PKCE/fragment or confirmation-link callback is implemented. Both signup and recovery email must provide `{{ .Token }}` and an exact approved `/verify-email` landing link. Recovery users select the recovery purpose. Proposed changes to the existing project's Site URL, redirect allowlist, templates or SMTP require a separate impact review before saving; do not overwrite existing production callbacks. Staging and production may need distinct explicit landing links without expanding to wildcard callbacks. Do not send mail until the test mailbox and request budget are agreed.
3. **D1:** follow the inspected procedure above, notifying any staging testers that 0003 invalidates existing sessions. Do not change existing Supabase user data as part of migration.
4. **Secrets:** keep the verified staging Worker restricted. Set only the two required keys on that Worker. Secret registration can create a draft Worker/version, so verify the config target before any command. The supplied Supabase URL is already a server-side config variable.

   ```bash
   npx wrangler secret put SUPABASE_PUBLISHABLE_KEY --config ./wrangler.staging.jsonc
   npx wrangler secret put SESSION_ENCRYPTION_KEY --config ./wrangler.staging.jsonc
   ```

   Enter the publishable key only at the masked prompt. For the encryption key, use the secure private-file/vault generation and stdin upload procedure in `AUTHENTICATION.md`; do not display it, put it in arguments or record it in terminal traces. Retain the approved vault version before upload; never generate a new key merely to retry provisioning. No key was generated in this task.
5. **Staging release:** review the feature commit/config, run local checks and preflight, then deploy only the separate Worker:

   ```bash
   npm run check:staging
   npm run typecheck
   npm run build
   WRANGLER_SEND_METRICS=false npm run dry-run:staging
   WRANGLER_SEND_METRICS=false npx wrangler deploy --config ./wrangler.staging.jsonc
   ```

   If using Git integration, connect the **separate staging Worker** to `feature/secure-authentication`, with build command `npm run check:staging && npm run typecheck && npm run build` and deploy command `npx wrangler deploy --config ./wrangler.staging.jsonc`. The existing production Worker's feature Preview command must not deploy to production. Limit/disable that production connection's non-production builds separately if appropriate and approved; no `previews` block is introduced by this persistent-staging workflow.
6. **Live acceptance:** verify public homepage/map at desktop/mobile sizes without an app session; producer and buyer signup; real email delivery; signup/recovery OTP correctness, expiry, replay and wrong purpose; unconfirmed login rejection; login and reload persistence; HttpOnly/Secure/SameSite cookie flags; opposite-role 403; logout and old-cookie replay; recovery session restrictions; reset and all-old-session revocation; simultaneous reset requests; delayed login/reset races; provider outages and bounded rate limits. Do not log passwords, OTPs, cookies, tokens or HAR. Local mocks prove implementation contracts only. See the detailed matrix in `AUTHENTICATION.md`.
7. **Production approval gate:** after live staging acceptance, present the exact reviewed diff/commit, existing Worker target `jalisco-produce-export`, a distinct confirmed production D1, migration SQL/impact, matching production secrets, prior-version backup and rollback plan. Only after explicit approval may code be merged to `main`, production migration applied, and the existing production deploy command changed to select the reviewed production config (`npx wrangler deploy --config ./wrangler.production.jsonc`). Those actions are not performed by this task. The root default config remains local and is not committed; unqualified production deployment must not accidentally select it.

## Recovery and rollback

Do not delete/recreate the existing Worker or existing data. First restrict only the affected staging endpoint under approved scope. For code rollback, use a reviewed version compatible with migration 0003; pre-generation auth code is not a safe auth rollback. Do not decrement generations, unclaim proofs, manually unblock users or restore old session rows while serving traffic. A D1 restore or returning to an old encryption key can revive old state. Database rollback cannot undo a Supabase password change.

A timeout/5xx or lost D1 finalization response during reset can mean the password changed even though the request failed. Keep the recovery proof consumed; the login fence remains until resolved. A two-minute lease is not an automatic unlock. Reconcile provider state and pending operations using sanitized evidence, then obtain fresh provider-verified recovery proof. Do not claim cross-system atomic rollback. Repeated uncertainty needs owner review rather than automatic retries or direct SQL changes.

If no compatible prior code exists, keep staging restricted and fix forward. A disposable new DB/key requires separate approval; quarantine prior resources rather than deleting user data. Production rollback must use a confirmed recoverable prior production version/assets with explicit approval, preserving the same Worker name/URL. Restoring the old static site restores public presentation, not authentication.

## Executed checks for this integration patch

- `npm run typecheck`: passed (frontend and Worker).
- `npm run build`: passed; the output JS/CSS names and sizes match the preceding build, with no frontend source changes.
- `npm run lint`: passed after adding explicit Node imports to the new validation script; its first run reported missing Node globals, now fixed.
- `npm test`: 32 passed.
- `npm run test:auth`: 35 passed, including disposable actual workerd/D1 recovery concurrency, generation fences and role checks. The first restricted run failed at test-process level; rerunning outside the sandbox passed. Supabase remained mocked.
- `npm run test:deployment`: 4 passed for configuration rejection/isolation boundaries.
- `npm run test:browser`: 19 passed with local Worker and process-local Chromium library path. The first restricted attempt could not start the localhost server; rerun with local runtime permissions passed. APIs/map tiles are partly intercepted; this is not live Supabase or external tile validation.
- Explicit staging and production Wrangler dry-runs: passed with ASSETS/DB bindings and a 21.11 KiB Worker bundle. Both proposals retain unresolved release fields.
- `git diff --check`: passed.
- No remote migration/deployment, real OTP delivery, live provider authentication or provider-setting change was executed. Production remains unmodified.

Remote acceptance and production approval are still required. These local results do not establish production readiness.
