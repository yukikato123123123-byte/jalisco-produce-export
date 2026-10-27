# Administrator workspace redesign

The authenticated `/admin` workspace uses the reference's forest-green sidebar, warm ivory canvas, white panels, serif headings, restrained line icons, and consistent form, list, pagination, feedback-detail, confirmation, loading, empty and error states. The access/login portal and all public/account/research pages retain their existing styles and language policy.

All ten existing sections remain: Overview, Product concept, Ritual, Origin, Contact & Feedback, Launch List, Research Access, Survey Results, Activity Log and Settings. Code-managed product/ritual/origin content remains explicitly read-only. No unsupported notifications, invitations, email delivery, fictional requests, sample totals or monthly growth metrics were added.

Overview reads existing authenticated endpoints. Four cards show active research permissions, stored survey responses, stored feedback and the actual combined activity total. Trend and language charts derive from existing response timestamps and languages in the selected 7/30/90 UTC calendar days. Empty periods show an empty state. Accessible daily values are available in Chart data, and the language legend includes counts and percentages. View all navigates to the existing section. Refresh remounts the overview and reloads its requests. Recent access entries are permission records, not invented access requests.

Survey Results adds date and language filters over actual response data, recalculates the existing aggregates, and renders ten rows per page. The existing API has no date/language aggregate endpoint: both the overview and survey results request its existing server pages sequentially and render bounded lists. Large datasets would benefit from a separately reviewed server aggregate endpoint. No API, schema, security or migration was changed for this design work.

Research access revocation uses a keyboard accessible native modal confirmation and the unchanged permission API and optimistic event check. Cancel/Escape performs no write. Existing grant, search, state filters, response review, feedback internal notes/history and audit source/date filters are preserved.

Five administrator languages and the separate `nopahua.admin.language` preference are preserved. New phrases live in the administrator catalog only. Fixed English language-option names remain unchanged. Korean/Japanese font subsets are regenerated for the added phrases with existing OFL licensing/provenance. No runtime dependency was added.

Verification evidence and the exact task change list are recorded under `/tmp/nopahua-admin-redesign/`. Staging permission assignments are not changed for visual verification; write workflows are tested against local fixtures and existing real D1 tests.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run check:translations`, `npm run build`, `npm run check:staging`, staging dry-run and `git diff --check` pass.
- Translation coverage: 438 shared/UI source phrases and 204 administrator phrases, zero missing.
- `npm test`: 239 passed, zero failures/skips.
- `LD_LIBRARY_PATH=/tmp/jalisco-browser-libs/extracted/usr/lib/x86_64-linux-gnu npm run test:browser`: 99 passed, zero failures/skips. The external library path supplies the existing Chromium runtime; no project runtime or test expectations were disabled.
- New administrator tests visit all ten sections in English, Spanish, Korean, Myanmar and Japanese at 375/768/1440 pixels. They cover real-page aggregation fixtures, date/language filtering and page reset, 21-response pagination, period switching, missing/failed reads, distinct integer chart ticks, script-complete badge fonts, and translated revocation confirmation/cancellation.
- Existing browser tests preserve research grant/revoke, feedback state/notes/history, auth/recovery/session, public/account/survey isolation and storage behavior. Tests were adapted to open the new mobile sidebar and explicitly confirm revocation; existing assertions remain.
- Live rapid navigation initially triggered the unchanged 60-session-checks-per-minute defense (429). Live verification is paced instead of weakening that limit. Visual review also caught and fixed repeated integer chart tick labels for a single response and an explicit legacy badge font that bypassed administrator script fonts.
- Grant/revoke and feedback writes are verified locally and through the existing ephemeral-D1 regression suite. Visual staging verification does not alter existing permission assignments or customer records.

Final staging version: `34663187-06f3-4110-aba8-55b8132a9160`. Live verification passed all 150 section/language/viewport combinations (10 sections × 5 languages × 3 widths), reload persistence, fixed English option names, feedback details/history, protected reads 200, ordinary-user administrator denial 403, anonymous denial 401, unchanged public/account language controls, and the existing survey denial 403. Protected data writes: zero. Browser page errors: zero. Protected permission/response/feedback event counts match the pre-deployment read.
