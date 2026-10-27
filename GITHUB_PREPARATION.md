# GitHub integration candidate — local staging source

No commit, push, main modification, deployment or remote database write is authorized or performed by this preparation. The candidate is the local source, not proof of the currently deployed Worker version.

## Baseline and delivery

- Feature: `feature/secure-authentication`, HEAD `2138361529809aea3064603820b080eac3cd1031`.
- Read-only remote check: feature SHA matches HEAD; main is `4160e8bc3efd01d6c6216ea2622a1380614ec27c`.
- Main is an ancestor of feature (three committed changes ahead before the candidate). Do not force push or delete main. After separate approval, commit the reviewed index on feature, push a review branch and merge its reviewed PR into main. The resulting main tree should match the approved candidate. Review workflow deployment triggers before any push.
- No new commit SHA exists yet. An index tree SHA is not a commit SHA and is not a staging deployment identifier.

## Preparation changes

1. Removed the unused `.farm-account-art` CSS rule; no component uses it. This removes the missing retired-image reference without restoring a public retired asset or removing a functioning administrator feature.
2. Replaced personal email addresses and the known user UUID in documentation and diagnostic/setup examples with reserved example identities. Setup defaults are now examples: operators must explicitly supply the reviewed real subject when using tools. No remote identity, grant, secret, Worker configuration or auth/security implementation was changed.
3. One archived test contained a personal identity; it was redacted and its manifest hash was updated. The unredacted originals were backed up outside the repository before editing. The archive is required by current integrity tests and is deliberately included, rather than silently omitted or duplicated into active source.
4. Increased only Playwright web-server provisioning timeout from 60 to 180 seconds for cold temporary D1 initialization. Test timeouts and assertions are unchanged.

## Preservation and scope

`/admin` remains NopaHua; explicit legacy workspace and staging-only synthetic preview remain. The legacy overview and 50-row/hasMore contracts remain separate from NopaHua operations overview and 10-row/total contracts. Protected auth, provider, environment, Owner and migration files remain unchanged. Existing marketplace storefront pages stay retired as in the input working tree; their source is archived. Main will therefore receive the existing NopaHua rebrand, restored admin coexistence, supporting backend APIs and intentional storefront retirements together.

## Privacy review

All candidate text files were checked for private-key headers, JWTs, common provider token prefixes, credential-bearing database URIs, personal mailbox addresses and the previously supplied password. Remaining password/token literals are synthetic test fixtures and rejection sentinels, not deployed credentials. The placeholder-only `.dev.vars.example` is included. Public resource IDs and public keys are not secrets. Binary assets are design images/fonts, not exported user databases. This is a scoped pattern/manual review, not a guarantee that any possible secret format can be detected.

## Exclusions

9,929 existing ignored files were excluded at preparation start: npm cache 820, Worker local state 1,340, dist 19, node_modules 7,749 and test-results 1. Git quoted eleven Unicode Worker filenames separately; they belong to Worker local state. No ignored file was deleted or moved. No additional candidate source was excluded.

## Reproduction

A fresh temporary source export contains only the 355 candidate files existing before this report, without secrets, original node_modules, dist, .wrangler or test results. `npm ci --ignore-scripts --no-audit --no-fund` installed 208 packages from the lockfile. All source/config changes, including timeout adjustment, were copied into that export. This is an independent file export, not a Git clone or a live staging checkout. This report adds one non-executable candidate file.

## Checks

- Typecheck, ESLint, shared/admin translations and staging static validation: passed in the independent export.
- Node suite: 304 passed, 0 failed, 0 skipped.
- `build({build:{write:false}})`: passed without missing-image warnings.
- Normal production bundle build in the temporary export: passed without that warning, providing assets for local browser tests. No deployment ran.
- Browser suite: 130 passed, 0 failed in the independent export (4.5 minutes). Initial cold startup exceeded 60 seconds; a diagnostic standalone server caused one retry to detect an occupied port. The diagnostic server was stopped; the final isolated run passed all 130 tests. No reuse of an unrelated server was enabled.
- Real Supabase login, email, storage and live staging browser checks: not run; no real account/data mutation.

## Intended deletions

Each listed path was already absent at preparation start. All have archive copies. Active builds and restored administrator tests exercise their replacement dependencies; retired public pages/GIS code and their obsolete browser tests are not required by the integrated administrator. HEAD-versus-archive differences reflect prior local work, not new data loss. No deletion of an uncertain new file was introduced.

| Deleted path | Classification | Archive vs HEAD |
| --- | --- | --- |
| `PRODUCER_WORKSPACE.md` | Archived old document or retired public asset | Identical |
| `UI_AUDIT.md` | Archived old document or retired public asset | Identical |
| `public/images/el-grullo-farm.jpeg` | Archived old document or retired public asset | Identical |
| `public/images/el-grullo-fields.jpeg` | Archived old document or retired public asset | Identical |
| `public/images/jalisco-sunrise-hero-v1.png` | Archived old document or retired public asset | Identical |
| `public/images/jalisco-sunrise-hero-v1.provenance.json` | Archived old document or retired public asset | Identical |
| `public/images/nopal-harvest.jpeg` | Archived old document or retired public asset | Identical |
| `src/components/BusinessSections.tsx` | Retired public UI/test or GIS dependency | Identical |
| `src/components/BuyerCenter.tsx` | Retired public UI/test or GIS dependency | Identical |
| `src/components/BuyerDirectoryEntry.tsx` | Retired public UI/test or GIS dependency | Identical |
| `src/components/BuyerPublication.tsx` | Retired public UI/test or GIS dependency | Identical |
| `src/components/DirectoryPage.tsx` | Retired public UI/test or GIS dependency | Identical |
| `src/components/ExploreProduce.tsx` | Retired public UI/test or GIS dependency | Identical |
| `src/components/FarmStory.tsx` | Retired public UI/test or GIS dependency | Identical |
| `src/components/HomePage.tsx` | Retired public UI/test or GIS dependency | Preserved prior local variant |
| `src/components/MapLegend.tsx` | Retired public UI/test or GIS dependency | Identical |
| `src/components/MarketMap.tsx` | Retired public UI/test or GIS dependency | Identical |
| `src/components/ProducerDashboard.tsx` | Retired public UI/test or GIS dependency | Identical |
| `src/components/ProductPhotoEditor.tsx` | Retired public UI/test or GIS dependency | Identical |
| `src/components/StatusBadge.tsx` | Retired public UI/test or GIS dependency | Identical |
| `src/components/SupplyMarketOverview.tsx` | Retired public UI/test or GIS dependency | Identical |
| `src/components/TradePages.tsx` | Retired public UI/test or GIS dependency | Identical |
| `src/components/home.css` | Retired public UI/test or GIS dependency | Preserved prior local variant |
| `src/demoData.ts` | Retired public UI/test or GIS dependency | Identical |
| `src/gisDemoData.ts` | Retired public UI/test or GIS dependency | Identical |
| `src/gisDepth.ts` | Retired public UI/test or GIS dependency | Identical |
| `src/gisDetails.ts` | Retired public UI/test or GIS dependency | Identical |
| `src/gisLeaflet.ts` | Retired public UI/test or GIS dependency | Identical |
| `src/gisNetwork.ts` | Retired public UI/test or GIS dependency | Identical |
| `src/gisSymbols.ts` | Retired public UI/test or GIS dependency | Identical |
| `src/inquiry.ts` | Retired public UI/test or GIS dependency | Identical |
| `src/mapBasemap.ts` | Retired public UI/test or GIS dependency | Identical |
| `src/mapBehavior.ts` | Retired public UI/test or GIS dependency | Identical |
| `src/platform.css` | Retired public UI/test or GIS dependency | Identical |
| `src/redesign.css` | Retired public UI/test or GIS dependency | Identical |
| `src/sampleData.ts` | Retired public UI/test or GIS dependency | Identical |
| `tests/browser/areas.spec.ts` | Retired public UI/test or GIS dependency | Identical |
| `tests/browser/buyer-publication.spec.ts` | Retired public UI/test or GIS dependency | Identical |
| `tests/browser/controls.spec.ts` | Retired public UI/test or GIS dependency | Preserved prior local variant |
| `tests/browser/home-design.spec.ts` | Retired public UI/test or GIS dependency | Preserved prior local variant |
| `tests/browser/language-inquiries.spec.ts` | Retired public UI/test or GIS dependency | Preserved prior local variant |
| `tests/browser/layout.spec.ts` | Retired public UI/test or GIS dependency | Identical |
| `tests/browser/map-basemap.spec.ts` | Retired public UI/test or GIS dependency | Identical |
| `tests/browser/overview.spec.ts` | Retired public UI/test or GIS dependency | Preserved prior local variant |
| `tests/browser/platform.spec.ts` | Retired public UI/test or GIS dependency | Preserved prior local variant |
| `tests/browser/product-images.spec.ts` | Retired public UI/test or GIS dependency | Identical |
| `tests/browser/redesign.spec.ts` | Retired public UI/test or GIS dependency | Preserved prior local variant |
| `tests/browser/ui-consistency.spec.ts` | Retired public UI/test or GIS dependency | Preserved prior local variant |
| `tests/charts.test.mjs` | Retired public UI/test or GIS dependency | Identical |
| `tests/gis.test.mjs` | Retired public UI/test or GIS dependency | Identical |
| `tests/localization-global.test.mjs` | Retired public UI/test or GIS dependency | Identical |
| `tests/presentation.test.mjs` | Retired public UI/test or GIS dependency | Identical |
| `tests/prototype.test.mjs` | Retired public UI/test or GIS dependency | Identical |
| `tests/staging-readonly.test.mjs` | Retired public UI/test or GIS dependency | Preserved prior local variant |

## Complete inclusion manifest

356 files including this report; paths relative to repository root.

```text
.dev.vars.example
.gitignore
ADMIN_COMPATIBILITY.md
ADMIN_LANGUAGES.md
ADMIN_REDESIGN.md
ADMIN_TRUST_INIT.md
AUTHENTICATION.md
AUTH_DEPLOYMENT.md
GITHUB_PREPARATION.md
NOPAHUA_RESEARCH.md
OWNER_RECOVERY.md
README.md
REBRANDING.md
SIGNUP_REDESIGN.md
STAGING_ADMIN_EXECUTION.md
STAGING_CONFIGURATION.md
STAGING_ISOLATION.md
STAGING_KEY_RECOVERY.md
STAGING_KEY_REPLACEMENT_PLAN.md
eslint.config.js
index.html
legacy/food-platform/PRODUCER_WORKSPACE.md.txt
legacy/food-platform/README.md
legacy/food-platform/UI_AUDIT.md.txt
legacy/food-platform/context/README.before-rebrand.md.txt
legacy/food-platform/manifest.json
legacy/food-platform/public/images/el-grullo-farm.jpeg
legacy/food-platform/public/images/el-grullo-fields.jpeg
legacy/food-platform/public/images/jalisco-sunrise-hero-v1.png
legacy/food-platform/public/images/jalisco-sunrise-hero-v1.provenance.json
legacy/food-platform/public/images/nopal-harvest.jpeg
legacy/food-platform/src/components/AdminDashboard.tsx.txt
legacy/food-platform/src/components/AdminNotifications.tsx.txt
legacy/food-platform/src/components/BusinessSections.tsx.txt
legacy/food-platform/src/components/BuyerCenter.tsx.txt
legacy/food-platform/src/components/BuyerDirectoryEntry.tsx.txt
legacy/food-platform/src/components/BuyerInquiry.tsx.txt
legacy/food-platform/src/components/BuyerPublication.tsx.txt
legacy/food-platform/src/components/DirectoryPage.tsx.txt
legacy/food-platform/src/components/ExploreProduce.tsx.txt
legacy/food-platform/src/components/FarmStory.tsx.txt
legacy/food-platform/src/components/HomePage.tsx.txt
legacy/food-platform/src/components/InquiriesPage.tsx.txt
legacy/food-platform/src/components/MapLegend.tsx.txt
legacy/food-platform/src/components/MarketMap.tsx.txt
legacy/food-platform/src/components/ProducerDashboard.tsx.txt
legacy/food-platform/src/components/ProductImages.tsx.txt
legacy/food-platform/src/components/ProductPhotoEditor.tsx.txt
legacy/food-platform/src/components/RecordDetailPanel.tsx.txt
legacy/food-platform/src/components/RegistrationReview.tsx.txt
legacy/food-platform/src/components/StatusBadge.tsx.txt
legacy/food-platform/src/components/SupplyMarketOverview.tsx.txt
legacy/food-platform/src/components/TradePages.tsx.txt
legacy/food-platform/src/components/WorkspaceIcon.tsx.txt
legacy/food-platform/src/components/admin-notifications.css.txt
legacy/food-platform/src/components/home.css.txt
legacy/food-platform/src/components/product-images.css.txt
legacy/food-platform/src/demoData.ts.txt
legacy/food-platform/src/gisDemoData.ts.txt
legacy/food-platform/src/gisDepth.ts.txt
legacy/food-platform/src/gisDetails.ts.txt
legacy/food-platform/src/gisLeaflet.ts.txt
legacy/food-platform/src/gisNetwork.ts.txt
legacy/food-platform/src/gisSymbols.ts.txt
legacy/food-platform/src/inquiry.ts.txt
legacy/food-platform/src/mapBasemap.ts.txt
legacy/food-platform/src/mapBehavior.ts.txt
legacy/food-platform/src/platform.css.txt
legacy/food-platform/src/productImages.ts.txt
legacy/food-platform/src/redesign.css.txt
legacy/food-platform/src/sampleData.ts.txt
legacy/food-platform/tests/admin-d1.test.mjs.txt
legacy/food-platform/tests/admin-extras-d1.test.mjs.txt
legacy/food-platform/tests/admin-notifications-drafts.test.mjs.txt
legacy/food-platform/tests/admin-pagination.test.mjs.txt
legacy/food-platform/tests/admin-preview.test.mjs.txt
legacy/food-platform/tests/admin.test.mjs.txt
legacy/food-platform/tests/browser/admin-notifications-drafts.spec.ts.txt
legacy/food-platform/tests/browser/admin-pagination.spec.ts.txt
legacy/food-platform/tests/browser/admin-review.spec.ts.txt
legacy/food-platform/tests/browser/areas.spec.ts.txt
legacy/food-platform/tests/browser/buyer-publication.spec.ts.txt
legacy/food-platform/tests/browser/controls.spec.ts.txt
legacy/food-platform/tests/browser/home-design.spec.ts.txt
legacy/food-platform/tests/browser/inquiry-workflow.spec.ts.txt
legacy/food-platform/tests/browser/language-inquiries.spec.ts.txt
legacy/food-platform/tests/browser/layout.spec.ts.txt
legacy/food-platform/tests/browser/legacy-home-language.spec.ts.txt
legacy/food-platform/tests/browser/map-basemap.spec.ts.txt
legacy/food-platform/tests/browser/nopal-operations.spec.ts.txt
legacy/food-platform/tests/browser/overview.spec.ts.txt
legacy/food-platform/tests/browser/platform.spec.ts.txt
legacy/food-platform/tests/browser/product-images.spec.ts.txt
legacy/food-platform/tests/browser/redesign.spec.ts.txt
legacy/food-platform/tests/browser/registration-reviews.spec.ts.txt
legacy/food-platform/tests/browser/ui-consistency.spec.ts.txt
legacy/food-platform/tests/charts.test.mjs.txt
legacy/food-platform/tests/directory.test.mjs.txt
legacy/food-platform/tests/gis.test.mjs.txt
legacy/food-platform/tests/inquiries.test.mjs.txt
legacy/food-platform/tests/localization-global.test.mjs.txt
legacy/food-platform/tests/overview.test.mjs.txt
legacy/food-platform/tests/presentation.test.mjs.txt
legacy/food-platform/tests/producer.test.mjs.txt
legacy/food-platform/tests/product-images.test.mjs.txt
legacy/food-platform/tests/prototype.test.mjs.txt
legacy/food-platform/tests/registration-reviews.test.mjs.txt
legacy/food-platform/tests/staging-readonly.test.mjs.txt
legacy/food-platform/worker/adminExtras.ts.txt
legacy/food-platform/worker/adminPreview.ts.txt
legacy/food-platform/worker/buyer.ts.txt
legacy/food-platform/worker/directory.ts.txt
legacy/food-platform/worker/inquiries.ts.txt
legacy/food-platform/worker/overview.ts.txt
legacy/food-platform/worker/producer.ts.txt
legacy/food-platform/worker/productImages.ts.txt
legacy/food-platform/worker/reviews.ts.txt
migrations/0001_auth.sql
migrations/0002_limits_index.sql
migrations/0003_auth_generations.sql
migrations/0004_producer_workspace.sql
migrations/0005_buyer_center.sql
migrations/0006_buyer_publication.sql
migrations/0007_admin_operations.sql
migrations/0008_admin_grant_events.sql
migrations/0009_owner_command_receipts.sql
migrations/0010_inquiries.sql
migrations/0011_inquiry_workflow.sql
migrations/0012_registration_reviews.sql
migrations/0013_product_images.sql
migrations/0014_admin_notifications_drafts.sql
migrations/0015_nopal_launch_subscriptions.sql
migrations/0016_nopal_customer_feedback.sql
migrations/0017_nopahua_research.sql
package-lock.json
package.json
playwright.config.ts
public/assets/admin-languages/ja-400.woff2
public/assets/admin-languages/ja-600.woff2
public/assets/admin-languages/ja-OFL.txt
public/assets/admin-languages/ko-400.woff2
public/assets/admin-languages/ko-600.woff2
public/assets/admin-languages/ko-OFL.txt
public/assets/admin-languages/my-400.woff2
public/assets/admin-languages/my-600.woff2
public/assets/admin-languages/my-OFL.txt
public/assets/admin-languages/provenance.json
public/images/nopahua-signup-concept.provenance.json
public/images/nopahua-signup-concept.webp
public/images/nopal-reference.png
public/images/origin-water-study.svg
scripts/admin-approve.mjs
scripts/admin-grant.mjs
scripts/admin-key-prepare.mjs
scripts/admin-key-recovery.mjs
scripts/admin-prepare.mjs
scripts/admin-recovery-check.mjs
scripts/admin-setup.mjs
scripts/admin-trust-init.mjs
scripts/audit-layout.mjs
scripts/check-admin-translations.mjs
scripts/check-management-auth.py
scripts/check-staging-readonly.mjs
scripts/check-ui-translations.mjs
scripts/lib/admin-grant.mjs
scripts/lib/admin-key-recovery.mjs
scripts/lib/admin-key-store.mjs
scripts/lib/owner-grant-client.mjs
scripts/lib/owner-policy.mjs
scripts/owner-enrollment-sign.mjs
scripts/owner-sign.mjs
scripts/run-isolated-browser-worker.mjs
scripts/validate-deployment.mjs
scripts/verify-redesign-browser.mjs
scripts/verify-redesign-staging.mjs
src/accountDestination.ts
src/adminI18n.ts
src/adminLocalization.tsx
src/adminPortalEngine.ts
src/assets/design-reference.png
src/assets/nopal-illustration.svg
src/authLinks.ts
src/components/AccountPages.tsx
src/components/AdminAccessPortal.tsx
src/components/AdminDashboard.tsx
src/components/AdminLanguageMenu.tsx
src/components/AdminNotifications.tsx
src/components/AdminOverview.tsx
src/components/AdminPage.tsx
src/components/AdminPagination.tsx
src/components/AdminPortalScene.tsx
src/components/AdminResearchResults.tsx
src/components/AdminWorkspaceRouter.tsx
src/components/BuyerInquiry.tsx
src/components/CustomerFeedbackInbox.tsx
src/components/FilterBar.tsx
src/components/InquiriesPage.tsx
src/components/LanguageMenu.tsx
src/components/LegacyAdminPage.tsx
src/components/NopahuaResearch.tsx
src/components/NopalAtmosphere.tsx
src/components/NopalHomePage.tsx
src/components/NopalLaunchForm.tsx
src/components/NopalOperationsPanels.tsx
src/components/NopalVoiceForm.tsx
src/components/ProductImages.tsx
src/components/RecordDetailPanel.tsx
src/components/RegistrationReview.tsx
src/components/ResearchAccessPanel.tsx
src/components/ResearchAggregate.tsx
src/components/ResearchSignupPage.tsx
src/components/SiteChrome.tsx
src/components/SiteNav.tsx
src/components/WorkspaceIcon.tsx
src/components/account.css
src/components/admin-language.css
src/components/admin-notifications.css
src/components/admin-pagination.css
src/components/admin-portal.css
src/components/admin-redesign.css
src/components/admin.css
src/components/customer-feedback.css
src/components/legacy-admin.css
src/components/nopahua-research.css
src/components/nopal-home.css
src/components/nopal-operations.css
src/components/product-images.css
src/components/research-signup.css
src/feedbackStates.ts
src/homeAtmosphere.ts
src/i18n.ts
src/layout.css
src/legacyI18n.ts
src/legacyLocalization.tsx
src/localization.tsx
src/localizeNode.ts
src/main.tsx
src/nopalContent.ts
src/presentation.ts
src/productImages.ts
src/styles.css
src/translations/admin.ts
src/translations/es-extra.ts
src/translations/legacy-admin-es.ts
src/ui.css
staging/admin-approval-policy.example.json
staging/admin-approval-policy.json
staging/approval-public.pub
staging/emails/confirm-signup.html
staging/emails/recovery.html
staging/isolation-plan.json
staging/key-replacement-review.example.json
staging/owner-deployment.review.jsonc
staging/owner-recovery.example.jsonc
tests/admin-compatibility.test.mjs
tests/admin-d1.test.mjs
tests/admin-extras-d1.test.mjs
tests/admin-grants.test.mjs
tests/admin-i18n.test.mjs
tests/admin-key-prepare.test.mjs
tests/admin-key-recovery.test.mjs
tests/admin-login.test.mjs
tests/admin-notifications-drafts.test.mjs
tests/admin-owner-boundary.test.mjs
tests/admin-pagination-d1.test.mjs
tests/admin-prepare.test.mjs
tests/admin-preview.test.mjs
tests/admin-recovery-check.test.mjs
tests/admin-security-preservation.test.mjs
tests/admin-setup.test.mjs
tests/admin-trust-init.test.mjs
tests/admin.test.mjs
tests/auth-d1.test.mjs
tests/auth-isolation.test.mjs
tests/auth-links.test.mjs
tests/auth-security.test.mjs
tests/auth.test.mjs
tests/browser/admin-compatibility.spec.ts
tests/browser/admin-language.spec.ts
tests/browser/admin-notifications-drafts.spec.ts
tests/browser/admin-portal.spec.ts
tests/browser/admin-redesign.spec.ts
tests/browser/admin-review.spec.ts
tests/browser/auth-links.spec.ts
tests/browser/auth.spec.ts
tests/browser/customer-feedback.spec.ts
tests/browser/home-language.spec.ts
tests/browser/inquiry-workflow.spec.ts
tests/browser/nopal-features.spec.ts
tests/browser/nopal-storage.spec.ts
tests/browser/nopal-voice.spec.ts
tests/browser/rebrand.spec.ts
tests/browser/registration-reviews.spec.ts
tests/browser/research-signup.spec.ts
tests/browser/research.spec.ts
tests/deployment-config.test.mjs
tests/directory.test.mjs
tests/helpers/auth-fixture.mjs
tests/helpers/image-fixtures.mjs
tests/helpers/owner-fixture.mjs
tests/inquiries.test.mjs
tests/nopal-feedback-d1.test.mjs
tests/nopal-feedback.test.mjs
tests/nopal-launch-d1.test.mjs
tests/nopal-launch.test.mjs
tests/nopal-operations.test.mjs
tests/overview.test.mjs
tests/owner-d1-boundary.test.mjs
tests/owner-enrollment-sign.test.mjs
tests/owner-grant-client.test.mjs
tests/owner-grants-workerd.test.mjs
tests/owner-grants.test.mjs
tests/owner-recovery.test.mjs
tests/owner-workerd.test.mjs
tests/producer.test.mjs
tests/product-images.test.mjs
tests/provider-diagnostics.test.mjs
tests/rebrand.test.mjs
tests/registration-reviews.test.mjs
tests/research-d1.test.mjs
tests/research.test.mjs
tsconfig.json
tsconfig.worker.json
worker/admin.ts
worker/adminExtras.ts
worker/adminPagination.ts
worker/adminPreview.ts
worker/authState.ts
worker/buyer.ts
worker/directory.ts
worker/environment.ts
worker/fields.ts
worker/implicitRecovery.ts
worker/index.ts
worker/inquiries.ts
worker/legacyAdmin.ts
worker/nopalFeedback.ts
worker/nopalLaunch.ts
worker/nopalOperations.ts
worker/overview.ts
worker/owner/authority.ts
worker/owner/crypto.ts
worker/owner/gateway.ts
worker/owner/grants.ts
worker/owner/router.ts
worker/owner/ui.ts
worker/producer.ts
worker/productImages.ts
worker/provider.ts
worker/research.ts
worker/retiredRoutes.ts
worker/reviews.ts
wrangler.jsonc
wrangler.local.jsonc
wrangler.production.jsonc
wrangler.staging.jsonc
```

## Final local preparation

All 356 inclusion-manifest files and the 54 reviewed deletions are staged as one logical candidate. Expected index differences from HEAD: 57 modified, 192 added, 54 deleted (303 changed paths). No commit exists for this candidate yet. No GitHub workflow files were present in the candidate; external repository/Cloudflare build integrations were not checked and must be reviewed before the separately approved push.

Staged diff inspection also found trailing whitespace in three font OFL notices; only line-end whitespace was normalized, with wording unchanged. Git rename detection recognizes all 54 original deletions as moves into the included archive: 138 additions, 57 modifications and 54 renames (249 diff entries), equivalent to 192 additions, 57 modifications and 54 deletions with rename detection disabled (303 paths). The final source tree has 356 files.
