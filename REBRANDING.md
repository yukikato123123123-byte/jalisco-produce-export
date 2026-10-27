# NopaHua rebrand and food-commerce retirement

## Executable application

Public and authentication branding is NopaHua. Normal login lands on `/account`, administrators on `/admin`, and recovery sessions on `/reset-password`. The authentication provider, OTP/link verification, recovery fencing, session cryptography and grant authority remain unchanged. New signup UI collects email/password and optional display name; it sends the neutral research registration mode. Legacy metadata shapes remain accepted by the common authentication boundary for compatibility, but cannot invoke business onboarding or confer privileges.

The administrator workspace contains Overview, Product concept, Ritual, Origin, Contact & Feedback, Launch List, Research Access, Survey Results, Activity Log and Settings. The overview queries actual research, feedback and launch counts. Product concept is code-managed and has no stored product listings, sales or invented product facts. Survey Results includes aggregate distributions and admin-only raw answers.

## Retired requests

HTTP 410 replaces `/platform`, `/explore`, `/producers/*`, `/buyers/*`, `/producer/*`, `/buyer/*`, `/workspace`, `/logistics`, `/commercial`, `/readiness`, `/inquiries`, `/admin/preview` and food-specific administrator section bookmarks. Historical farm images are removed from public assets and their old paths return 410. Other unknown pages return 404 rather than a working commerce SPA.

Public food directory APIs return 410. Private producer/buyer/inquiry/image APIs still require the existing authenticated session, then return 410. Retired admin products/profiles/reviews/readiness/notifications/drafts/actions/grants/inquiry endpoints retain admin authorization before returning 410. No retired request dispatches a business read or mutation. Common contact requests use the existing private feedback service.

All staging/local pages now run the Worker first (`/*`) so asset fallback cannot bypass retirement or research access. The strict staging preflight requires this routing. Production config is unchanged.

## Preservation

`legacy/food-platform/manifest.json` lists original source/assets/food-only tests with SHA-256 hashes. Sources and historical tests are stored as `.txt` reference files; original image bytes are outside `public/`. The previous README is retained under `context/`. They are outside the TypeScript, Worker, Vite and active test graphs, and requests to this directory are not served.

All existing schema migrations and data remain intact, including profiles, business items, inquiries, reviews, image/storage references, admin grant records, research responses and audit events. No DB reset, DROP, DELETE, RLS change or remote migration is part of this rebrand. Historical audit records remain readable with neutral archived-history labels. Internal table names, old role types, cookie/storage keys, consent versions and Cloudflare identifiers are retained for compatibility.

`worker/owner/*`, signing/recovery logic and existing admin-grant enforcement remain byte-identical. The owner protocol retains historical transaction internals for governance/reconciliation compatibility; the public Worker no longer exposes food mutation endpoints. The user explicitly approved adapting three owner test files: disposable historical fixtures replace retired onboarding, supported private reads exercise the same barriers, and private fixture calls retain uncertain-write, receipt, concurrency and cancellation coverage. No tests are skipped or disabled. Food-only tests move with the retired features; active authentication, cryptographic owner authority, research and cosmetic-service tests continue to run.

## Operational notes

No finished cosmetic product photograph is presented: powder/water material crops are labeled concept studies. Existing cosmetic reference asset filenames are internal and do not change the current brand. Leaflet and its types are removed from dependencies; no replacement library is added.

Actual email delivery and changes to real account passwords are deliberately not triggered for a visual rebrand. Local provider-backed tests retain verification/recovery coverage. Staging verification uses authorized existing accounts, preserves survey responses, and revokes temporary research access after checking it.

## Executed staging verification

Deployed staging version: `0e826bfc-086f-412d-81e8-920ea4336105`.

- Typecheck, lint, 424-phrase translation coverage, build, strict staging preflight and dry-run passed.
- All 235 active Node and 67 active browser tests passed with zero failures, cancellations or skips. After the final title-case brand correction, 9 relevant public/auth/admin browser cases passed again. 37 obsolete food-only test files remain byte-preserved as archival specifications, not claimed as current passing tests.
- Real browser checks passed at 375/768/1440 pixels: public/auth branding, homepage login link, invalid login 400, valid login 200 and ordinary destination `/account`, administrator menus and aggregates, retired HTML/API 410, unknown HTML 404, private research and separated result sharing, duplicate submission without overwriting, revoke in the same session and open-page revalidation, logout 200 and anonymous API 401. No page exceptions were observed.
- Remote counts before/after: profiles 4, historical items 3, inquiries 2, admin grants 1, admin grant events 1, feedback 4, feedback events 9, launch subscriptions 2 and research responses 1 all unchanged. Research audit events rose from 3 to 6 solely for the authorized view grant, separate aggregate grant and revoke checks. Temporary research permission ended revoked; the original response remained byte-identical.
- All 93 archived source/assets/test/document entries were hash-verified. 36 security/schema/configuration files, including every existing migration, owner implementation and production config, remained unchanged. No commit was created.
- No real signup email, recovery email or real password update was triggered. Their API/provider-backed behavior was covered locally; live mail delivery is not claimed.
