# 스테이징 관리자 복구 실행 준비 결과와 운영 절차

이 문서는 로컬 구현 후보의 사용 절차다. 운영 실행 승인이 아니다. 실제 키 생성·등록, 비밀 입력, 원격 D1 변경, grant, 배포는 수행하지 않았다. 기존 정책과 키를 보존한다.

## 업로드 없는 배포 후보 검증 완료

`staging/owner-deployment.review.jsonc`에 기존 구현을 사용하는 owner 활성화 후보를 준비했다. 운영 `wrangler.staging.jsonc`는 변경하지 않았다. 후보는 동일 Worker/account/DB/origin/Supabase와 동일하게 해석되는 소스·assets·migration 경로를 유지하고, SQLite DO binding/class migration, owner mode와 보존된 이전 정책 해시만 추가한다. 실제 루트·개인 키·manifest·PIN·pepper는 포함하지 않는다.

실제 실행한 명령:

```sh
npx wrangler deploy --dry-run \
  --config ./staging/owner-deployment.review.jsonc \
  --outdir /tmp/jalisco-owner-deployment-review-final
```

결과: exit 0, Worker bundle 98.71 KiB, `--dry-run: exiting now.`. `OWNER_AUTHORITY (OwnerAuthority)`와 기존 DB/assets, 검토용 vars가 bundle에 포함되는 것을 확인했다. 이것은 업로드 예상 크기이며 실제 업로드·DO 생성·migration 적용이 아니다. 경로·scope·이전 정책 해시 일치 검사 10개도 모두 true였다. 기존 통합 테스트는 다시 작성하거나 실행하지 않았다.

현재 연결 점검은 Cloudflare `VERIFIED`, scope 일치, 운영 owner gateway 미설정, grant/event/미만료 일반 세션 각각 0, D1 쓰기 0으로 반환됐다. 실제 승인 파일과 root/policy chain은 없다. Supabase는 통합 검색에 더해 앱 권한 조회에서도 `not_installed`로 확인했으며, 환경 관리 연결·사용 가능한 Supabase 도구도 없다. Cloudflare 재연결은 필요하지 않다.

남은 차단 조건을 분리한다.

1. 독립 소유권·교체 승인: `ownership-review.json` 실제 제출·서명/신원/증거 검토가 필요하다. 요청 원본의 null 필드를 승인으로 바꾸지 않는다.
2. Supabase 관리 인증: 공식 통합이 아직 설치·인증되지 않았다. 앞서 준비한 프로젝트 한정 read-only OAuth 경로를 사용할 수 있지만, 완료했다고 간주하지 않는다. CLI Management API 인증과 MCP 인증은 서로 다른 연결이다.
3. 실제 신뢰 자료: 별도 승인된 생성/백업/원본 fingerprint 대조 이후의 root·복구 키·승인 키와 서명 bundle이 없다. 로컬 합성 테스트의 키를 운영에 사용하지 않는다.
4. 운영 변경 승인: 위 조건을 충족한 뒤에도 root/정책 등록, schema migration, DO/Worker 배포, grant 서명과 실제 적용은 각각 승인받는다. 후보 config를 현재 상태에서 업로드하지 않는다.

따라서 실제 관리자 grant·감사 event 생성 및 인증된 `/admin` 성공은 아직 확인되지 않았다. 승인 없이 더 진행할 운영 단계는 없다.

## 승인 없이 가능한 후속 점검 자동화

현재 연결의 고정 staging scope와 대상 grant/event/세션 개수만 확인하는 명령을 추가했다.

```sh
node scripts/check-staging-readonly.mjs
```

새 명령의 실제 실행 결과는 `cloudflare.status:VERIFIED`, `scope_matches:true`, `owner_gateway_configured:false`, grant/event/미만료 일반 세션 각각 0, `rows_written:0`이었다. 승인 파일은 없으며 `approval_authorized:false`다. migration은 `NOT_RECHECKED`로 표시하여 완료된 확인을 반복하지 않았다. 기존 테스트를 재실행하지 않고 새 명령 전용 테스트 3개와 lint를 통과했다.

명령은 기존 환경 CF 토큰 또는 **미만료** Wrangler OAuth만 사용하고, 만료되면 `npx wrangler whoami`를 안내할 뿐 로그인·권한 확장·자동 갱신을 수행하지 않는다. D1은 코드에 고정된 SELECT만 허용하며 scope 불일치 시 DB 조회를 중단한다. 원시 provider 응답·token·세션 식별자를 출력하지 않는다. 승인 파일이 나중에 생겨도 존재를 승인으로 처리하지 않고 독립 서명/신원 확인 대기로 표시한다. key/grant/배포 명령이나 임의 SQL 인자를 받지 않는다.

Supabase 상태는 구분해서 해석한다. 이 명령은 프로세스 환경의 Management API 연결만 확인하며, MCP OAuth 연결의 인증 정보를 추출하거나 연결됐다고 추정하지 않는다. 공식 통합 연결 후에는 그 통합 도구를 통해 별도로 읽기 전용 확인해야 한다.

### Supabase 공식 연결 경로

통합 검색 결과 Supabase는 사용 가능하지만 **미설치·미연결**이었다. Supabase 통합을 설치한 뒤 공식 브라우저 OAuth에서 대상 조직 접근을 인증하는 경로를 사용한다. 수동 MCP 구성을 지원하는 환경에서는 다음처럼 프로젝트/읽기 전용/기능 범위를 고정한다.

```text
https://mcp.supabase.com/mcp?project_ref=heaswpawzuuijxurlfoz&read_only=true&features=database,docs
```

브라우저 인증은 Supabase 계정에서 수행하며 채팅에 PAT·비밀번호를 넣지 않는다. 이 구성은 account 도구를 비활성화하므로 조직 소유권 검토 자체를 대신하지 않는다. 또한 MCP 인증은 grant CLI가 요구하는 보호된 Management API 환경 연결과 별개다. 설치·인증 완료가 실제 확인되기 전에는 Auth UID·프로젝트 접근을 검증했다고 보고하지 않는다. [Supabase 공식 MCP 연결·OAuth·프로젝트 범위 문서](https://supabase.com/docs/guides/ai-tools/mcp).

독립 검토 기록은 여전히 제출되지 않아 키 생성·등록·정책 전환·migration·배포·grant는 차단 상태다. 연결을 인증하는 것은 이 작업들의 승인이 아니다.

## 최신 긴급 검증 결과 — 2026-10-23 09:30 이후(Asia/Rangoon)

아래는 이번 실행의 실제 결과이며, 뒤의 09:20 진단 당시 Cloudflare 403/원격 미확인 상태보다 최신이다. 사용자가 독립 승인 여부를 **미승인**으로 확인했다. 실제 관리자 접근은 아직 복구되지 않았고 키 생성·등록·migration·배포·grant를 수행하지 않았다.

### 해결·수정한 항목과 실제 출력

- Cloudflare 저장 OAuth의 만료 시각은 `2026-10-23T01:13:40.414Z`였고 검사 당시 만료 상태였다. 원시 저장 토큰을 그대로 사용하던 이전 진단과 달리 `npx wrangler whoami`로 기존 OAuth를 정상 갱신했다. 새 로그인/권한 확장은 하지 않았다. 갱신 뒤 `GET /client/v4/user`는 `200`, `success:true`다.
- 대상 계정 멤버십은 `accepted`, 역할은 `Super Administrator - All Privileges`로 실제 조회됐다. 이는 현재 연결의 기술 권한 증거이며 독립 소유권 검토 승인으로 간주하지 않는다.
- `scripts/owner-enrollment-sign.mjs`가 중첩된 `policy.approvers[].private_key` 같은 미허용 필드를 서명 출력에 포함할 수 있음을 합성 값으로 재현했다. 실제 키/비밀은 사용하지 않았다. 전체 recovery/policy/PIN/activation 구조의 정확한 필드·형식을 서명 전에 검사하도록 수정하고 회귀 테스트를 추가했다. 정상 root/activation/복구·승인 키 소유 증명 서명은 유지한다.

이번에 실행한 검증 명령과 결과:

```text
npx wrangler whoami
  logged in with an OAuth Token; target account 89dd3e659cece6bdf3181b991a2a0bd2

node --experimental-strip-types --test tests/auth*.test.mjs tests/admin*.test.mjs tests/owner*.test.mjs tests/provider-diagnostics.test.mjs tests/deployment-config.test.mjs tests/producer.test.mjs tests/directory.test.mjs
  # tests 227
  # pass 227
  # fail 0

npx playwright test --config /tmp/jalisco-owner-browser.config.mjs admin-review.spec.ts auth.spec.ts auth-links.spec.ts home-design.spec.ts
  42 passed (27.1s)

npm run typecheck / npm run lint / npm run build
  passed (build의 기존 bundle size 경고는 유지)
```

브라우저 실행은 기존 `/tmp` 의존성 경로를 `LD_LIBRARY_PATH`로 지정한 격리 preview/mock API 테스트다. 실제 스테이징 로그인 성공으로 간주하지 않는다. 실행 로그는 `/tmp/jalisco-emergency-regression.log`, `/tmp/jalisco-emergency-browser.log`에 있다.

### 원격 읽기 전용 검증 결과

| 확인 대상 | 실제 결과 |
| --- | --- |
| Worker scope | staging origin, Supabase `heaswpawzuuijxurlfoz`, DB `7712d6bb-2414-44d3-9282-cb5b941d740e` 일치 |
| 운영 인증 secret | `SESSION_ENCRYPTION_KEY`, `SUPABASE_PUBLISHABLE_KEY` 바인딩 존재만 확인. 값은 조회·출력하지 않음 |
| Owner 구성 | owner binding/mode 없음. 따라서 로컬의 새 gateway가 운영에서 활성화됐다고 주장하지 않음 |
| Migration | 원격 ledger에 0001~0008 적용 확인. 0009 receipt 테이블 둘은 부재 |
| 대상 UID | 애플리케이션 사용자 1, onboarding 1, grant 행 0, grant event 0 |
| 로그인 세션 | 대상 UID의 저장된 미만료 일반 세션 0. 쿠키·세션 ID·토큰은 조회하지 않음. 실제 브라우저/provider 세션은 미검증 |
| 익명 API | `/api/auth/session`, `/api/admin/overview` 각각 401. 대상 계정의 인증된 `/admin` 성공은 미확인 |
| Supabase 관리 연결 | 환경/CLI 관리 연결 없음. Supabase 통합도 미설치·미연결로 확인. Auth identity·조직 소유권·ban 여부는 이번에 조회하지 못함 |

모든 원격 D1 요청은 SELECT였고 `rows_written:0`, `changed_db:false`였다. 기존 정책·공개 키의 원시 및 canonical 해시도 유지됐다. 현재 owner-aware grant dry-run은 로컬 root 부재로 네트워크 요청 전에 거부된다.

### 현재 필요한 권한과 승인 접수물

현재 OAuth에는 user/account 읽기와 Workers·D1 쓰기 범위가 있고 실제 읽기가 성공했으므로, 이번 403을 해결하기 위한 권한 확장은 필요하지 않았다. 최소 읽기 권한을 별도로 구성한다면 Worker 설정에는 `Workers Scripts Read`, D1 조회에는 `D1 Read`가 사용 가능하다. 실제 schema 적용과 Worker/DO 배포에는 별도 쓰기 권한과 작업 승인이 필요하다. [Worker 설정 API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/script_and_version_settings/methods/get/), [D1 조회 API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).

grant gateway의 operator 확인은 별도로 user API token의 active 상태와 Worker settings 접근을 요구한다. 현재 OAuth가 있다는 이유로 `CLOUDFLARE_API_TOKEN`의 요건을 충족했다고 처리하지 않는다. Supabase 공식 read-only SQL endpoint에는 OAuth `database:read` 또는 fine-grained `database_read` 권한이 필요하다. 관리 연결은 보호된 환경/정식 통합으로만 공급하고 토큰을 승인 증거에 포함하지 않는다. [Supabase read-only API](https://supabase.com/docs/reference/api/v1-read-only-query).

계획서만 남기지 않도록 실제 검토 요청 패키지를 저장소 밖 0700 폴더/0600 파일로 준비했다.

- 요청 원본: `/home/administrator/.jalisco-admin/replacement-review-20261023/ownership-review.request.json`
- 비밀 없는 실제 Cloudflare/DB 조회 증거: 같은 폴더의 `ownership-evidence/cloudflare/read-only-verification-20261023.json`
- 검토자가 실제 결정과 외부 승인 기록 참조를 남길 제출 파일: 같은 폴더의 `ownership-review.json` (**아직 없음**)

요청 원본의 reviewer·결정·단계별 승인 필드는 모두 null이고 상태는 `PENDING_INDEPENDENT_REVIEW`다. 독립 검토자는 원본 Cloudflare·Supabase 조직 권한/프로젝트 귀속과 요청자의 교체 권한을 별도 채널에서 대조하고, 실제 review ID·검토자/키 보관 담당자·지정 기록·양 플랫폼 증거 참조·복구 불가 확인·결정 시각·허용 범위를 제출해야 한다. Cloudflare 조회 증거만으로 Supabase 소유권을 승인하지 않는다.

현재 필요한 첫 결정은 소유권·교체 요청 검토이며, 그다음 키 생성·백업도 별도 승인이다. 루트/정책 등록, migration, 배포, grant 서명, 실제 apply 승인은 각각 따로 받아야 한다. 정확한 실행 명령과 영향은 뒤의 B~F 절을 따른다. 아직 최초 승인이 없으므로 다음 변경을 실행하지 않는다.

### 완료 조건의 실제 상태

| 완료 조건 | 상태 |
| --- | --- |
| 대상 계정 로그인 세션 정상 | 미확인; 저장된 미만료 일반 세션 0 |
| 신뢰된 승인 체인 정상 | 로컬 합성 통합 테스트 통과; 실제 root·독립 승인·운영 활성화 없음 |
| 관리자 grant·감사 event | 원격에서 각각 0건 |
| 인증된 `/admin` 접근 성공 | 미확인, 복구 미완료 |

## 계획과 실제 코드 대조

| 계획 요건 | 구현 및 자동 검증 | 사람이 확인할 사항 |
| --- | --- | --- |
| 독립 소유권 확인·검토자 분리 | `admin-recovery-check.mjs`는 대상 scope, 정책 해시, 증거 참조 형식 및 검토자/키 보관 담당자 분리 검사 | 실제 신원과 권한, 증거 진위, 별도 채널의 유효성. 참조가 있다고 소유권 확인 완료로 표시하지 않음 |
| 새 키와 기존 자료 보존 | 기존 `admin-key-recovery.mjs plan/generate`의 신규 외부 경로·암호화·배타 생성 유지 | 생성 승인, 기기 신뢰, 별도 백업 및 복원 시험 |
| 루트와 복구·승인 키 등록 | 공개 bundle의 루트 서명·키 소유 증명·SPKI fingerprint·역할 분리 검증 | 루트 fingerprint 독립 대조 및 등록 승인. 로컬 파일 생성은 실제 소유권 증명이 아님 |
| 정책 전환 | root-signed activation이 이전 정책 해시와 새 bootstrap 해시, 권한 위임을 결합 | 정확한 전환 산출물 승인. 기존 정책 파일 수동 교체 금지 |
| grant 연동 | `worker/owner/grants.ts`, `gateway.ts`, `authority.ts`에 epoch 검사·grant registry·명령 barrier·D1 receipt 구현 | 코드/스키마 보안 검토와 활성화 승인 |
| 관리자 읽기·쓰기 | Worker의 세션 검증 후 service binding 내부 경로로 authority에 전달. D1-only 위조 grant와 불완전 owner 설정은 거부 | 실제 배포 scope 및 모든 구버전 경로 폐쇄 확인 |
| CLI와 오프라인 서명 | `admin-grant --owner-aware`, `owner-enrollment-sign.mjs`, 기존 `admin-approve.mjs` | 서명 승인과 실제 적용 승인 각각 필요 |
| 배포·migration | `0009_owner_command_receipts.sql`은 로컬 후보. 기존 0008 미변경 | 실제 원격 ledger에 맞는 번호 재확인, DO provisioning·migration·배포 각각 승인 |

## 1. 독립 검토 요청 — 현재 차단 지점

소유자가 키 보관 담당자와 분리된 검토자를 지정한다. 기존 조직 권한 기록이나 이미 확인된 연락 채널을 사용하며 이번 요청에서 받은 이메일만으로 지정하지 않는다. 기록에는 검토자의 실제 신원과 조직상 승인 권한, 지정자, 지정 시각 및 외부 검토 ID를 포함한다.

Cloudflare 계정 `89dd3e659cece6bdf3181b991a2a0bd2`의 소유/관리 역할과 Worker `jalisco-auth-staging`, D1 `7712d6bb-2414-44d3-9282-cb5b941d740e`의 귀속을 확인한다. Supabase 조직의 소유/관리 역할과 프로젝트 `heaswpawzuuijxurlfoz`의 귀속도 별도로 확인한다. 기존 조직 기록과 제공자의 공식 계정 복구·지원 경로로 진위를 대조한다. 로그인/API 접근 성공은 기술 접근 증거일 뿐 법적·조직상 교체 권한 확인을 대신하지 않는다.

증거에는 비밀이 없는 외부 참조만 넣는다. 기존 키 복구 불가 확인, 암호·백업 확인 범위, 기존 자료 보존 참조도 포함한다. `staging/key-replacement-review.example.json`을 외부 검토 기록의 형식으로 사용하되 실제 검토 전에는 placeholder를 승인 사실로 바꾸지 않는다. 검토 기록 자체가 애플리케이션 신뢰 앵커가 되는 것은 아니다.

현재 실행 가능한 읽기 전용 명령:

```sh
node --experimental-strip-types scripts/admin-recovery-check.mjs
```

결과는 정책·공개 키 일치와 이전 정책 해시를 출력한다. 토큰·stdin·개인 키를 읽지 않고 네트워크나 쓰기를 수행하지 않는다. 이번 점검에서 루트는 부재, 공개 등록 bundle과 독립 검토 자료는 미제공이다. `ready_for_execution:false`는 실제 자격 증명·승인·배포를 확인하지 않았음을 뜻한다.

향후 공개 산출물/검토 기록을 받은 뒤에도 아래 명령은 읽기 전용이다. `REFERENCES_PRESENT_NOT_INDEPENDENTLY_VERIFIED`는 사람의 증거 진위 확인을 대체하지 않는다.

```sh
node --experimental-strip-types scripts/admin-recovery-check.mjs \
  --bundle /PROTECTED/public-enrollment-bundle.json \
  --review /PROTECTED/external-review.json
```

## 2. 별도 키 생성 승인과 fingerprint 검토

소유자가 **생성·백업 작업만** 승인한다. 기존 생성 도구를 사용하더라도 루트·복구·관리자 승인용으로 서로 다른 세 키와 외부 신규 디렉터리를 선택한다. 기존 키를 재사용하거나 덮어쓰지 않는다. 도구가 만드는 public receipt는 등록 증명이 아니다.

각 생성은 신뢰하는 오프라인 기기의 보호된 stdin으로 독립 암호를 공급하며 개인 키는 암호화 PKCS8로 보관한다. 디렉터리 0700, 파일 0600을 유지하고 개인 키·암호를 별도 매체에 백업한다. 실제 생성 명령은 이 문서에서 실행하지 않았다. 루트/복구 후보도 공개 키 형식을 Ed25519 SPKI와 JWK `x`로 변환해 대조할 수 있지만, 이를 승인 키로 등록해서 역할을 혼동하지 않는다.

검토자는 별도 신뢰 기기에 표시된 원본 공개 키와 반입본을 `SHA256:lowercase-hex(SPKI-DER)`로 대조한다. PEM 문자열/JWK 문자열의 해시와 혼용하지 않는다. 세 키의 역할·fingerprint·보관자·비밀 없는 복원 검증 결과를 기록하고 **등록을 별도로 승인**한다. 생성된 후보가 자기 자신을 루트로 선언한 서명은 독립 확인이 아니다.

## 3. 공개 enrollment bundle과 별도 루트·정책 승인

bundle은 `{root,bootstrap,activation}`이다. 비밀 키, 암호, 원문 PIN, pepper는 절대 포함하지 않는다. bootstrap에는 PIN verifier가 있으므로 공개 키만 있는 문서보다 엄격히 취급하고 보호된 파일로 보관한다. 도구는 이를 콘솔에 출력하지 않는다.

- `root`: `{scope,public_key}`. `public_key`는 독립 확인된 루트 Ed25519 JWK `x`다.
- `bootstrap`: 기존 `BootstrapPayload`의 `{payload,signature,policy_signature}`. 고정 scope/origin, 별도 owner UUID, epoch=1, 복구 키와 새 승인 정책, PIN verifier를 묶는다. PIN verifier는 기존 `createPinVerifier`의 PBKDF2/HMAC 규격으로 신뢰 기기에서 준비한다. PIN/pepper 입력·생성은 별도 승인 작업이다.
- `signature`: 루트가 `canonical(bootstrap.payload)`에 서명한 base64url Ed25519 서명.
- `policy_signature`: 루트가 `publicPolicyRoot(bootstrap.payload)`에 서명한 값. PIN verifier를 공개 정책 응답에 노출하지 않는다.
- `activation.payload`: 아래 형태. 해시는 정규화 JSON의 SHA256 소문자 hex다. 기존 정책의 registration 메타데이터도 해시에 포함한다.

```json
{
  "operation": "activate_owner_admin_gateway",
  "protocol": "owner-admin-grants-v1",
  "scope": "고정 STAGING 객체",
  "origin": "https://jalisco-auth-staging.yukikato123123123.workers.dev",
  "owner_id": "bootstrap과 동일한 별도 owner UUID",
  "bootstrap_sha256": "완성된 bootstrap envelope의 canonical SHA256",
  "previous_policy_sha256": "읽기 전용 점검이 반환한 기존 정책 canonical SHA256",
  "capabilities": ["admin_action", "admin_read", "grant", "revoke", "rotate_policy"]
}
```

위 JSON은 설명용이며 그대로 유효한 요청이 아니다. `scope`에는 `STAGING`의 전체 project/account/database/worker 객체가 들어간다.

`activation`에는 루트가 payload를 서명한 `signature`, 복구 키의 `recovery_signature`, 각 새 승인 키의 `approval_signatures:[{key_id,signature}]`가 필요하다. 복구/승인 키는 각각 `canonical({operation:'accept_owner_admin_activation',role:'recovery' 또는 'approver',activation:payload})`에 서명한다. 루트 서명·역할 분리·모든 후보 소유 증명이 없으면 초기화가 거부된다.

서명은 별도 승인 후 새 `scripts/owner-enrollment-sign.mjs`로 수행할 수 있다. `root-bootstrap`, `root-policy`, `root-activation`, `recovery-accept`, `approval-accept` 역할을 지원하며, 해당 역할의 정확한 payload SHA256와 독립 대조한 공개 fingerprint, 보호된 개인 키 입력이 모두 필요하다. 파일 생성은 배타적 0600이고 네트워크·등록·grant는 수행하지 않는다.

```sh
# 미래의 개별 서명 승인 후 신뢰하는 오프라인 기기에서만 실행할 예시
node scripts/owner-enrollment-sign.mjs \
  --role REVIEWED_ROLE --payload /PROTECTED/exact-payload.json \
  --public-key /PROTECTED/reviewed-candidate.pub \
  --fingerprint REVIEWED_SPKI_FINGERPRINT \
  --out /PROTECTED/new-signature-record.json \
  --confirm 'SIGN OWNER ENROLLMENT REVIEWED_ROLE REVIEWED_PAYLOAD_SHA256' \
  --passphrase-fd 3 < /PROTECTED/encrypted-private.pem \
  3< /SEPARATE_PROTECTED_LOCATION/passphrase-input
```

출력 `{payload,signature}`를 역할에 맞게 조립하고, bootstrap 두 서명이 완성된 후에 activation의 bootstrap 해시를 계산한다. 이전 복구 도구의 `VERIFIED_REVIEW_ONLY` 영수증을 activation으로 사용하지 않는다.

독립 검토자는 전체 bundle·이전 정책 해시·세 fingerprint를 검토한다. 소유자/검토자 신원과 단계별 승인 ID·시각·artifact 해시를 외부 기록에 남긴다. **루트/복구 키 등록 승인과 새 승인 정책 전환 승인은 분리한다.** 루트 공개 파일을 고정 경로에 새로 설치하는 작업도 별도 승인과 no-replace 확인이 필요하다. 기존 `staging/admin-approval-policy.json`은 수정하지 않는다. 정책 전환은 root-signed activation으로 새 authority에 위임하며 기존 정책을 서명 체인의 이전 해시로 보존한다.

## 4. 코드 검토·스키마·배포 — 각각 별도 승인

현재 코드는 선택적 활성화 후보이고 운영에는 반영되지 않았다. `OWNER_ADMIN_MODE=owner-admin-grants-v1`과 유효한 root-signed activation 없이는 새 grant 경로가 작동하지 않는다. 기존 owner state를 무서명으로 업그레이드하는 경로도 없다. 이미 DO state가 있다면 지우지 말고 별도 서명된 upgrade 설계로 중단한다. 현재 조사에서는 실제 owner 등록이 확인되지 않았다.

배포 검토 산출물에 다음을 포함한다.

1. 코드 검토 및 테스트 증거. 원격 ledger를 읽기 전용으로 확인해 `0009` 번호와 기존 migration 적용 상태를 재확인한다. 다른 migration이 선행하면 번호만 재조정하여 검토받는다. 기존 0008은 수정하지 않는다.
2. `OwnerAuthority` SQLite DO provisioning 승인, `DB` 바인딩 및 additive receipt schema 적용 승인, Worker artifact/config/활성화 승인. 이 세 가지는 각각 독립 승인 기록을 남긴다.
3. 정확한 staging origin/project/account/DB, `OWNER_AUTHORITY`, `OWNER_ADMIN_MODE`, `OWNER_PREVIOUS_POLICY_SHA256`, `OWNER_ROOT_PUBLIC_KEY`, `OWNER_BOOTSTRAP_MANIFEST`, `OWNER_GRANT_ACTIVATION`, 별도 `OWNER_PIN_PEPPER`의 설치 계획. 비밀은 보호된 플랫폼 입력으로만 공급한다. 예제 설정을 배포용 설정으로 간주하지 않는다.
4. 승인된 manifest로 최초 DO state를 초기화하는 작업도 등록 실행이다. 기존 owner 경로는 배포된 루트 서명 manifest를 검증하여 초기화하며 임의 HTTP body로 bootstrap을 받지 않는다. 운영자가 별도 승인된 초기화를 수행한 뒤 상태·감사·fingerprint를 검증한다. 새 grant의 policy/prepare/status는 미초기화 상태에서 503을 반환하고 초기화를 수행하지 않는다.
5. 불완전 owner 설정이 있으면 관리자 경로와 legacy grant CLI가 D1-only 경로로 돌아가지 않는지 확인한다. production/local을 무단 활성화하지 않는다. 기존 D1-only grant는 자동 수입하지 않는다.

DO는 승인 registry·epoch·감사·단일 pending 명령의 권위 저장소다. D1 receipt/기존 event/projection은 한 batch로 반영한다. D1 성공 후 DO 확인 전 장애는 pending으로 남아 특권 접근과 회전을 차단한다. 두 저장소의 동시 원자 커밋을 주장하지 않는다. 이전 epoch나 D1-only 신뢰 바이너리로 되돌리지 않는 장애 대응을 승인받아야 한다.

## 5. 온라인 dry-run·서명·실제 grant — 세 개의 결정

등록 및 호환 배포 후에만 진행한다. 아래는 실행하지 않은 명령 형식이다. `REQUEST_UUID`, reason, expected 값은 새 read-only 결과에 맞춰 검토한다. 토큰은 신뢰하는 운영 환경에 주입하며 CLI 인자·채팅에 넣지 않는다. CF user API token은 공식 token 검증과 해당 Worker settings 읽기 권한, Supabase PAT는 고정 프로젝트의 read-only Auth 조회 권한이 필요하다. 이 접근 권한 자체가 소유권 증거는 아니다.

```sh
node scripts/admin-grant.mjs --owner-aware --dry-run \
  --project heaswpawzuuijxurlfoz \
  --user 11111111-1111-4111-8111-111111111111 \
  --email administrator@example.test --action grant \
  --request REQUEST_UUID --reason 'REVIEWED_REASON' --expected none
```

CLI는 고정 로컬 root와 보존된 이전 정책을 읽고, 초기화 부작용이 없는 `/api/owner/admin-grants/policy`의 체인/activation을 검증한다. CF/Supabase 토큰은 고정 HTTPS gateway에만 전송하고 저장하지 않는다. 서버는 공식 관리 API의 token·배포 scope 및 Auth UID/email/확인/삭제/ban을 재검증하고 DB onboarding·기존 상태를 검사한다. 대상의 실제 새 로그인도 운영자가 대조한다. dry-run은 권한 또는 명령 예약을 기록하지 않는다.

운영자는 반환된 정확한 intent와 policy bundle을 검토·보관한다. 기존 `admin-approve.mjs`가 사용하는 `staging/owner-policy-chain.json`은 이 검증된 공개 bundle을 승인된 절차로 반입한다. 기존 승인 정책을 바꾸지 않는다. 임의 caller policy를 신뢰하지 않는다.

별도 서명 승인 후 `admin-approve.mjs`에 보호된 새 승인 개인 키와 passphrase fd를 제공하여 exact intent에 서명한다. `protocol`, authority epoch, policy digest, operator, target, expected event, UUID, reason을 바꾸지 않고 최대 1시간 유효기간을 유지한다. 이어 실제 실행 승인을 받은 경우에만 아래 형식을 사용한다.

```sh
node scripts/admin-grant.mjs --owner-aware --apply \
  --project heaswpawzuuijxurlfoz \
  --user 11111111-1111-4111-8111-111111111111 \
  --email administrator@example.test --action grant \
  --request REQUEST_UUID --reason 'EXACT_DRY_RUN_REASON' --expected none \
  --approval /PROTECTED/exact-signed-approval.json \
  --confirm 'APPLY grant 11111111-1111-4111-8111-111111111111 REQUEST_UUID'
```

최초 부여 이후에는 dry-run이 반환한 expected event를 사용한다. 루트가 있다는 이유로 구 CLI의 직접 D1 apply를 다시 활성화하지 않는다.

결과 불확실 시 같은 공통 대상 옵션에 `--status --owner-aware`를 사용한다. `--status`는 읽기 전용이며 request ID의 recorded/pending 및 막고 있는 명령 ID만 확인한다. 별도 조정 승인 뒤 `--resolve resume` 또는 `--resolve cancel`과 `--confirm 'RESOLVE OWNER COMMAND REQUEST_UUID'`를 사용한다. 두 명령은 상태를 변경하므로 dry-run으로 취급하지 않는다.

재개는 저장된 동일 명령만 사용한다. 취소는 D1의 불변 terminal receipt로 지연 쓰기와 경쟁하며, 이미 적용되었다면 취소 성공으로 위장하지 않고 기존 적용을 확인한다. timeout만으로 barrier를 지우지 않는다. mutation 장애도 동일 audit ID로 재개하며 중복 변경을 방지한다. 회전 후에는 구 epoch grant가 관리자 접근을 허용하지 않는다. 남아 있는 D1 active projection은 새 정책으로 별도 signed revoke 후 fresh grant하여 조정한다.

최종 운영 검증은 authority 감사/receipt와 D1 event/projection을 대조하고, 대상 계정 관리자 200·일반 사용자 403·익명 401 및 실제 관리자 화면을 확인한다. 이 검증은 아직 수행하지 않았다.

## 검증과 남은 승인

실제 완료한 로컬 검증 결과:

| 검증 | 결과 |
| --- | --- |
| auth/admin/owner, 관리 API 진단, 배포 설정, producer/directory 회귀 | 225개 통과. 신규 grant/CLI/readiness/offline signer와 실제 임시 workerd SQLite DO/D1 통합 포함 |
| 관리자·인증 링크/세션·공개 홈 브라우저 회귀 | 42개 통과. 정적 localhost preview와 mock API 사용; 기존 DB를 연결하지 않음 |
| typecheck / lint / build | 통과. build의 기존 번들 크기 경고는 남음 |
| readiness | 루트 부재, bundle·독립 검토 미제공, `ready_for_execution:false` |
| 실제 owner-aware grant dry-run 시도 | 로컬 루트 부재로 네트워크 요청 전에 차단. 운영 identity/bindings 검증 완료로 간주하지 않음 |
| 기존 정책·공개 키 | 작업 중 원시 파일 SHA256 유지. 아래 참조 |

테스트에서는 메모리의 합성 키·임시 DB·stub 관리 API만 사용했다. 브라우저 실행에 누락된 라이브러리는 `/tmp`에만 추출하여 사용했고 시스템 패키지를 설치하지 않았다. 이는 실제 소유권 확인·등록·배포 성공의 증거가 아니다. readiness의 최종 artifact binding 검사 변경 후 해당 테스트도 별도로 재통과했다.

보존 확인용 원시 파일 해시(정책 승인에 쓰는 canonical JSON 해시와 구분):

```text
staging/admin-approval-policy.json dfb0894a989e94d864729f88190cfc70a73d086ee4139801b959fb7547b83ef8
staging/approval-public.pub        599231b711853477d49abf60dbd01ee34e8dc10aeca56c1f32b5dc06d3c9ff2d
```

현재 남은 차단 요인은 독립 검토자 지정/승인, Cloudflare·Supabase 소유권 증거, 복구 불가 확인, 실제 후보 키·백업·fingerprint 대조, 승인된 루트/manifest/activation, 코드 보안 검토, 원격 migration 확인, 운영 승인·자격 증명이다. 키 생성 → 루트/복구 등록 → 정책 전환 → provisioning/migration/배포 → online dry-run → 승인 서명 → 실제 grant → 접근 검증 순서로 각각 승인받아야 한다.

## 실행 인계 보완: 증거 제출과 승인별 명령

이 절은 기존 구현을 변경하지 않고 실제 CLI 인터페이스와 대조한 인계 자료다. 아래의 변경 명령은 **하나도 실행하지 않았다.** 검토자 지정·소유권 확인·실제 승인 전에 키 생성이나 그 이후 단계로 진행하지 않는다. 안내서의 예시 명령이나 파일 존재를 승인으로 취급하지 않는다.

### 이번 읽기 전용 확인 결과

2026-10-23 09:20경(Asia/Rangoon)에 다음만 확인했다.

| 항목 | 실제 확인 결과와 한계 |
| --- | --- |
| 로컬 준비 점검 | 기존 정책·공개 키 일치, 위 원시 파일 해시 유지. canonical 정책 SHA256는 `66bfeaf59ce1863556aae33477447933206841547510ee8ffd602482ba75cfe2` |
| 루트·검토 자료 | 고정 루트 파일 부재. 아래 제안한 제출 폴더와 두 review 파일도 부재. 승인 완료로 표시하지 않음 |
| Cloudflare 저장 연결 | 기존 OAuth를 사용한 `GET /client/v4/user`가 HTTP 403. 연결이 존재한다는 사실만 확인했으며 현재 인증 성공·계정 역할·원격 설정 확인으로 간주하지 않음. 원인은 이 응답만으로 확정 불가 |
| Cloudflare 원격 상태 | 사용자 조회 거부 후 멤버십·Worker 설정·D1 SELECT·migration 조회를 진행하지 않음. 이전 진단의 값을 이번에도 확인했다고 주장하지 않음 |
| Supabase | 현재 프로세스에 연결된 관리 자격 증명 없음. 다른 저장소에서 토큰을 찾거나 새 연결을 만들지 않았고 프로젝트/조직 소유권·Auth 상태를 조회하지 않음 |
| 기존 코드·테스트 | 파일과 기존 검증 로그 확인. 이전 225개 서버/CLI 테스트와 42개 브라우저 통과 기록을 확인했으며 이번에는 재작성·재실행하지 않음 |
| CLI 문법 | 설치된 Wrangler의 migration list/apply, deploy, secret bulk `--help`만 확인. 원격 변경 명령은 실행하지 않음 |

403은 소유권 부재의 증거도 아니다. 현재 연결로 확인할 수 없다는 의미다. 재연결이나 토큰 입력을 증거 제출 작업과 혼합하지 않는다. 인증을 다시 사용할 수 있게 된 뒤 읽기 전용 원격 확인은 별도 작업으로 수행한다.

### 검토자가 받을 증거와 제출 위치

검토 패키지의 로컬 인계 위치는 `/home/administrator/.jalisco-admin/replacement-review-20261023/`로 지정한다. 아직 생성하거나 제출받지 않았다. 저장소 밖의 운영자 소유 0700 폴더, 파일 0600을 사용하며 버전 관리·공개 채팅·클라우드 자동 동기화에 넣지 않는다. 이 경로는 현재 공유 서비스나 접수 시스템에 연결되어 있지 않다. 운영자가 기존 조직 승인 채널을 통해 지정 검토자에게 안전하게 전달하고, 그 채널의 실제 티켓/문서 참조를 기록해야 한다. 특정 조직 티켓 URL은 제공되지 않아 임의로 만들지 않았다.

| 제출 자료 | 비밀 없는 증거의 종류 | 로컬 인계 위치 |
| --- | --- | --- |
| Cloudflare 권한·귀속 | 공식 계정의 멤버/역할 화면 또는 조직이 보관한 권한 부여 기록. 정확한 계정 ID, 요청자 신원, 활성 역할과 승인 권한이 연결되어야 함. Worker 이름 및 D1 ID가 같은 계정에 속한다는 화면/공식 기록도 대조 | `ownership-evidence/cloudflare/` 아래 마스킹한 증거 사본과 원본 기록 참조 |
| Supabase 권한·귀속 | 공식 조직의 멤버/역할 기록과 프로젝트의 조직 귀속 기록. 조직 식별자, 요청자 역할, project ref `heaswpawzuuijxurlfoz`를 연결. 접근 불가 시 제공자의 공식 지원/계정 복구 확인 기록 | `ownership-evidence/supabase/` 아래 마스킹한 증거 사본과 원본 기록 참조 |
| 요청자의 교체 권한 | 기존 조직의 담당자 지정·위임·자산 관리 기록. 단순 API 호출 성공, 이메일 일치, 결제 영수증 하나만으로 승인하지 않음 | `ownership-evidence/authority/` |
| 독립 검토자 지정 | 실제 검토자 신원·조직상 권한, 키 보관 담당자와 분리됨을 확인한 지정자·시각, 이미 알려진 별도 연락 채널의 참조 | `ownership-review.json` 및 외부 승인 기록 |
| 기존 키 복구 불가·보존 | 소유자의 복구 불가 확인, 백업/암호 확인 범위와 기존 자료 보존 참조. 암호 내용이나 개인 키 사본은 포함하지 않음 | `ownership-evidence/key-loss/` |
| 향후 fingerprint·artifact 검토 | 승인된 생성 이후의 루트/복구/승인 공개 fingerprint, 원본 기기와 별도 채널 대조 기록, bootstrap/activation 해시 | `external-review.json`과 `public-enrollment-bundle.json` |

검토자는 제출된 스크린샷만 믿지 않고 공식 계정/조직 기록 또는 기존의 독립 연락 채널에서 진위를 대조한다. 화면을 캡처할 때 API key·토큰·비밀번호·개인 키·PIN·pepper·세션 쿠키를 포함하지 않는다. 이 비밀들은 소유권 증거로 요구하지 않는다. 전체 계정 설정 내보내기나 원시 HTTP 헤더도 제출하지 않는다.

`ownership-review.json`은 **키 생성 전**의 사람 검토 기록이다. scope, review ID, 요청자, 키 보관 담당자, 검토자, 지정자/시각, 두 플랫폼 증거 참조, 별도 채널 참조, 복구 불가 확인 참조, 검토자의 실제 결정·시각·승인 범위를 기록한다. 초기 상태는 `PENDING`이고 실제 검토자만 자기 승인 기록을 남긴다. 소유권 검토 승인은 키 생성·등록·배포·grant 전체의 포괄 승인이 아니다.

`external-review.json`은 **별도 생성 승인 이후**의 공개 키·artifact 검토 기록이며 `staging/key-replacement-review.example.json` 형식을 따른다. 최초 소유권 검토 때 아직 없는 fingerprint를 지어내서 채우지 않는다. `reviewed_artifacts`는 실제로 대조한 키/문서의 값만 넣는다. 점검 도구가 형식·해시를 검증해도 결과는 `REFERENCES_PRESENT_NOT_INDEPENDENTLY_VERIFIED`이며 사람의 승인으로 승격하지 않는다.

### 승인별 명령: 출처·사전 조건·변경 영향

아래에서 `REQUEST_UUID`, `REVIEWED_*`, `/PROTECTED`, `/SEPARATE_PROTECTED_LOCATION`, `/OFFLINE_OWNER_ONLY_MEDIA`는 승인된 실제 값/보호 경로로 대체해야 한다. placeholder 상태에서 실행하지 않는다. 명령은 프로젝트 루트에서 개별 단계로 실행하며 한꺼번에 이어 실행하지 않는다.

기존 안내서에 이미 있었던 명령은 읽기 전용 점검, enrollment 서명, owner-aware grant dry-run/apply다. 생성 명령은 기존 `STAGING_KEY_RECOVERY.md`에서 가져왔다. **백업·로컬 루트 설치·migration·배포의 완전한 명령은 기존 안내서에 없었으므로 아래는 보완한 명령이며 기존 문서에서 추출했다고 주장하지 않는다.** 루트/복구 등록 전용 CLI는 여전히 없으며 `admin-trust-init`이나 recovery `review`로 대체하지 않는다.

#### A. 승인 전에도 가능한 로컬 읽기 전용 점검

```sh
node --experimental-strip-types scripts/admin-recovery-check.mjs
```

사전 조건: 기존 로컬 정책·설정 접근. 영향: 파일·네트워크·권한 변경 없음. 위에서 이번에 실행했으며 `ready_for_execution:false`다. 이후 변경 명령을 허용하는 승인 토큰이 아니다.

#### B. 별도 키 생성·백업 승인 후에만

사전 조건: 실제 독립 소유권 검토 완료, 역할별 생성 승인 ID, 보호된 기기·기존 외부 상위 폴더 0700, 독립 암호 입력과 백업 계획. 각 최종 경로는 존재하지 않아야 한다. 아래 세 명령은 **별개의 키**를 만들며 모두 도구의 공통 파일명 `approval-private.pem`, `approval-public.pub`, `public-review.json`을 사용한다. 역할은 상위 디렉터리로 구분한다. 어느 키도 자동 등록되지 않는다.

```sh
node scripts/admin-key-recovery.mjs generate \
  --directory /home/administrator/.jalisco-admin/staging-root-v1-20261023 \
  --confirm 'GENERATE OFFLINE STAGING APPROVAL KEY' \
  < /SEPARATE_PROTECTED_LOCATION/root-passphrase-input

node scripts/admin-key-recovery.mjs generate \
  --directory /home/administrator/.jalisco-admin/staging-recovery-v1-20261023 \
  --confirm 'GENERATE OFFLINE STAGING APPROVAL KEY' \
  < /SEPARATE_PROTECTED_LOCATION/recovery-passphrase-input

node scripts/admin-key-recovery.mjs generate \
  --directory /home/administrator/.jalisco-admin/staging-approval-v1-20261023 \
  --confirm 'GENERATE OFFLINE STAGING APPROVAL KEY' \
  < /SEPARATE_PROTECTED_LOCATION/approval-passphrase-input
```

변경 영향: 신규 외부 디렉터리 및 암호화 개인 키·공개 파일만 생성. 기존 정책·D1·grant·원격 구성에는 영향 없음. 암호는 20자 이상이고 키 옆에 저장하지 않는다. 로컬 실제 경로가 달라지면 생성/서명/백업 기록 모두 같은 검토 경로로 수정한다.

승인된 오프라인 암호화 매체에 백업하는 보완 명령:

```sh
(
  set -eu
  umask 077
  for role in root recovery approval; do
    source_dir="/home/administrator/.jalisco-admin/staging-${role}-v1-20261023"
    backup_dir="/OFFLINE_OWNER_ONLY_MEDIA/staging-${role}-v1-20261023"
    test ! -e "$backup_dir"
    test ! -L "$backup_dir"
    cp -a --no-clobber "$source_dir" "$backup_dir"
    for file in approval-private.pem approval-public.pub public-review.json; do
      cmp -s "$source_dir/$file" "$backup_dir/$file"
    done
  done
)
```

사전 조건: source는 승인된 생성 결과이며 symlink가 없어야 하고, 매체의 상위 폴더도 운영자 소유 0700이어야 한다. 영향: 매체에 **암호화된** 개인 키 사본 생성. 암호는 별도 매체에 보관한다. `cmp -s`는 내용을 출력하지 않고 바이트 일치만 확인하며 복호화 가능성은 증명하지 않는다.

별도 백업 복원 검증 승인 후, 각 역할에 대해 다음 형식으로 공개 키만 복원해 원래 공개 키와 대조한다. 개인 키 평문은 파일이나 콘솔에 쓰지 않는다.

```sh
(
  set -eu
  umask 077
  set -C
  openssl pkey \
    -in /OFFLINE_OWNER_ONLY_MEDIA/staging-root-v1-20261023/approval-private.pem \
    -passin fd:3 -pubout \
    3< /SEPARATE_PROTECTED_LOCATION/root-passphrase-input \
    > /PROTECTED/root-restored-public.pub
  cmp -s /home/administrator/.jalisco-admin/staging-root-v1-20261023/approval-public.pub \
    /PROTECTED/root-restored-public.pub
)
```

동일 형식을 recovery/approval에도 역할에 맞게 적용한다. 실패하면 등록 단계로 진행하지 않는다. 이 복원 검증은 이번에 실행하지 않았다.

#### C. 루트/복구 등록·정책 전환의 별도 승인 후에만

먼저 기존 §3의 `owner-enrollment-sign.mjs` 명령을 역할별로 실행해 검토할 bundle을 완성한다. 각 서명은 별도 승인, 정확한 payload 해시 및 독립 대조한 공개 fingerprint가 필요하다. 영향은 보호된 서명 파일 생성뿐이며 등록·grant가 아니다.

bundle과 검토 기록이 실제로 제출된 후 다음 읽기 전용 검증을 수행한다.

```sh
node --experimental-strip-types scripts/admin-recovery-check.mjs \
  --bundle /home/administrator/.jalisco-admin/replacement-review-20261023/public-enrollment-bundle.json \
  --review /home/administrator/.jalisco-admin/replacement-review-20261023/external-review.json
```

사전 조건: 실제 독립 검토자의 승인 기록 및 해당 artifact 해시와 fingerprint. 자동 검사 통과만으로 사람 승인 단계를 완료하지 않는다. 기존 정책 해시 또는 artifact가 바뀌면 재검토한다.

아래는 등록 전용 CLI가 없는 상태에서 **승인된 공개 root만** 고정 경로에 배타 설치하는 보완 명령이다. 입력 bundle의 root가 실제 검토·승인된 것인지 바로 앞에서 확인하고 승인 ID를 외부 기록에 남겨야 한다.

```sh
python3 - <<'PY'
import json, os, stat
from pathlib import Path
repo = Path('/home/administrator/projects/jalisco-produce-export')
source = Path('/home/administrator/.jalisco-admin/replacement-review-20261023/public-enrollment-bundle.json')
bundle = json.loads(source.read_text())
root = bundle['root']
scope = {'project_ref':'heaswpawzuuijxurlfoz',
         'account_id':'89dd3e659cece6bdf3181b991a2a0bd2',
         'database_id':'7712d6bb-2414-44d3-9282-cb5b941d740e',
         'worker':'jalisco-auth-staging'}
assert set(root) == {'scope', 'public_key'} and root['scope'] == scope
folder = repo / 'staging'
meta = folder.lstat()
assert stat.S_ISDIR(meta.st_mode) and not folder.is_symlink()
assert meta.st_uid == os.getuid() and not meta.st_mode & 0o022
fd = os.open(folder / 'owner-root-public.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as out:
    json.dump(root, out, indent=2)
    out.write('\n')
    out.flush()
    os.fsync(out.fileno())
fd = os.open(folder, os.O_RDONLY | os.O_DIRECTORY)
try:
    os.fsync(fd)
finally:
    os.close(fd)
PY
```

영향: 로컬 `staging/owner-root-public.json`만 신규 생성. 기존 파일·dangling symlink가 있으면 거부하며 기존 정책 파일은 수정하지 않는다. 부분 실패 시 파일을 삭제하거나 무작정 재시도하지 말고 조사한다. 이 명령은 원격 소유권·복구 키 등록 완료를 뜻하지 않는다. 실제 복구 키·정책은 승인된 manifest/activation과 호환 배포의 authority 초기화에서 반영된다.

#### D. 원격 migration 확인과 별도 적용 승인

사전 조건: 현재 Cloudflare 인증 성공을 다시 확인할 수 있어야 한다. 지금의 403 상태에서는 아래 명령도 진행하지 않는다. 읽기 전용 pending 목록 명령:

```sh
npx wrangler d1 migrations list DB --remote --config ./wrangler.staging.jsonc
```

이 명령은 **미적용 파일 목록**을 보여주며 적용 완료 이력 전체를 증명하지 않는다. 실제 `d1_migrations` 이력도 SELECT로 대조해 파일 번호·내용을 검토한다. 이번에는 둘 다 원격 확인하지 못했다.

적용할 **모든 pending migration 목록/해시**와 스키마 변경·복구 계획을 승인받은 후에만:

```sh
npx wrangler d1 migrations apply DB --remote --config ./wrangler.staging.jsonc
```

영향: 지정 DB의 모든 미적용 migration과 ledger를 변경한다. `0009`만 적용한다고 가정하지 않는다. 이번 후보의 0009는 grant/action receipt 및 불변성 trigger를 추가하고 관리자 계정을 부여하지 않는다. 미확인 선행 migration이 있으면 중단한다. CLI 확인 프롬프트는 외부 승인 기록을 대신하지 않으며 비대화형 환경에서는 생략될 수 있다.

#### E. DO provisioning·구성·배포·실제 초기화 승인

사전 조건: 코드/스키마 승인, 실제 소유권·키 등록·정책 전환 승인, D1 상태 확인, fingerprint 대조 및 보호된 secret 입력 준비. `wrangler.staging.jsonc`에는 현재 owner 바인딩·mode·DO migration이 없으므로 **현재 파일을 그대로 배포해서는 이 기능이 활성화되지 않는다.** 기존 §4의 항목을 별도 검토한 설정에 반영하고 정확한 config 해시를 승인받아야 한다. 이번에는 설정을 수정하지 않았다.

로컬 빌드·업로드 없는 bundle 검증 명령:

```sh
npm run build
npx wrangler deploy --dry-run --config ./wrangler.staging.jsonc \
  --outdir /tmp/jalisco-owner-approved-deployment-review
```

영향: 로컬 dist/bundle 파일 생성만 하며 원격 업로드·등록은 하지 않는다. dry-run 성공은 실제 root/secret/DB/DO 초기화 성공의 증거가 아니다.

별도로 승인된 설정·DO migration과 운영 배포에 대한 최종 승인 후에만:

```sh
npx wrangler deploy --config ./wrangler.staging.jsonc --strict \
  --secrets-file /PROTECTED/approved-owner-runtime-secrets.json
```

영향: Worker 코드·assets·검토된 vars·DO class migration/binding과 런타임 secret을 원격 반영한다. secret 파일에는 필요한 `OWNER_ROOT_PUBLIC_KEY`, `OWNER_BOOTSTRAP_MANIFEST`, `OWNER_GRANT_ACTIVATION`, `OWNER_PIN_PEPPER`만 넣고 개인 키는 절대로 포함하지 않는다. 원문 PIN·암호·관리 API 토큰도 포함하지 않는다. 기존 인증 secret 보존을 사전 확인한다. secret 파일 내용은 증거 패키지에 제출하거나 콘솔에 출력하지 않는다. `secret bulk`는 별도 원격 변경/배포를 만들 수 있으므로 승인 없이 먼저 실행하는 준비 명령으로 사용하지 않는다.

**초기화 주의:** 현재 구현은 등록 RPC 없이, 유효한 서명 manifest를 설치한 뒤 owner 경로가 처음 호출될 때 DO를 초기화할 수 있다. 따라서 배포 이후에 등록 승인을 받는 순서로 운용할 수 없다. 배포 전에 별도의 등록·복구 키·정책 전환 승인도 모두 확보해야 한다. 승인된 초기화를 명시적으로 확인할 때의 호출 형식은 다음과 같다.

```sh
curl --silent --show-error \
  --output /PROTECTED/owner-initialization-response.json \
  --write-out '%{http_code}\n' \
  https://jalisco-auth-staging.yukikato123123123.workers.dev/api/owner/session
```

이 GET은 첫 호출이면 DO state·감사를 쓸 수 있으므로 **읽기 전용 진단이 아니다.** 보통 유효 owner 세션이 없으면 401이지만, 401만으로 등록 성공을 판정하지 않는다. 이후 `/api/owner/admin-grants/policy`의 서명 체인·epoch·공개 root/정책과 승인 artifact를 대조하고 감사 기록을 확인한다. 이번 작업에서는 호출하지 않았다.

#### F. 관리자 dry-run·별도 서명·별도 실제 grant 승인

사전 조건: 위 단계의 실제 승인·완료 검증, 대상 계정의 fresh 로그인, 공식 read-only Auth 검증에 사용할 승인된 운영 연결. OAuth 저장 연결만으로 CF user API token 입력 요건을 충족했다고 간주하지 않는다. 관리 자격 증명은 보호된 실행 환경에만 주입하고 증거 자료로 제출하지 않는다.

기존 §5의 `admin-grant.mjs --owner-aware --dry-run` 명령을 그대로 사용한다. 변경 영향은 없음. 정확한 request/operator/target/epoch/policy digest/expected event를 검토한다. 반환 payload의 실제 approval reference·유효기간을 검토하고 서명 승인을 별도로 받은 후:

```sh
node scripts/admin-approve.mjs \
  --payload /PROTECTED/exact-reviewed-grant-payload.json \
  --key-id REVIEWED_APPROVER_ID \
  --out /PROTECTED/exact-signed-approval.json \
  --confirm 'APPROVE REQUEST_UUID' --passphrase-fd 3 \
  < /home/administrator/.jalisco-admin/staging-approval-v1-20261023/approval-private.pem \
  3< /SEPARATE_PROTECTED_LOCATION/approval-passphrase-input
```

사전 조건: 고정 root와 검증된 최신 `staging/owner-policy-chain.json`, 해당 intent에 대한 실제 서명 승인. 영향: 암호화 키를 메모리에서 사용하고 보호된 서명 파일만 신규 생성. 관리자 grant는 하지 않는다.

그다음 **실제 grant 적용 승인을 별도로** 받아 기존 §5의 `--owner-aware --apply` 전체 명령을 사용한다. `--reason`, UUID, `--expected`를 dry-run 결과와 일치시키며 현재 grant가 0건이라고 재확인한 경우에만 `--expected none`을 사용한다. 영향: authority 명령·감사 및 D1 event/projection/receipt 변경과 실제 관리자 권한 부여. 결과가 불확실하면 `--status`로 읽기 전용 확인하고 별도 승인 없이 `--resolve`나 새 request ID로 재시도하지 않는다.

현재 단계의 결론은 `독립 검토 승인 대기`다. 다음 단계의 명령을 기재한 것은 실행 또는 승인 처리가 아니며, 실제 검토자 승인 전에는 이 경계를 넘지 않는다.
