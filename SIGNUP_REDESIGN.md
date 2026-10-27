# Research signup reference implementation

Only `/signup` uses the new `ResearchSignupPage`. `AccountPages` retains the existing submit handler, request locking, cooldown, conditional email guidance and registered state, and delegates presentation for this route. No Worker, provider, auth/session, grant, research policy, database, migration, administrator component or deployment configuration was changed.

The reference is rendered as actual HTML/CSS: warm ivory background; leaf/brand lockup and serif invitation; three conceptual brand points; generated natural-light still life; light bordered form panel; EN/ES selector; four labeled fields; password reveal controls; notice acknowledgement; dark-green submit; sign-in link; privacy callout and centered current-year brand footer. At mobile/tablet widths the brand mark and form precede the explanatory content. A normal block layout avoids mobile compositor artifacts seen with blend/mask layers.

The existing display name remains optional, and the server's 12–128-character password policy remains. Confirmation is a local field with no `name`, as is the local acknowledgement; the API payload remains exactly `full_name`, `email`, `password`, `registration_type: research`. Required fields and local acknowledgement are checked before submit, mismatches have a linked error and focus, and existing server errors stay visible with the draft intact. Language changes retain drafts and checkbox/reveal state; no new language or storage key is introduced.

The project has no existing signup Privacy Policy/Terms routes or legal acceptance storage. The UI therefore links to an expandable factual account/research notice, explicitly states that acknowledgement is browser-only, and does not invent legal documents or claim persisted consent. Actual research consent and access remain separate. A future legal acceptance workflow requires approved policies and a separately reviewed server/storage change.

Botanical ingredients, sensitivity safety and efficacy claims in the visual reference are not verified. Brand points describe visual inspiration, water/powder and participation instead. The image is a labeled conceptual packaging visualization, with no product labels or certification claims. The generated source is retained under the Codex image output directory; the repo uses a 1536×1024 WebP (~124 KB) with provenance hashes. No dependency was added.

Copyright uses the current year and the existing concept-in-development brand language; it does not copy the reference's old 2025 date.

Local tests submit only to route stubs or ephemeral local fixtures. Live verification does not create accounts, send confirmation emails or alter survey answers. Full real signup/email delivery is not claimed.

Verification: typecheck, lint, translation check (471 UI and 204 administrator phrases, no missing translations), production build, staging validation/dry-run and diff check pass. Node: 239 passed; browser: 107 passed; no failures/skips. Actual staging EN/ES at 375/768/1440 pixels passed image loading, local required/mismatch gates, reveal/hide, draft preservation and language persistence. Non-signup routes retained their own layout and language controls. Anonymous administrator API returned 401. Live signup requests: zero; page errors: zero. No account or email-delivery success is claimed. Final staging version: `95f27db7-ecb5-4c75-bec9-d3fd2fa18e1e`.

Final signup-only recheck: 8 passed after rendering the copyright year as ungrouped text. Live final-version checks repeated successfully with no signup requests or page errors.
