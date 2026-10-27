# Administrator compatibility integration

Reference: Git commit `2138361529809aea3064603820b080eac3cd1031`. Existing dirty changes were backed up outside the repository before implementation. No resets, cleanup, commits, pushes, deployments or remote migrations were performed.

## Entry points

- `/admin`: existing NopaHua operations, including the current five administrator languages.
- `/admin?workspace=nopahua&section=...`: explicit NopaHua workspace; new navigation includes this discriminator.
- `/admin?workspace=legacy&section=...`: restored original EN/ES administrator console, loaded on demand with scoped styles and original vocabulary.
- Bare historical sections such as `?section=products` and `?section=reviews/producer` enter legacy. Bare `?section=overview` remains NopaHua; legacy overview uses explicit workspace.
- `/admin/preview`: original synthetic staging-only, GET-only preview, with original server environment gates and the browser origin gate. It never grants access or exposes real records.

## Contracts and dependencies

`/api/admin/overview` again returns the original marketplace overview, including counts, approvals, inquiries, health, trends and recent product images. `/api/admin/operations-overview` remains the unchanged NopaHua response. Original list endpoints retain 50 rows and `hasMore`; NopaHua endpoints retain 10 rows, exact totals and clamping.

The original administrator implementation is isolated in `worker/legacyAdmin.ts`. The existing grant predicate is unchanged. Original notifications, drafts, review decisions/history, inquiry workflow, visibility changes, account/product/producer/buyer lists and access history use their original SQL and validation. The removed helper import from `producer.ts` is replaced only where needed with the byte-identical `fields.ts` text validator.

Supporting producer/buyer/onboarding/directory APIs are restored from the reference to preserve administrator workflows and test their real effects. Research signup remains neutral and creates neither a business profile nor research/admin access. Public marketplace screens stay retired; the NopaHua homepage remains the public default.

Original image access guards, post-deletion cleanup and staging scheduled cleanup are restored. Storage object access and tombstone retries are tested with isolated mocks; real Supabase storage connectivity was not exercised.

No tables, policies or migrations were changed or applied. Existing marketplace records and NopaHua `research_*` / `nopal_*` records remain separate. The existing authentication helpers, Owner implementation, environment checks, grant predicate, migration files and deployment configurations are protected by explicit source-hash tests.

Owner gateway behavior is deliberately unchanged: only POST `/api/admin/actions` is supported. Other legacy/NopaHua write endpoints stay rejected in that mode. No automatic fallback to direct D1 is introduced.

## Test policy

Restored original successful mutation, signed action receipt, revocation, idempotency, concurrency, notification watermark, draft ownership, review revision and private image assertions replace obsolete blanket-410 expectations. Existing NopaHua assertions remain. Archive hash checks remain; reviewed compatibility dependencies are explicitly allowed back into active source while unrelated storefront pages remain retired. The public Worker continues to reject the authority's `/internal/admin` path with 404.

All writes use disposable in-memory SQLite/Miniflare and synthetic provider/storage fixtures. No real user, grant, response, message or email is used. Preview browser rendering uses a fully intercepted staging origin and local build assets; it is not a live staging test.


## Task file manifest

Compared with the pre-task hash snapshot, not with HEAD. Restored files may disappear from Git deletion status because they match HEAD.

### Modified

- `scripts/check-ui-translations.mjs`
- `src/components/AdminPage.tsx`
- `src/main.tsx`
- `src/translations/admin.ts`
- `src/translations/es-extra.ts`
- `tests/admin-grants.test.mjs`
- `tests/admin-login.test.mjs`
- `tests/admin-owner-boundary.test.mjs`
- `tests/auth-d1.test.mjs`
- `tests/auth-isolation.test.mjs`
- `tests/auth-security.test.mjs`
- `tests/auth.test.mjs`
- `tests/owner-d1-boundary.test.mjs`
- `tests/owner-grants-workerd.test.mjs`
- `tests/owner-grants.test.mjs`
- `tests/rebrand.test.mjs`
- `worker/admin.ts`
- `worker/index.ts`
- `worker/retiredRoutes.ts`
- `playwright.config.ts`
- `ADMIN_COMPATIBILITY.md`

### Restored or new

- `scripts/run-isolated-browser-worker.mjs`
- `src/components/AdminDashboard.tsx`
- `src/components/AdminNotifications.tsx`
- `src/components/AdminWorkspaceRouter.tsx`
- `src/components/BuyerInquiry.tsx`
- `src/components/InquiriesPage.tsx`
- `src/components/LegacyAdminPage.tsx`
- `src/components/ProductImages.tsx`
- `src/components/RecordDetailPanel.tsx`
- `src/components/RegistrationReview.tsx`
- `src/components/WorkspaceIcon.tsx`
- `src/components/admin-notifications.css`
- `src/components/legacy-admin.css`
- `src/components/product-images.css`
- `src/legacyI18n.ts`
- `src/legacyLocalization.tsx`
- `src/productImages.ts`
- `src/translations/legacy-admin-es.ts`
- `tests/admin-compatibility.test.mjs`
- `tests/admin-d1.test.mjs`
- `tests/admin-extras-d1.test.mjs`
- `tests/admin-notifications-drafts.test.mjs`
- `tests/admin-preview.test.mjs`
- `tests/admin-security-preservation.test.mjs`
- `tests/admin.test.mjs`
- `tests/browser/admin-compatibility.spec.ts`
- `tests/browser/admin-notifications-drafts.spec.ts`
- `tests/browser/admin-review.spec.ts`
- `tests/browser/inquiry-workflow.spec.ts`
- `tests/browser/registration-reviews.spec.ts`
- `tests/directory.test.mjs`
- `tests/inquiries.test.mjs`
- `tests/overview.test.mjs`
- `tests/producer.test.mjs`
- `tests/product-images.test.mjs`
- `tests/registration-reviews.test.mjs`
- `worker/adminExtras.ts`
- `worker/adminPreview.ts`
- `worker/buyer.ts`
- `worker/directory.ts`
- `worker/inquiries.ts`
- `worker/legacyAdmin.ts`
- `worker/overview.ts`
- `worker/producer.ts`
- `worker/productImages.ts`
- `worker/reviews.ts`

### Removed

None.


## Final verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run check:translations`: 705 shared/legacy phrases and 205 administrator phrases; no missing translations.
- `npm run check:staging`: passed static non-secret configuration validation only.
- `npm run build`: passed. Legacy JavaScript and CSS are separate lazy chunks.
- `npm test`: 304 passed, 0 failed, 0 skipped. Includes protected source hashes, original API/security contracts and NopaHua regressions.
- `LD_LIBRARY_PATH=/tmp/jalisco-browser-libs/extracted/usr/lib/x86_64-linux-gnu npm run test:browser`: 130 passed, 0 failed. Final browser run uses a freshly migrated temporary local D1 via the isolated launcher; earlier browser runs used the existing local test store. No staging database or real email was used.
- `git diff --check`: passed.

Intermediate failures were corrected, including obsolete blanket-410 expectations, a minute-boundary rate-limit fixture, and legacy mobile style isolation. Final suites have no failures or skipped cases. Live provider login, Supabase storage operations and real staging rendering were not verified in this local-only task. Preview staging-origin browser requests were intercepted fixtures, not live staging requests.

Branch and HEAD remain `feature/secure-authentication` / `2138361529809aea3064603820b080eac3cd1031`. Final Git status: staged 0, unstaged 102, untracked 191 (files, including existing archive files). Initial counts were 0 / 129 / 179. Restoring files identical to HEAD reduces deleted-file status; no pre-task source file was deleted. No commit, push, deployment, remote migration, secret or administrator grant modification was performed.
