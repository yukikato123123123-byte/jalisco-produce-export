# Owner recovery: PIN + offline key only

Local implementation update: optional `owner-admin-grants-v1` now adds a separately
root-signed activation, candidate possession proofs, authoritative grant registry,
durable command barrier and idempotent D1 receipts. See
[staging execution readiness](STAGING_ADMIN_EXECUTION.md). The integration design
below describes the original gaps; no real root enrollment, migration, deployment
or grant has occurred. Existing v1 state is never silently upgraded.

Current scope excludes passkeys. No WebAuthn package, enrollment or login is used.
Existing Supabase authentication, public pages and remote environments are unchanged.

## Protocol

`/owner` prepares a five-minute challenge. The owner reviews it offline and signs
with the current independent Ed25519 recovery key. A replacement recovery key
separately signs acceptance. The owner submits both public signatures and the
11-digit PIN. No private key is sent to the server.

The intent binds `protocol: owner-pin-key-v1`, operation, project/account/DB/Worker,
origin, owner ID, expected epoch, nonce, request ID, expiry, next recovery public
key and next approval policy. PIN alone never authorizes recovery. Keys must not
be derived from the PIN.

The PIN verifier uses platform WebCrypto PBKDF2-SHA256 (600000 rounds, independent
16-byte salt), then HMAC-SHA256 with a separate 32-byte pepper. PIN/pepper are not
stored in authority state, policy output or audits. The verifier is re-salted
on recovery. No reversible PIN storage, private-key escrow or low-cost fallback.

A dedicated SQLite-backed Durable Object atomically reserves signed attempts,
counts failures and consumes challenges. Successful recovery atomically rotates
the recovery/approval public keys, increments epoch, replaces ALL old owner
sessions with ONE new 10-minute HttpOnly/Secure/SameSite=Strict session, and appends
an audit event. Failed/unconfirmed storage operations never return success.
A used challenge cannot be retried: inspect the signed public chain and epoch.
D1 is not authoritative for ownership; an ordinary D1 administrator cannot create
an owner by editing admin_grants or metadata. Native owner cookies are not fake
Supabase sessions and do not grant ordinary Supabase administrator access.

## Offline signing

No actual key was generated or registered. After separate approved setup, the
owner uses existing offline keys via protected stdin. These are example commands:

```bash
node scripts/owner-sign.mjs --request /secure/request.json --mode recover \
  --out /secure/old-signed.json \
  --confirm 'SIGN OWNER RECOVERY REQUEST_UUID' < /secure/current-recovery.pem
node scripts/owner-sign.mjs --request /secure/old-signed.json --mode accept \
  --out /secure/approved.json \
  --confirm 'SIGN OWNER RECOVERY REQUEST_UUID' < /secure/next-recovery.pem
```

Upload the public envelope and enter the PIN only on the trusted HTTPS recovery
page. PINs, cookies, passwords and private keys must not enter chat, email or logs.

## Bootstrap and deployment remain disabled

There is no public bootstrap endpoint. An independently approved root-signed
manifest must be installed before Gmail loss; email equality or first signup is
not ownership evidence. No real owner has been enrolled by this implementation.

Required optional configuration (not set in this work): OWNER_AUTHORITY,
OWNER_ROOT_PUBLIC_KEY, OWNER_BOOTSTRAP_MANIFEST and OWNER_PIN_PEPPER.
The manifest contains `{payload,signature,policy_signature}`. Payload fields:
`operation:owner_bootstrap`, `protocol:owner-pin-key-v1`, scope, origin, owner_id
(UUID), epoch=1, recovery `{id,public_key}`, pin verifier and approval policy.
Both root signatures use canonical JSON; the public policy signature excludes
PIN verifier data. Extra private-key fields are rejected. The new protocol/state
key deliberately rejects previous passkey bootstrap/state rather than silently
converting it.

Current deployment configs have no owner binding. The nondeployable
`staging/owner-recovery.example.jsonc` describes the future Durable Object class
migration only. No D1 migration is added or changed.

## Essential tests

```bash
node --experimental-strip-types tests/owner-recovery.test.mjs
node --experimental-strip-types tests/owner-workerd.test.mjs
npm run lint
npm run typecheck
```

11 core cases and one real local SQLite Durable Object case cover success without
Gmail/passkeys; PIN-only and ordinary admin denial; wrong current/replacement-key
proofs; scope/target/protocol binding; expiry/replay; concurrent single commit;
atomic failed audit rollback; signed failure budget; secret-free output; CSRF,
size limits and malformed input. Only ephemeral synthetic keys/PINs are used.
Broad browser/public regression suites are intentionally not rerun in this phase.

## Explicit limitations

### D1 integration gate (local review)

The requested coupled recovery remains **BLOCKED**, rather than implemented as
sequential writes. `OwnerAuthority.transact` commits only Durable Object storage;
`admin_grant_event_apply` commits only the D1 grant event and its projection.
Neither transaction can roll back the other. Calling D1 from inside the Object
transaction does not extend that transaction to D1; a timeout after D1 commit can
leave ownership keys and administrator permissions disagreeing. Compensation
cannot guarantee rollback when the second service is unavailable.

There is also no D1 owner role: `admin_grants` represents ordinary administrators,
references existing application profiles, and is authorized only after provider
identity verification. The native owner UUID and cookie are intentionally not
Supabase subjects or tokens. Recovery signatures bind a recovery intent, whereas
the existing administrator approval binds a separate grant/revoke intent,
operator, target, request and expected prior event. They are not interchangeable.

Safe integration requires a separately reviewed protocol: choose one authority
for the atomic ownership/key/session/audit commit; define a root-approved mapping
to real application identities and an epoch-bound signed grant policy; and fence
every privileged reader/writer against the authoritative epoch. If D1 remains a
projection, it must be treated as non-authoritative and pending until reconciled,
never advertised as an atomic cross-store commit. Alternatively moving all owner
state into D1 changes the current protection against D1 compromise and needs an
explicit threat-model decision. Neither change is silently introduced here.

`tests/owner-d1-boundary.test.mjs` verifies that a valid locally recovered owner
cookie cannot become a Supabase session or elevate an ordinary D1 account, that
existing signed grants remain required, and that a failed recovery issues no
cookie or D1 changes. This is boundary coverage, not a successful coupled recovery
test. No new migration, live enrollment or administrator integration is enabled.

- Owner-aware direct D1 administrator grants remain blocked when the owner root
  is configured. Policy in the Durable Object and a CLI D1 INSERT cannot be
  atomically epoch-fenced by merely fetching a policy first. A reviewed grant
  gateway is required; this core must not silently bypass Ed25519 approval.
- Initial real owner/root/key setup is not automated and needs separate approval.
- Recovery history is bounded to 16 rotations; checkpoint/archive is not built.
- Ten signed recovery attempts/24h; unsigned proofs do not consume PIN budget.
  Challenge issuance: 10/minute per hashed peer, 60 total, 16 pending. Availability
  denial remains possible; edge protection and cloud CPU-budget testing are needed.
- Loss of all offline keys cannot be repaired by PIN alone. A compromised browser
  or Cloudflare/authority control plane is outside the protection of an offline
  proof. D1 isolation does not protect against authority-backup rollback.
- Cloudflare/Supabase/repository/domain recovery must independently survive Gmail
  loss. App recovery cannot recover those provider accounts.

## Original broader integration proposal (account linking remains unimplemented)

### Single ledger and identity

Choose the existing SQLite-backed OwnerAuthority Durable Object (DO), named by
the canonical fixed deployment scope, as the sole ownership ledger. Keep keys,
PIN verifier, sessions, policy and security audits in its existing transaction.
D1 becomes a rebuildable projection for ownership, never an independently valid
owner role. This preserves protection against D1-only writes creating ownership.
Cloudflare/Worker control-plane compromise and authority rollback remain outside
this guarantee. Authority downtime denies privileged operations, not public access.

The stable owner_id is the root-enrolled offline principal. A Supabase account is
an optional linked login method, not ownership itself. Initial root-approved
enrollment must bind scope, owner_id, recovery key, policy and any verified
provider issuer/subject. Recheck the actual Auth user through the approved
management path and require a fresh real login. Email equality and the previously
supplied candidate UUID are insufficient. No identity is enrolled here.

After Gmail loss, PIN and offline proofs recover the same native owner without a
Supabase lookup or fabricated token. Never insert that owner_id into auth_users,
profiles or admin_grants to impersonate a provider subject. A separate verified
owner authorization path supplies owner operations, independent of ordinary login.

To link a new login, register/login normally with an available Gmail-independent
provider method and complete verification/onboarding. Require a fresh owner
session AND a current offline recovery-key signature on a single-use challenge
binding scope, owner_id, epoch, old link version, exact server-verified issuer and
subject, operation, request ID, nonce and expiry. Recheck the same provider session
at commit; CAS the link version, audit and invalidate previous owner capabilities
in DO. Reject another principal's subject. Caller-selected UUID/email or metadata
cannot authorize the link. Linking never grants ordinary administrator access.

An ordinary admin grant remains a separate explicitly approved operation with
verified provider target and operator. Ordinary administrators cannot recover or
link an owner or rotate policy keys. Initial root enrollment must explicitly
delegate self-recovery and policy rotation to the owner; do not infer new powers
from an existing manifest. Routine recovery then needs no other person's approval.

### Atomic authority, durable D1 projection

1. Retain signed attempt reservation and PIN verification. A new explicitly
   versioned recovery intent additionally binds account-link action/version and
   projection schema. Do not reinterpret existing v1 signatures as approval for
   new identity or D1 operations. Require a signed, reviewed protocol upgrade.
2. In ONE DO transaction check epoch and no unresolved privileged command, rotate
   keys/PIN salt/policy, revoke all old native sessions and linked-owner
   capabilities, store one fresh session hash, append audit and a sequenced
   outbox record. Audit/outbox failure rolls back the authoritative commit.
   Previously reserved attempts/challenge consumption deliberately stay consumed.
3. Apply each outbox record to D1 in one batch: immutable receipt, owner/link
   projection and audit. Proposed tables owner_projection_events and
   owner_projection are separate from existing admin grant triggers. Include
   scope, owner_id, epoch, sequence, previous receipt hash, record hash, request ID
   and public signed-chain references; never copy PIN verifiers or session data.
   Exact duplicate ID/hash is idempotent. Conflicting hash, sequence gap or failed
   expected-state CAS must raise an SQL error, not silently update zero rows.
4. Verify the receipt from the D1 primary before acknowledging the sequence in DO.
   On timeout/crash leave the outbox pending; reconcile the SAME ID/hash. An ack
   is scheduling metadata, never independent evidence of ownership. Alarm retries
   may deliver at least once and must not duplicate an effect.
5. Expose authority_committed/projection_pending separately from fully_applied.
   Close D1-dependent privileged actions while their required projection is
   pending. Never report an atomic cross-store success or revert committed keys
   because D1 is unavailable. A lost HTTP cookie response cannot expose/retrieve
   its plaintext token: use the replacement key for a fresh signed recovery.

This guarantees atomic security effects and eventual, fail-closed projection,
not simultaneous all-or-nothing writes across DO and D1. Accepting a visible
pending state is a prerequisite. If even a pending projection is forbidden,
integration stays BLOCKED until all security effects are placed in one
transactional store after a threat-model review.

### Epoch enforcement and privileged D1 writes

Keep existing Ed25519 signer trust, exact grant/revoke intent, verified operator,
target checks, expiry, request ID and expected-event CAS. A new approval version
also signs authority epoch and policy digest. Store canonical signed approval
and hash with the command audit. Recovery signatures authorize only recovery and
explicitly delegated rotation, never a separate admin grant. Reject downgrades.

Use a DO-mediated gateway, not fetch-policy-then-write in the CLI. In a DO
transaction verify the current approval and reserve a durable command binding
scope, actor, target, action, full body hash, epoch and request ID. Only then may
the gateway submit that exact D1 operation. Do not make external calls inside a
retriable DO storage transaction. The minimal design allows ONE unresolved
command: block recovery and new commands until it reaches a confirmed outcome.
The reservation survives eviction/restart; an in-memory mutex is insufficient.

D1 commits its unique command receipt, business mutation and audit in one batch.
For grant/revoke, retain 0008 event/projection triggers and include the receipt in
the same batch. Verify the primary receipt before marking completion in DO.
For uncertainty keep the barrier. One absent read cannot prove a delayed write
will never commit. Resolve through the SAME idempotent command, or atomically
insert a terminal cancellation receipt that conflicts with any late execution.
Never clear a reservation merely because a timer elapsed. Conflicting receipts
or unverifiable data block the system for review; do not guess a rollback.

Recovery commits only once older commands are confirmed terminal. Commands
admitted before recovery therefore finish before epoch rotation; old approvals
cannot start after it. Do not export a reusable bearer permission for a later
untracked write. Long reads revalidate before disclosure; already disclosed data
cannot be revoked retroactively.

Every privileged read/write path must enforce this boundary, including admin
grant/revoke, publication/product mutations and linked-owner sessions. A
DO-authoritative registry of verified signed admin grants is also required so
forged D1 grants alone cannot authorize ordinary administrators. Import existing
grants only from reviewed signed history. Direct D1 apply must be disabled by
server authorization mode, not just an optional local trust file. D1 business
content itself remains writable by an attacker with direct database access;
ownership isolation cannot make arbitrary D1 data tamper-proof.

Old linked Supabase sessions may physically remain in D1 but lose owner powers
through authoritative epoch/link-version checks. Physical session cleanup is a
separate recorded projection task, not an atomic Supabase revocation claim.
Ordinary user access remains ordinary user access.

### Minimal implementation scope and acceptance tests

Future files, NOT modified in this design phase:
- worker/owner/authority.ts and crypto.ts: versioned links, registry, command
  barrier, outbox/status, audit and signed upgrade checks.
- A small worker/owner/gateway.ts plus privileged paths in worker/index.ts and
  worker/admin.ts; keep native owner and provider identities explicitly distinct.
- scripts/admin-grant.mjs, scripts/admin-approve.mjs and scripts/lib approval
  modules: epoch-bound signed intents and gateway transport, no direct-D1 bypass.
- One additive D1 migration for projections, receipts, immutable audit, unique
  scoped requests and expected-state assertions. Keep 0008 unchanged; choose the
  next number against the actual ledger at implementation time.
- Local fixtures/integration tests. No public components, assets or real
  environment config changes during implementation.

Preserve the existing 130-test baseline. Add real local workerd/DO/D1 cases for
D1 downtime, failed batches, crashes before/after every commit/ack, duplicate and
out-of-order projection, conflicting hashes, eviction with a pending command,
late write versus cancellation, recovery racing grant/product mutation, stale
epoch/policy/linked sessions, forged D1 grants, protocol downgrade, swapped account
link/reused proof, and ordinary-admin/Gmail-only denial. Assert one epoch commit,
complete audit, no early success and no secret output. Rerun auth/public and
browser regression suites with synthetic provider responses, distinguished from
actual Gmail or staging testing. Existing boundary tests stay valid while the
new mode is disabled; future enabled-mode behavior gets separate tests.

### Activation gates and remaining limits

Integration remains BLOCKED until pending-projection semantics and the signed
protocol upgrade are approved, every protected path uses the gateway, and all
crash/race tests pass. Actual initial identity/root/key enrollment, additive D1
migration, DO provisioning and compatible staging deployment each need separate
explicit approval. Review actual remote ledger/config before those steps; this
design does not revalidate live facts. Reconcile receipts and close old bypass
routes before enabling. Never roll back to a binary trusting D1-only grants or a
pre-recovery authority epoch. Existing 16-rotation history limits and independent
provider/control-plane recovery requirements remain unresolved deployment gates.

Cloudflare platform references:
- [Durable Object storage transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)

The outbox and persistent command barrier are proposed application protocols;
Cloudflare does not supply a shared transaction across these two stores.
