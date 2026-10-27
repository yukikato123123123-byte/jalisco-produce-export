# First staging administrator trust enrollment

## Guided setup without copying fingerprints

`node scripts/admin-setup.mjs` is a read-only, offline plan. It defaults to the
requested Zachary email and UUID, but explicitly reports them as **unverified**.
Every online stage revalidates the exact UUID/email with the official Supabase
read-only management API, confirmed/non-deleted/non-banned state, deployed scope,
application onboarding and previous grant state through the existing grant tool.
The project manager can be both approver and operator; email equality or API
access alone does not establish ownership. Independently review project-control
and signer identity evidence before trust enrollment.

The default key location is `~/.jalisco-admin/heaswpawzuuijxurlfoz`, outside the
checkout. Only an explicitly confirmed key generation creates its parent (0700)
and a new destination (0700). Files are exclusive-create 0600; private PKCS8 is
encrypted with the supplied passphrase. Existing keys, public key candidates,
trust policies, unsafe permissions and symlinked paths are never replaced.
`--directory /ABSOLUTE/PROTECTED_PARENT/new-key` remains available; an explicit
parent must already exist with owner-only permissions. Back up encrypted private
material and its passphrase separately on the operator's trusted device.

The stages below are separate decisions, **not an instruction to run them all**:

1. Review without keys, files or network calls:

   ```bash
   node scripts/admin-setup.mjs
   ```

2. After separately approving key generation and backup, run on your trusted
   device with a strong passphrase supplied through protected noninteractive
   stdin (never a CLI argument, environment value, chat or terminal paste):

   ```bash
   node scripts/admin-setup.mjs key --generate \
     --confirm 'GENERATE OFFLINE STAGING APPROVAL KEY' \
     < /PROTECTED_SEPARATE_LOCATION/passphrase-input
   ```

   This generates no policy, signature or grant. It automatically calculates
   the public fingerprint and stores `approval-public.pub` and `public-review.json`
   alongside the encrypted private key. A generation alone establishes no trust.

3. With `CLOUDFLARE_API_TOKEN` and `SUPABASE_ACCESS_TOKEN` securely injected, review
   online trust preparation. Replace the references with actual reviewed records:

   ```bash
   node scripts/admin-setup.mjs trust \
     --identity-ref REVIEWED_PROJECT_CONTROL_AND_SIGNER_RECORD \
     --approval-ref REVIEWED_TRUST_ENROLLMENT_APPROVAL \
     --reason 'Initial staging approver enrollment'
   ```

   No registration happens by default. After separately approving that exact
   enrollment, repeat with `--register --confirm 'REGISTER FIRST STAGING APPROVER'`.
   The adapter validates the protected public receipt and its scope, recomputes
   the fingerprint, and passes the existing exact fingerprint-bound confirmation
   internally to `admin-trust-init.mjs`. It never opens the private key, bypasses
   the existing no-replace policy gate, or infers ownership from email. Review
   the displayed fingerprint/receipt on the trusted device; no manual copying or
   typing of the fingerprint is required. The signer ID is `staging-owner`.

4. Separately prepare a grant without writing D1:

   ```bash
   node scripts/admin-setup.mjs dry-run --reason 'Approved staging administrator access review'
   ```

   Retain the exact returned intent/request ID and expected previous event ID.
   Supply a real approval reference and a current validity period of at most one
   hour in the protected approval payload. Use existing `scripts/admin-approve.mjs`
   to sign it with key ID `staging-owner`, protected private-key stdin and
   `--passphrase-fd 3` for a separate protected passphrase stream. Signing is a
   separate explicit operation; the setup adapter cannot sign or apply grants.

5. Only after separate grant execution approval, use the original
   `scripts/admin-grant.mjs` with the exact dry-run scope, email, user, reason,
   request ID and `--expected none` or the returned previous event ID. Keep the
   existing `--apply --approval ... --confirm 'APPLY grant UUID REQUEST_UUID'` gate.
   Verify the recorded event, projected grant and `/admin` access afterward;
   inspect an uncertain result before any retry. Existing signatures, expiry,
   identity checks and audit triggers are unchanged.

For non-default subjects, pass the same reviewed `--email` and `--user` in every
online stage. No UUID in documentation is proof of an Auth identity. A configured
owner root blocks this direct enrollment path; never remove it to proceed.

Regression coverage is in `tests/admin-setup.test.mjs` plus the existing key,
trust, preparation and grant tests. All generation/registration/signing in tests
uses disposable synthetic material in temporary directories, with stubbed remote
identity checks. These tests never enroll a real owner or apply a remote grant.

## Complete first-enrollment workflow (not executed)

The target email is `administrator@example.test`; no remembered candidate UUID
is treated as verified. The project manager may perform all roles. Key preparation,
trust enrollment, approval signing and actual account grant remain separate
explicit decisions. None automatically completes the next step.

1. Run read-only preparation to locate existing local public material. External
   keys/approval records are not searched; check your own protected records before
   choosing a new key. An existing root/policy must never be removed to proceed.
2. If no existing approval key is available, use `admin-key-prepare.mjs` on your
   trusted local/offline device. It defaults to PLAN_ONLY and does not read stdin:

   ```bash
   node scripts/admin-key-prepare.mjs \
     --email administrator@example.test \
     --directory /ABSOLUTE/OWNER_ONLY_EXTERNAL_PARENT/new-staging-approval
   ```

   The parent must already exist, belong to your OS user, have owner-only access
   (0700), have no symlinks, and be outside this checkout. Use encrypted local
   storage excluded from cloud sync and repository backups. The final directory
   must not exist; the script creates it as 0700, never overwriting anything.

   After reviewing the destination and backup plan, explicitly approve generation
   by adding these flags to the same command:

   ```text
   --generate --confirm 'GENERATE OFFLINE STAGING APPROVAL KEY'
   ```

   Supply a strong independent password-manager-generated passphrase (at least
   20 characters) through protected stdin, not a CLI argument, environment
   variable, chat, terminal paste or shell history. The tool refuses interactive
   stdin. For a separately secured input stream/file, the command may end with
   `< /SEPARATE_PROTECTED_LOCATION/passphrase-input`. Do not store this input
   beside the encrypted key; an owner-only permission check is not encryption.
   Do not use terminal tracing, `tee`, logging or command substitution that prints
   secret input. Choosing and injecting the passphrase remains the user's task.

   Outputs only in that external directory: encrypted PKCS8 Ed25519 private key
   (`approval-private.pem`), public SPKI PEM (`approval-public.pub`) and
   `public-review.json`, all mode 0600. Private encryption uses Node's supported
   `aes-256-cbc` PKCS8 export. Console output contains only the public fingerprint
   and unverified status. The key is not trusted/registered by generation.
   Back up the encrypted key offline and keep the passphrase separately; review
   the public fingerprint on the trusted device. Lost passphrase/key is not
   recoverable by this tool. Partial filesystem failure leaves output for review,
   never automatic regeneration or overwrite.
3. Before approving any account, obtain its actual UUID through the approved
   Supabase management read-only query path for `heaswpawzuuijxurlfoz`:
   `POST /v1/projects/heaswpawzuuijxurlfoz/database/query/read-only` on
   `https://api.supabase.com`. The existing gateway uses this same endpoint.
   The query to review and execute only under a separate read-access authorization:

   ```sql
   SELECT id::text, email, email_confirmed_at, banned_until, deleted_at
   FROM auth.users
   WHERE email = 'administrator@example.test'
   LIMIT 2;
   ```

   Require exactly one match, email confirmation, no deletion and no active ban.
   Record the verified UUID privately. Zero/multiple results, unavailable access
   or mismatched projects stop the procedure. Verify that this is your intended
   login account and retain project-control/identity evidence. Email equality
   alone does not prove project ownership. The CLIs cannot compare the current
   browser session's UUID. Do not paste management tokens or raw results in chat.
4. Copy ONLY the reviewed public `.pub` into the repository with no replacement
   of existing files. Use `admin-prepare.mjs --email ... --user VERIFIED_UUID
   --public-key staging/REVIEWED_PUBLIC_KEY.pub` to recompute its fingerprint;
   compare it with the external public review record. No private key is copied.
   Explicitly approve trust enrollment and use the existing admin-trust-init
   command below with operator, signer ID, identity/approval references and exact
   fingerprint. This registers a signer, not a user account or owner recovery.
5. Separately authorize and execute existing admin-grant online dry-run with the
   actual verified UUID/email, fixed project/config, new request UUID and reason.
   It rechecks the official Auth identity, deployed scope, onboarding and prior
   grant. Use `--expected none` only when no prior grant event exists. Review the
   exact intent and complete its approval payload/reference/validity (max 1 hour).
6. Explicitly approve offline signing. `admin-approve.mjs` now accepts optional
   `--passphrase-fd 3` for an encrypted private PEM supplied through stdin:

   ```bash
   node scripts/admin-approve.mjs \
     --payload /PROTECTED/owner-payload.json --key-id REVIEWED_KEY_ID \
     --out /PROTECTED/owner-approved.json \
     --confirm 'APPROVE REQUEST_UUID' --passphrase-fd 3 \
     < /EXTERNAL_KEY_DIRECTORY/approval-private.pem \
     3< /SEPARATE_PROTECTED_LOCATION/passphrase-input
   ```

   File descriptor 3 is a protected input stream, not a passphrase argument or
   environment value. No decrypted private PEM is written. Existing unencrypted
   signing inputs remain supported without this flag. Incorrect passphrase,
   untrusted signer, altered scope/intent or expired payload fails closed.
7. Obtain separate explicit grant execution approval. Keep every dry-run intent
   field unchanged and use existing admin-grant `--apply`, signed approval file
   and exact confirmation. Then read the grant event/state and verify real admin
   access plus ordinary-user 403/anonymous 401. Do not blindly retry uncertainty.
   Updated local login routing still needs a separately approved compatible
   deployment before automatic `/admin` navigation changes on staging; direct
   `/admin` uses the existing deployed authorization.

No official management lookup, real key generation, trust registration, signature,
grant or deployment is performed by documenting/testing this workflow.

## Read-only preparation in one screen

Run `node scripts/admin-prepare.mjs --email YOUR_EMAIL` to summarize the fixed
staging scope, unverified account candidate, local policy/root presence, discovered
`staging/*.pub` fingerprints and exactly one suggested next action. The email is
not hardcoded. Optionally add `--user CANDIDATE_UUID` (still unverified),
`--public-key PUBLIC_FILE.pub`, and `--key-mode existing` (default) or `new`.
There are no apply/register/sign/network flags. No output file is created.

Only existing public SPKI PEMs are parsed, using the same Ed25519 validator and
SPKI-DER fingerprint routine as trust enrollment. A matching local policy entry
means only public-key equality: signer identity and external approval records
remain UNVERIFIED. Malformed/wrong-scope policy or any owner-root presence blocks
fresh-enrollment guidance. Do not delete existing files to bypass it.

An optional `--private-key /absolute/protected/external/path` checks only metadata
(existence, regular non-symlink file, owner and permissions). It NEVER reads the
file or proves that it matches a public key. The path must be outside this repo;
an absent destination needs an existing owner-only parent directory. Paths and
file contents are not printed. No recursive search of private-key stores occurs;
without an explicit path their existence remains NOT_CHECKED.

`--key-mode new` prepares a separate key-generation decision, not a new key. This
tool never generates keys. Future key generation/backup must be separately
authorized on a trusted offline device with private material outside the repo.
Neither an unregistered key nor a newly generated key is automatically approved.

Account lookup is NOT performed. The report describes approved Supabase management
lookup by exact email, requiring one confirmed/non-deleted/non-banned user and
comparison of its actual UUID. The existing admin-grant online dry-run subsequently
checks that exact UUID/email, Worker bindings, onboarding and grant state using
securely injected CLOUDFLARE_API_TOKEN and SUPABASE_ACCESS_TOKEN. Preparation does
not read those variables. The current browser session is not matched by these
CLIs. Identity evidence and fingerprint confirmation remain human decisions.

Preparation tests: `node tests/admin-prepare.test.mjs`. They use public test vectors
and disposable directories; no keys, policies or credentials are installed in the
real repository. Existing enrollment/grant/signing tools remain separate gates.

## Explicit trust enrollment

`scripts/admin-trust-init.mjs` is a local-only public-key enrollment tool. It
does not verify real-world identity, contact providers, sign approvals, generate
keys or grant access. The project manager may be both approver and operator;
no separate external person is required by the tool. Record independently checked
project-control and account-identity evidence before using it. References are
operator attestations, not automatically verified evidence.

It defaults to dry-run. It accepts exactly the existing fixed staging scope and
`wrangler.staging.jsonc`. The public key input must be a regular, non-symlink file
under the repository, specified with a relative path without traversal. Only one
Ed25519 SPKI public PEM is supported. Never supply a private key file. No output
path override is available. The staging directory must not be a symlink or
group/world writable. Run under the trusted project administrator's OS account;
this does not defend against a malicious user with the same filesystem rights.

Example for a future separately approved operation, NOT executed here (replace
all uppercase placeholders with reviewed actual values):

```bash
node scripts/admin-trust-init.mjs \
  --config wrangler.staging.jsonc \
  --project heaswpawzuuijxurlfoz \
  --account 89dd3e659cece6bdf3181b991a2a0bd2 \
  --database 7712d6bb-2414-44d3-9282-cb5b941d740e \
  --worker jalisco-auth-staging \
  --approver APPROVER_ID --public-key staging/REVIEWED_PUBLIC_KEY.pub \
  --fingerprint SHA256:REVIEWED_LOWERCASE_HEX \
  --operator VERIFIED_PROJECT_MANAGER \
  --identity-ref REVIEWED_IDENTITY_EVIDENCE_REFERENCE \
  --reason 'Approved first staging trust enrollment' \
  --approval-ref REVIEWED_ENROLLMENT_APPROVAL_REFERENCE
```

Fingerprint format is `SHA256:` followed by 64 lowercase hex digits of SHA-256
over SPKI DER, not the PEM text or an SSH fingerprint. Compare against a trusted
separate record; copying a fingerprint from an untrusted key is not identity
verification. Dry-run does not establish possession of the matching private key.

After explicit trust-enrollment approval, the same command additionally requires:

```text
--register
--confirm "REGISTER STAGING APPROVER APPROVER_ID SHA256:REVIEWED_LOWERCASE_HEX"
```

Registration creates only `staging/admin-approval-policy.json`, mode 0600. Its
existing `scope` and `approvers[{id,public_key}]` fields are compatible with
admin-approve/admin-grant. A top-level `registration` record includes operator,
identity reference, reason, approval reference, fingerprint algorithm/value and
timestamp. Policy and record are published together through an atomic no-replace
hard link from a complete fsynced temporary file. Existing files, directories or
dangling symlinks at policy or owner-root paths block enrollment. Repetition never
replaces policy. An uncertain filesystem outcome requires inspection, not blind
retry; local metadata is not an independently tamper-proof audit system.

Do not run competing owner-root provisioning during enrollment. The tool rechecks
root absence before publication but does not provide a transaction with unrelated
filesystem writers. Never delete a root/policy to bypass this gate.

No token/environment-variable input is needed. No grant/apply is invoked. After
separately approving real enrollment, use the unchanged online admin-grant
dry-run, exact admin-approve signature, separately approved grant apply, and D1
audit/access verification. This also verifies possession of the signing key.
Real account identity, management-token permissions, remote bindings/migration
state and actual access remain unverified until those separate approved steps.

Tests use disposable temporary directories and published public test vectors;
they do not generate keys, sign, or contact any provider:

```bash
node tests/admin-trust-init.test.mjs
npm run lint
npm run typecheck
```
