# 스테이징 관리자 승인 키 정식 교체 계획

상태: 계획만 작성. 기존 키를 복구할 수 없다는 소유자 확인을 전제로 한다. 이 문서는 실행 승인이나 새 신뢰 근거가 아니다. 키 생성, 비밀 입력, 루트 등록, 정책 변경, D1 변경 및 배포를 수행하지 않았다.

후속 구현 상태: 로컬 `owner-admin-grants-v1` gateway, 별도 root-signed activation, 공개 산출물 점검·오프라인 서명 도구 및 테스트 후보를 추가했다. 아래의 미구현 목록은 최초 계획 당시의 gap이며, 현재 코드 대조와 승인별 실행 절차는 [실행 준비 결과](STAGING_ADMIN_EXECUTION.md)를 따른다. 운영 등록·배포·grant는 여전히 미실행이다.

근거: [키 복구 절차](STAGING_KEY_RECOVERY.md), [소유자 복구 및 미구현 연동 설계](OWNER_RECOVERY.md). 구현과 운영 상태는 각 실행 승인 전에 다시 확인한다.

## 고정 대상과 보존 대상

| 항목 | 값 |
| --- | --- |
| Worker | `jalisco-auth-staging` |
| Supabase | `heaswpawzuuijxurlfoz` |
| Cloudflare account | `89dd3e659cece6bdf3181b991a2a0bd2` |
| D1 | `7712d6bb-2414-44d3-9282-cb5b941d740e` |
| Origin | `https://jalisco-auth-staging.yukikato123123123.workers.dev` |
| 관리자 대상 | `administrator@example.test` / `11111111-1111-4111-8111-111111111111` |
| 기존 승인 키 fingerprint | `SHA256:911f43e48a44503d627aa3a3bea6ca07fd0da8174b7aa916f7d915b1336f006a` |

기존 `staging/admin-approval-policy.json`, 공개 키, 암호화 개인 키, 영수증과 실패 기록을 보존한다. 기존 정책 삭제·덮어쓰기, 새 키를 기존 키로 위장, D1 직접 grant 삽입, 서명 검사 완화는 금지한다. 기존 계정·데이터를 삭제하지 않는다. 위 이메일과 UID는 교체 승인 또는 소유권의 증거가 아니며 실제 grant 직전에 재검증한다.

현재 소유자 루트가 없어 `RECOVERY_UNTRUSTED`다. 정책의 등록 메모·로컬 확인 문자열·Cloudflare API 접근·이메일 일치만으로 새로운 루트를 신뢰하지 않는다. 새 키 생성은 소유권, 정책 등록 또는 관리자 권한을 부여하지 않는다.

## 승인 기록 공통 요건

각 단계마다 별도 승인 ID, 승인자·검토자 신원, 시각, 정확한 대상 범위, 검토한 산출물 해시, 허용 작업 및 중단 조건을 남긴다. 이전 단계 승인은 다음 단계로 승계되지 않는다. 기존 승인 정책의 정규화 JSON SHA256도 기록한다. 비밀 키·암호·PIN·pepper·세션 쿠키는 문서, 채팅, 저장소 또는 로그에 넣지 않는다.

## 단계별 계획과 승인 경계

| 단계 | 별도로 승인할 작업 | 승인 전 산출물과 통과 조건 |
| --- | --- | --- |
| 0. 독립 소유권 확인 | 교체 요청의 정당성 검토 | 기존 암호·백업 복구 불가 확인, 기존 자료 보존 목록, 프로젝트·계정 소유권 증거 및 독립 검토 기록 |
| 1. 새 키 생성 | 루트 키·복구 키·승인 키의 오프라인 생성과 백업 | 역할별 보관 책임자, 별도 키 사용, 보호된 신규 경로, 암호 전달·백업·복원 확인 계획. 생성 승인은 등록을 허용하지 않음 |
| 2. 신뢰 루트 및 복구 키 등록 | 독립 확인된 루트의 고정과 루트 서명 초기 manifest 승인·등록 | 공개 키 fingerprint 독립 대조, 소유자·검토자 승인, 공개 키 형식 검증, 키 소유 증명, scope·owner_id·epoch·복구 키·권한 위임을 묶은 manifest. 배포 승인은 별도 |
| 3. 연동 코드 구현 | 소유자 authority와 관리자 grant gateway 개발·검증 | 아래 미구현 범위의 설계 검토 및 구현 PR, 테스트 결과, 마이그레이션·배포 후보. 운영 변경은 허용하지 않음 |
| 4. 승인 정책 변경 | 정확한 이전 정책 해시에서 새 정책으로의 서명된 전환 | 새 승인 키 소유 증명, 루트/현재 authority가 승인한 서명 체인, epoch·요청 ID·만료·감사 검증. 기존 정책 파일 수동 교체로 등록하지 않음 |
| 5. 운영 구성 및 배포 | DO provisioning, additive D1 migration, Worker 배포·활성화 | 각 작업의 개별 승인, 정확한 artifact/config 해시, 공개 루트 일치, 검증·장애 대응 계획. grant 실행 권한은 포함하지 않음 |
| 6. 관리자 grant | 특정 대상·요청에 대한 서명과 실제 grant 실행 | 운영 read-only dry-run과 별도 서명 승인 후, 정확한 intent·서명 envelope를 검토한 별도 적용 승인. gateway 경유 및 사후 감사·접근 검증 필수 |

정책 전환은 authority 등록과 호환 배포가 갖춰지기 전에는 승인된 제안 상태로만 보관한다. 운영 적용 순서와 활성화 시점은 배포 검토에서 명시하고, 선행 조건이 없으면 중단한다. 루트 등록을 위해 기존 정책을 임시 삭제하지 않는다.

## 독립 소유권 확인과 fingerprint 대조

1. 요청자가 제공한 이메일·로컬 파일과 독립된 기존 조직/프로젝트 관리 기록, 사전에 확인된 연락 채널과 Cloudflare·Supabase의 공식 소유권 확인 경로를 이용한다. 검토자는 두 플랫폼의 정확한 프로젝트/계정 범위와 요청자의 교체 권한을 확인하고 증거 참조를 기록한다. API 토큰 보유만으로 소유자로 판정하지 않는다.
2. 키 생성·보관 담당자와 분리된 검토자를 지정한다. 검토자는 요청자에게서 이번에 전달받은 키 사본만 서로 비교하지 않고, 소유권을 확인한 별도 채널/신뢰 기기에 표시된 원본 공개 키 fingerprint와 대조한다. 독립된 근거를 확보하지 못하면 등록을 중단한다.
3. 루트·복구·승인 키는 서로 다른 역할로 구분한다. 각각 Ed25519 공개 키를 SPKI DER로 정규화하여 `SHA256:lowercase-hex(SPKI-DER)`를 계산하고 원본과 반입본을 대조한다. 루트/복구 저장 형식인 JWK `x`도 동일 공개 키로 변환해 대조한다. 서로 다른 직렬화의 원시 문자열 해시를 같은 fingerprint로 취급하지 않는다.
4. 검토자는 키 역할, fingerprint, 고정 scope, 보관 책임자, 소유 증명 결과 및 manifest/policy 해시를 승인한다. 루트 서명은 독립 확인 이후에만 신뢰한다. 후보 승인 키가 자기 자신을 루트로 선언한 서명은 승인 근거가 아니다.

## 키 생성과 초기 루트 등록의 실행 전 요건

향후 생성 승인을 받으면 신뢰하는 오프라인 기기에서 새 경로에 생성한다. 기존 승인 키 생성 도구는 승인 키 후보용이며 루트 등록 도구가 아니다. 암호화 PKCS8 Ed25519, 승인 키 암호 20자 이상, 저장소 외부 디렉터리 0700·파일 0600, 보호된 stdin과 별도 암호 백업을 사용한다. 기존 디렉터리를 재사용하지 않는다. 암호화 개인 키와 암호는 분리 보관하고 승인된 복원 검증으로 키에서 유도한 공개 키의 일치를 확인한다.

초기 소유자 등록은 자동화되어 있지 않다. 승인받은 root-signed manifest에는 `owner_bootstrap`, `owner-pin-key-v1`, 고정 scope/origin, 별도 owner UUID, epoch=1, 복구 공개 키, PIN verifier와 승인 정책을 묶고 `signature` 및 PIN 정보를 제외한 공개 정책용 `policy_signature`를 검증한다. owner UUID는 Supabase UID를 대신하지 않는다. PIN만으로 복구하지 않으며 독립 복구 키와 별도 pepper를 요구한다.

`staging/owner-root-public.json`은 `{scope,public_key}` 형태의 공개 앵커다. 파일 생성 자체는 등록 완료가 아니다. 독립 승인된 루트가 운영 `OWNER_ROOT_PUBLIC_KEY`, manifest 서명 검증 및 보관 기록과 일치해야 한다. 향후 `OWNER_AUTHORITY`, `OWNER_BOOTSTRAP_MANIFEST`, `OWNER_PIN_PEPPER`와 SQLite-backed DO 구성이 필요하며, 예제 설정을 그대로 배포하지 않는다. 각 등록·운영 반영은 별도 검토 대상이다.

## 기존 복구 도구가 할 수 있는 범위

`scripts/admin-key-recovery.mjs`의 `plan`은 키를 생성하지 않는다. 향후 정식 루트 확립 후 `request`는 이전 정책 해시·이전/새 fingerprint·scope·UUID·5분 만료를 묶는다. 루트 서명과 후보 승인 키의 acceptance 서명을 검증하는 `review`는 감사 파일을 기록하는 작업이므로 읽기 전용이 아니다. 이번 계획에서는 실행하지 않는다.

성공 결과도 `VERIFIED_REVIEW_ONLY`, `registered:false`다. 등록·배포·grant 명령은 없고 이 검토 기록을 grant 승인 정책으로 사용할 수 없다. 로컬 감사 파일의 요청 ID 검사만으로 분산 재전송 방지를 충족하지 못한다. `admin-trust-init`의 첫 등록 경로도 기존 정책을 교체하는 복구 수단이 아니다.

## 실제 grant까지 필요한 미구현 코드와 검증

기존 일반 관리자 서명 grant 도구는 있으나, 새 소유자 루트/정책 교체와 연결된 owner-aware 관리자 grant 연동은 구현되지 않았다. 루트가 존재하면 기존 직접 D1 apply도 차단된다. 루트를 등록한 뒤 기존 CLI로 우회해서는 안 된다.

별도 구현 승인 후 필요한 범위는 다음과 같다.

- `worker/owner/authority.ts`, `crypto.ts`: 버전이 명시된 정책 전환, epoch, 서명 grant registry, 영속 command barrier, 감사 및 outbox/status. 루트의 정책 회전 권한 위임도 명시한다.
- 신규 `worker/owner/gateway.ts` 및 `worker/index.ts`, `worker/admin.ts`: 현재 authority epoch로 모든 관련 특권 읽기/쓰기를 통제한다. 정책을 조회한 뒤 CLI에서 별도 D1 쓰기를 하는 방식은 허용하지 않는다.
- `scripts/admin-grant.mjs`, `scripts/admin-approve.mjs`, 관련 `scripts/lib` 모듈: epoch·정책 digest가 포함된 정확한 grant intent와 서명 체인을 검증하고 gateway를 사용한다. 대상 Auth 신원·온보딩·만료·request ID·이전 event CAS 검사를 유지한다.
- 실제 원격 ledger 확인 후 번호를 정한 additive migration: 불변 receipt·감사·projection과 요청 중복/상태 경쟁 검사. 기존 `0008`을 바꾸거나 직접 grant 행을 삽입하지 않는다.

DO와 D1은 하나의 트랜잭션이 아니다. DO를 소유권의 권위 저장소로 유지하고 D1을 projection으로 취급하는 설계를 검토한다. 불확실한 명령은 barrier로 보존하고 동일 ID로 확인·조정하며, timeout만으로 성공·취소·rollback을 추정하지 않는다. pending projection 상태의 의미를 승인받아야 한다.

구현 승인과 운영 활성화 승인 사이에 다음 증거가 필요하다.

- 잘못된 서명·scope·키 역할·만료·request 재사용·stale epoch·프로토콜 downgrade 거부.
- 정책 회전과 grant의 경쟁, 동시 요청, DO 재시작, D1 장애, 각 commit/ack 전후 crash, 지연 쓰기/취소 및 중복 projection 검증.
- 감사 실패 시 안전한 중단, 단 한 번의 권한 전환, 불확실 상태에서 조기 성공 금지, D1 위조 grant 거부.
- 일반 관리자·이메일·PIN만으로 소유권 획득 불가, owner 쿠키가 Supabase 세션으로 변환되지 않음, 비밀 출력 없음.
- 기존 인증·공개 기능·브라우저 회귀 및 local workerd/DO/D1 통합 검사. 합성 테스트 결과와 실제 스테이징 증거를 구분한다.

배포 전 모든 특권 경로의 gateway 적용, 원격 구성·ledger, manifest/루트 대조 및 구버전 우회 경로 차단을 검토한다. 이전 epoch 또는 D1-only 신뢰 바이너리로 되돌리는 장애 대응은 허용하지 않는다. 단계 실패 시 현재 상태와 감사 증거를 보존하고 재승인 없이 다음 단계로 진행하지 않는다.

## 실제 관리자 grant 승인 기준

호환 코드가 승인·배포된 뒤 공식 Supabase read-only 관리 경로로 대상 이메일/UID가 정확히 한 명의 확인된·미삭제·미차단 사용자임을 재검증한다. 실제 로그인 세션, application onboarding, 현재 grant/event 상태와 Worker scope도 확인한다. 이번 문서에서는 조회를 수행하지 않았다.

운영 dry-run의 정확한 scope, target, operator, action, request ID, reason, expected event, authority epoch와 policy digest를 검토한다. 기존 최대 1시간 승인 유효기간을 유지하고 새 승인 키로 이 intent를 서명하는 작업 자체를 별도 승인한다. 이어 서명 envelope와 intent를 묶은 실제 실행 승인을 받아 gateway를 통해 적용한다. 복구 서명은 grant 서명을 대체하지 않는다.

적용 후 authority receipt·감사·D1 projection을 대조하고 대상 계정의 관리자 접근 성공, 일반 사용자 403, 익명 401을 확인한다. 결과가 불확실하면 같은 request ID로 상태만 확인하며 새 ID로 무작정 재시도하지 않는다.

## 사용자가 직접 수행할 다음 단계 하나

프로젝트 소유권을 독립적으로 확인할 검토자를 지정하고, 기존 키 복구 불가 확인과 Cloudflare·Supabase 소유권 증거 참조를 포함한 교체 검토 요청을 제출한다. 비밀 값은 포함하지 않는다.
