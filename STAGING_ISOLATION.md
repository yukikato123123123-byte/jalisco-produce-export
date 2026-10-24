# Isolated staging authentication cutover

## Status and protected resources

Local implementation is complete; remote isolation is **not** complete. The existing staging deployment still uses the shared Supabase project. Do not send signup, resend, recovery or authenticated provider requests to that deployment while isolation is pending.

The existing `jalisco-auth-staging` Worker and D1 `7712d6bb-2414-44d3-9282-cb5b941d740e` were read-only verified for reuse. D1 migrations 0001–0003 are already applied; no migration, data deletion or schema change is required for this cutover. Existing profiles and sessions are preserved. The current live staging version is `2bc50d9f-5e6f-46da-ab63-6963eaa2f63f`; it does not contain this local isolation patch.

The production Worker, homepage, deployment config and existing production Supabase project must remain untouched. No production user, callback, template, SMTP setting, rate limit, API key or signing key is changed. The pre-existing local `wrangler.jsonc` remains untracked and unchanged. Existing user edits were preserved rather than reset.

## Implemented isolation

- Staging config declares `AUTH_ENVIRONMENT: staging` and deliberately replaces the shared Supabase URL with an unresolved **new-project** placeholder. Confirmed account, Worker, HTTPS origin, D1 and asset routing stay unchanged.
- Release validation rejects the shared production Supabase URL, unresolved provider URL, missing staging environment marker, production origin, wrong Worker/D1 and unsafe routing. Production validation retains its existing provider requirement.
- Runtime validation also refuses shared/unconfigured provider URLs in staging before any outbound authentication request. Public assets remain available. Existing local/production behavior without the staging marker stays compatible.
- Staging cookie identifiers are hashed with the provider URL as a namespace. Legacy shared-provider cookies, and cookies from a different isolated project, cannot read or delete new-project sessions. This requires no D1 migration or deletion. It does not revoke tokens at the old provider; exposed old tokens need a separately authorized incident response.
- Signup, signup resend and staging recovery use the exact staging `/verify-email` destination. Existing production recovery behavior remains unchanged.
- Dedicated new-project email templates use numeric OTP entry and a static staging landing link. They do not place access/refresh tokens in links. The existing signup-fragment callback is retained for compatibility and continues to validate credentials with the configured provider; no old token should be reused.
- Frontend synchronous request locking prevents reentrant signup/resend/logout submissions in one page. Cooldown cannot be bypassed by submitting the form programmatically. This is not cross-tab or server-wide idempotency; existing server/provider rate limits remain in place.
- Only isolated staging responses add the safe `email_rate_limited` classification. The UI explains that its timer is not proof of a provider quota reset. There is no automatic retry and no raw upstream diagnostic is exposed.

## Checks Codex executes locally

```bash
npm run typecheck
npm run build
npm run lint
npm test
npm run test:auth
npm run test:deployment
npm run test:browser
npm run check:staging:template
WRANGLER_SEND_METRICS=false npm run dry-run:staging
git diff --check
```

`check:staging:template` verifies the draft while allowing only the exact unresolved provider placeholder. It must never be used as release authorization. **`npm run check:staging` must fail until the real isolated URL is supplied.** A dry-run can package placeholders and does not establish a working provider, SMTP connection, registered secret or deployment readiness.

Unit/runtime tests use synthetic providers, disposable SQLite and actual local workerd/D1. Browser tests intercept API/tile responses. They validate implementation boundaries, not real email delivery or SMTP/provider settings. The existing homepage/map tests and legacy auth tests remain in place. No staging project URL/key is injected into the frontend bundle.

## Approved scope and current access blocker

The owner has explicitly approved creating one new Supabase project within verified free capacity, configuring a free receiving-only email sandbox, updating only the new project and staging bindings, and deploying/testing the existing staging Worker/D1. The absolute limits are 10 test users and 30 messages; the initial target remains at most two users and six messages. Paid upgrades, charges, production changes, DNS changes and Git commit/push remain prohibited. No repeat approval is required for this scope.

The non-secret execution record is `staging/isolation-plan.json`. Project reference, organization, region and sandbox account remain unassigned because there is no authenticated Supabase management connection or sandbox/SMTP connection in the execution environment. The Supabase integration was discovered but is not connected. Neither free capacity nor external-forwarding prevention can be verified without those connections. No project/account has been created, no SMTP settings have been applied, and no email has been sent. Do not paste credentials into chat or store them in this plan.

Connect the approved accounts through a secure authentication path before provisioning. This is an access prerequisite, not a request to authorize the same work again. Keep the unresolved provider placeholder and the failing release gate until the actual isolated project is available; never fall back to the shared provider to complete testing.

## Execution after approval and access are available

Codex performs these operations; they are not repetitive dashboard tasks delegated to the owner.

1. Verify the new project reference differs from `xchkkdfelwzzpyorjeks`. Never clone production users or copy production keys. Configure only the new project's Site URL as the staging origin and allow exactly the staging `/verify-email` URL.
2. Install the committed confirmation/recovery templates into the new project. Set a supported six-digit OTP and approved short expiry (proposed 300 seconds), require confirmed email, and retain the existing 12–128-character application password contract. Configure TLS SMTP to the dedicated test inbox, with forwarding/tracking disabled and no production sender/DNS changes. Validate the actual saved settings before mail tests. A default provider alone would retain strict quotas and recipient restrictions; it is not the repeatable-test solution.
3. Verify existing staging DB identity/ledger again; reuse it without rerunning migrations. Do not clear sessions/profiles as a shortcut. Match the new project's publishable key to the new URL through a read-only Auth settings check, without printing either credential or provider response bodies. Keep the existing staging encryption key unless there is a separately approved rotation reason; it is never copied from production. Cross-project session rejection is independent of key rotation.
4. Freeze staging test activity during cutover. Update only `wrangler.staging.jsonc`'s provider placeholder and the staging publishable-key secret; coordinate secret update and deploy so mismatched URL/key state is not exposed to testers. Run the full local checks and `npm run check:staging` with the real URL. Deploy using the explicit staging config only after all release prerequisites pass. Do not use the root local config, production build integration or `wrangler preview`.
5. Verify staged HTML/assets, anonymous `/api/auth/session` and role API 401 responses, and wrong-Origin 403 without contacting the old provider. Perform email tests only after the new runtime binding and provider settings are confirmed. Do not log credentials, request bodies, cookies, OTPs, URLs containing secrets or HAR files.
6. Register a disposable producer and buyer in the new project, verify actual SMTP reception, enter the OTP privately in an isolated browser, complete onboarding, verify secure cookie flags, reload persistence, cross-role 403, logout and old-cookie rejection. Test OTP expiry/replay and failure responses within the approved message budget. Provider settings, callback behavior and SMTP delivery require actual evidence, not a generic accepted API message. If interactive mailbox access is unavailable, stop at delivery-request evidence and let the owner complete proof privately; do not ask for tokens/passwords in chat.
7. Record deployment ID and sanitized pass/fail results. Leave production unmodified and retain the source changes uncommitted unless separately requested. No automatic merge/push to main is part of this task.

## Rollback and remaining security boundaries

A configuration rollback to the shared provider would break the isolation requirement and can make old namespace cookies relevant again; it is not an automatic fallback. If cutover fails, keep staging testing paused and fix forward with the isolated project. Do not delete the old provider user, reset passwords, rotate project keys, drop D1 tables or restore old sessions. Any temporary staging-access restriction or destructive cleanup needs its own scoped authorization.

Application logout removes the app's D1 session and cookie, even when the provider is unavailable. It does not claim to revoke every provider session or an already exposed access token. No refresh token is persisted by the Worker. Provider-side token revocation remains separate and must not affect existing production users.

## Verification record — 2026-10-22 (Asia/Rangoon)

- Type checking, Vite build, lint, and `git diff --check`: passed.
- Existing prototype tests: 32 passed; auth tests: 43 passed, including legacy contracts and real local workerd/D1 isolation; deployment tests: 8 passed; browser tests: 23 passed.
- Draft staging template check and final staging dry-run: passed. The final bundle was 24.01 KiB (gzip 6.79 KiB).
- Real release preflight: blocked with exit code 1 because the isolated provider URL is unresolved. This is an unmet prerequisite, not a successful release check.
- Existing staging read-only checks: homepage and `/verify-email` 200, anonymous session API 401. Live version remains `2bc50d9f-5e6f-46da-ab63-6963eaa2f63f`, and still points at the shared provider.
- D1 ledger 0001–0003 and existing schema verified read-only. No migrations applied. Required existing secret names verified; their values were not read or replaced.
- Production/local Wrangler config, homepage source/CSS, GIS/map files and migration files matched their starting hashes. Server provider/key settings were absent from the frontend bundle; no credential patterns were detected in this task's changed/new text files.
- No resource creation, SMTP signup/configuration, actual email, test-user creation, secret update, deployment, commit or push performed. Remote isolation and live email/session acceptance remain pending authenticated provider access.

## Authorized continuation verification

- Owner approval is recorded for free-only isolated provisioning and staging deployment; account access is the remaining prerequisite. Supabase integration discovery found an available but unconnected integration. No authenticated sandbox connection is available. Organization, region, free allocation and SMTP delivery containment remain unverified.
- Re-executed type checking, build, lint and 32 prototype tests: passed. Auth tests initially terminated in the restricted runtime, then passed all 43 tests with local runtime execution permitted. Browser tests passed all 23 tests with the existing local browser libraries. Deployment tests, draft config checks and dry-run passed. Real `check:staging` failed as intended on the unresolved isolated provider URL.
- Read-only deployment history confirms the existing staging version remains `2bc50d9f-5e6f-46da-ab63-6963eaa2f63f`. No new deployment was made. No real signup, confirmation, session, login, logout or recovery acceptance test was attempted against the shared provider. Test users created: 0; email messages sent: 0.
- This continuation updates only this record and `staging/isolation-plan.json`; prior implementation and user configuration edits are retained.

## Owner-supplied isolated project connection

The owner supplied project reference `heaswpawzuuijxurlfoz` and URL `https://heaswpawzuuijxurlfoz.supabase.co`. Only the staging config provider URL was updated; account, Worker, D1, Origin, routing and the pre-existing local config remain unchanged. The plan records this owner-supplied identity without claiming management-side verification. Earlier placeholder-related failures in this document are historical.

No management connector, management credential or new-project publishable key is accessible in this execution session. Cloudflare secret listing confirms names only; it cannot establish that the stored publishable key belongs to the new project. Do not deploy a potentially mismatched URL/key pair. A secure new-project key connection or owner-side staging secret registration followed by safe validation is required. Sandbox SMTP containment and new-project Auth settings also remain unverified. No key was requested in chat, read from Cloudflare, replaced or printed. No actual deployment, email or user creation was performed during this connection attempt.
