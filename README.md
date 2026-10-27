# NopaHua — cosmetic concept and private research

NopaHua is a candidate cosmetic brand for concept development and market research in Mexico. Formula, ingredients, benefits, instructions, prices, certifications and launch timing remain unconfirmed. Public imagery shows conceptual materials, not a finished product.

## Current application

- `/`: brand concept, interactive ritual, research entry, private contact/feedback and launch requests.
- `/login`, `/signup`, `/forgot-password`, `/verify-email`, `/reset-password`: existing Supabase authentication, with NopaHua presentation.
- `/account`: neutral account landing. Existing accounts and sessions are retained; no business-role onboarding is required.
- `/research/nopahua`: existing verified accounts with explicitly granted research access only.
- `/research/nopahua/results`: separately authorized aggregate sharing; no individual comments.
- `/admin`: existing administrator guard, research access, raw survey results and aggregates, concept content, feedback, launch list, audit history and browser settings.

See [NOPAHUA_RESEARCH.md](NOPAHUA_RESEARCH.md) for permission/storage details and [REBRANDING.md](REBRANDING.md) for retired routes, preserved data and the archival manifest.

## Verification

```sh
npm run typecheck
npm run lint
npm run check:translations
npm run build
npm test
npm run test:browser
npm run check:staging
npm run dry-run:staging
```

Real browser tests require the environment's Chromium runtime libraries. Local authentication tests use disposable synthetic providers and databases; they do not send real mail.

## Security and deployment

Supabase verifies identity; the existing encrypted HttpOnly session is retained. D1 is private to the Worker and has no Supabase-style RLS. Existing admin grants, owner authority, research triggers and schema migrations are preserved. Research access does not confer administrator authority.

Only staging/local page routing changes. The existing Cloudflare account, Worker name, Supabase project, D1 binding, cookies, secrets and production config retain their technical identifiers. Never run pending remote migrations indiscriminately: an unrelated historical owner migration can remain pending. This rebrand requires no new migration or deletion.

Production is not deployed. Historical food-platform source and tests are frozen as inert reference files in `legacy/food-platform/`; they are neither compiled nor served. No historical business or research records are erased.
