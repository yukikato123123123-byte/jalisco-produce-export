# Administrator-only languages

Only the authenticated `/admin` workspace mounts `AdminLanguageProvider`. Public pages, accounts, the survey and the unauthenticated administration login portal keep the existing global English/Spanish provider and selector.

The administrator selector is shared by the topbar and workspace settings. Option labels are always **English, Spanish, Korean, Myanmar, Japanese**, irrespective of the selected UI language. Codes are `en`, `es`, `ko`, `my`, `ja`.

`nopahua.admin.language` stores only the administration preference. A valid stored choice wins; otherwise the existing global English/Spanish choice supplies the default. The global `jalisco-produce-export.language` key is never changed by the administration selector. The administrator provider also scopes document language, date/number formatting and native form-validation messages. Its effects are removed when the protected workspace unmounts.

`adminI18n.ts` reuses existing English/Spanish translations and an isolated Korean/Myanmar/Japanese catalog. Static UI, action/status labels, pagination, permission management, results, concept copy and known API errors are covered. Unknown errors show an honest localized failure message; they never become a success or an untranslated technical English error. User comments, emails, identifiers, consent-version IDs and language names are data and remain unmodified.

Font assets under `public/assets/admin-languages/` are OFL-licensed, renamed derivatives of official Google Fonts sources, with licenses and source/subset hashes. Only `.nopal-operations` in the corresponding language references these families. No font service is contacted at runtime. The subsets cover static administration copy; Myanmar additionally includes its full script/digits/combining range for localized dates and counts. No runtime library or application dependency is added.

`npm run check:translations` checks the existing public EN/ES scope and the administration catalog separately. `tests/admin-i18n.test.mjs` and `tests/browser/admin-language.spec.ts` verify fixed English choices, fallback/persistence, all five translations, responsive layouts, unchanged private API payloads and isolation from public/auth/account/survey pages. Existing tests are retained.

No Worker/API, Supabase, D1, schema migration, grant, authentication setting, session or secret changes are part of this work.
