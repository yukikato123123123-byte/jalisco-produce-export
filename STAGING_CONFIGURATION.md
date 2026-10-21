# Local staging configuration preparation

This document describes local configuration and future verification steps. It does not authorize or perform remote provisioning, configuration, migrations, or deployment. Keep the existing `wrangler.jsonc` for local development. Do not change the production site, design, or map code.

## Configuration and unresolved values

`wrangler.staging.jsonc` targets the separate Worker `jalisco-auth-staging`. It connects `worker/index.ts` and `dist/` in one deployment configuration: `/api/*` runs the Worker first, while other paths serve SPA assets. If the Worker receives a non-API request, it forwards it to `ASSETS.fetch()`.

The following placeholders are intentionally incomplete. Do not use the current file for remote commands.

| Item | Required confirmation |
| --- | --- |
| `account_id` | Approved non-production Cloudflare account ID |
| `DB.database_id` | Separately provisioned and approved staging D1 UUID; do not use the production database or the local all-zero UUID |
| `AUTH_ORIGIN` | Confirmed HTTPS staging origin, with no path or trailing slash |
| Staging hostname | No routes are currently configured, and workers.dev and preview URLs are disabled. Access requires a separately approved exact custom domain/route or an explicitly approved change to the workers.dev policy |
| `SUPABASE_URL` | HTTPS base URL of a separate non-production project. Configure it in the Worker runtime; no value is included in the current file |
| `SUPABASE_PUBLISHABLE_KEY` | Key from the same non-production project. Configure it as a Worker secret; it has not been created or registered here |
| `SESSION_ENCRYPTION_KEY` | An independent staging-only 32-byte key represented as 64 hexadecimal characters. Generate, store, and register it later through an approved secret-management process. Do not copy the production key |

The `ASSETS` and `DB` binding names match the Worker code. Do not put the Supabase URL/key or encryption key in `VITE_` variables or frontend code. Configure SMTP credentials only in Supabase. Preserve the existing `.gitignore` exclusions for `.dev.vars`, `.dev.vars.*`, `.env*`, `.wrangler/`, and `dist/`. `.dev.vars.example` is intentionally trackable and must never contain real values. Do not read or copy users' secret files.

## Local verification commands

Run from the project root using only the dependencies already installed. These steps do not include package installation or remote operations.

```bash
npm run typecheck
npm run build
npm run lint
npm test
npm run test:auth
git diff --check
```

`typecheck` checks both the frontend and Worker. `build` regenerates `dist/` with Vite. A Vite development/preview server alone does not verify the authentication Worker. Calling a local API connected to remote Supabase makes real remote requests, so do not do so during this preparation stage.

### Optional bundle dry-run — not executed in this task

The command below is an example of a **local Wrangler bundle check**. Do not remove `--dry-run`. The installed CLI may reject placeholders as invalid values; do not substitute production values or an arbitrary database UUID to bypass this. If necessary, defer the check until approved non-secret staging identifiers are confirmed.

First review whether automatically loaded `.env*`, `.dev.vars*`, shell variables, or local CLI settings could inject sensitive values, **without displaying those values**. If actual secret files other than example files are present, stop and verify in an isolated copy without secrets. A network-blocked environment provides the strongest assurance; disabling telemetry alone does not guarantee that no network access occurs.

```bash
WRANGLER_SEND_METRICS=false ./node_modules/.bin/wrangler deploy --dry-run --config ./wrangler.staging.jsonc --outdir ./.wrangler/staging-dry-run
```

Acceptance criteria: a Worker module bundle is generated; `ASSETS` and `DB` bindings are recognized; static assets use `dist/`; and API Worker-first routing and SPA settings are configured. Static assets are connected through the same deployment configuration rather than embedded in the Worker JavaScript. Do not assume that dry-run copies all assets into its output directory. A successful dry-run is not evidence of upload, routing, database connectivity, SMTP delivery, or successful authentication. Keep secret values out of logs and artifacts, and review them before sharing.

Local authentication contract tests and browser mock tests also do not replace real Supabase email verification. Follow the runbook in `AUTHENTICATION.md` for the full remote verification matrix and approval process.

## Production automatic deployment checklist — unverified until remote inspection

Obtain separate approval before remote inspection. Local code alone cannot establish the actual production deployment path.

- Confirm the actual production Cloudflare Worker name, account, current version, connected build repository, branch, and root directory.
- Identify the actual deployment mechanism and full commands: dashboard upload, external Git integration, or CI.
- Check whether deployment uploads only `dist/` or uses only `--assets`, and whether it explicitly selects a configuration containing `main: worker/index.ts`.
- Confirm that the build generates an up-to-date `dist/` and also runs Worker type checking.
- Ensure staging explicitly selects its separate config and does not share the production Worker name, route, database, or key.
- Check whether existing automatic deployment could overwrite a manual transition with an assets-only version. Changes to automatic deployment also require separate approval.
- Secure a recoverable version/artifact of the existing static site before planning a separate production transition. Changing the production URL is outside this task's scope.

## Approval requirements for future work

Verify in separate staging first, without modifying the current production Worker. Remote inspection, staging Worker/D1/hostname provisioning, Supabase/SMTP configuration, secret generation/registration, remote migrations, deployment, and real email tests each require explicit approval identifying their target and scope. No remote command was executed here.

For D1, review migrations in `0001` → `0002` → `0003` order and inspect the actual migration ledger. **0003 invalidates existing sessions in the target database.** Apply it only after separate approval. Do not treat Supabase's default confirmation-link flow as completed application authentication. The current code uses numeric OTP entry; signup/recovery templates, expiry, and instructions linking to the exact HTTPS `/verify-email` page must be verified in the actual project.
