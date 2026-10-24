# Staging 승인 키 교체·복구

현재 기존 키의 암호를 해제할 수 없고 `staging/owner-root-public.json`도 없다.
**현재 등록 복구 상태: RECOVERY_UNTRUSTED.** 기존 정책의 등록 메모나 로컬 확인 문자열은 독립적인 소유자 승인 증거가 아니다. 기존 키·공개 키·정책을 삭제하거나 편집하여 우회하지 않는다.

후속 로컬 구현: 별도 root-signed activation을 요구하는 owner-aware grant gateway와 검증 후보는 [실행 준비 결과](STAGING_ADMIN_EXECUTION.md)에 정리했다. 이 문서의 기존 recovery review 명령은 여전히 등록 권한이 없고, 실제 루트 부재 상태도 바뀌지 않았다. 새 경로의 코드 구현은 실제 키 생성·등록·정책 전환·배포·grant 승인을 대신하지 않는다.

대상은 Supabase `heaswpawzuuijxurlfoz`, Worker `jalisco-auth-staging`, D1 `7712d6bb-2414-44d3-9282-cb5b941d740e`로 고정된다. 기존 SPKI DER fingerprint는 `SHA256:911f43e48a44503d627aa3a3bea6ca07fd0da8174b7aa916f7d915b1336f006a`다.

## 실행 순서

1. 기존 자료를 보존하고 소유자와 별도 채널에서 장애 및 교체 요청을 확인한다. 새 키 생성 자체는 등록 승인이 아니다.
2. 저장소 외부의 기존 소유자 전용(0700) 상위 디렉터리 아래에 **존재하지 않는 새 경로**를 정한다. 기존 키 디렉터리를 재사용하지 않는다.

   ```sh
   node scripts/admin-key-recovery.mjs plan --directory /protected/owner/staging-replacement-20261023
   node scripts/admin-key-recovery.mjs generate --directory /protected/owner/staging-replacement-20261023 --confirm 'GENERATE OFFLINE STAGING APPROVAL KEY' < /protected/passphrase-input
   ```

   암호는 20자 이상이며 보호된 stdin으로만 제공한다. 새 디렉터리 0700, 파일 0600, AES-256-CBC 암호화 PKCS8 Ed25519 개인 키를 사용한다. 파일은 배타적으로 생성하며 일부 쓰기 실패 시 보존하고 수동 점검한다. 개인 키와 암호는 별도 매체에 백업한다. CLI는 개인 키를 출력하지 않는다.
3. 공개 요청을 생성한다. 요청 ID는 새 UUID, approval-ref는 외부 승인 기록의 식별자를 사용한다.

   ```sh
   node scripts/admin-key-recovery.mjs request --directory /protected/owner/staging-replacement-20261023 --request REQUEST_UUID --approval-ref OWNER_TICKET
   ```

   반환된 `payload`를 그대로 검토한다. 5분 동안만 유효하다. 기존 정책의 정규화 JSON SHA256, 이전·새 fingerprint, 새 공개 키, staging 전체 범위 및 요청 ID가 서명에 묶인다.
4. **현재는 여기서 중단한다.** 사전에 인증된 소유자 루트가 없다. 계정·조직 소유권을 독립적으로 검증하는 외부 절차에서 신뢰 루트와 그 fingerprint를 승인하고, 분리된 검토자가 배포·보관된 루트와 대조해야 한다. 새 후보 키를 루트로 자체 지정하거나 파일을 로컬에서 생성하는 것만으로 이 요건을 충족할 수 없다. 이 도구는 루트 생성·등록 또는 대체 복구 신뢰 체계의 bootstrap을 제공하지 않는다. 기존 OWNER_RECOVERY 절차의 루트/authority 승인·배포도 별도 검토 대상이다.
5. 향후 신뢰 루트가 정당하게 확립된 뒤, 소유자 루트 개인 키로 `canonical(payload)`에 Ed25519 서명한다. 새 개인 키로 `canonical({operation:'accept_staging_approval_key_recovery',payload})`에 서명한다. canonical은 `scripts/lib/admin-grant.mjs`의 재귀 키 정렬 JSON이다. 두 서명은 base64url이며 envelope는 `{payload,owner_signature,next_signature}`다. 루트 파일은 기존 owner 형식 `{scope,public_key}`이며 public_key는 Ed25519 JWK의 x 값이다. 로컬 확인 문자열은 서명을 대체하지 못한다.

   ```sh
   node scripts/admin-key-recovery.mjs review --directory /protected/owner/staging-replacement-20261023 --envelope /protected/signed-envelope.json
   ```

   고정 경로의 루트를 검증하고 `staging/key-recovery-review-REQUEST_UUID.json`을 배타적으로 기록한다. 동일 요청 ID는 재검토할 수 없다. 기록에는 envelope, 루트·envelope 해시와 검토 시각이 함께 들어간다. 감사 파일을 쓸 수 없으면 성공을 반환하지 않는다. 거부는 stderr와 실패 종료 코드로 보고하며 성공 감사 파일은 생성하지 않는다. 운영자는 실패 실행 기록도 별도 보관한다.
6. 결과는 `VERIFIED_REVIEW_ONLY`, `registered:false`다. **등록·배포·grant는 구현된 명령이 아니다.** 이 감사 기록을 기존 grant 정책으로 사용할 수 없다. 이후 실제 전환은 별도 승인된 owner authority의 서명 체인·epoch fencing·감사 트랜잭션을 거치는 절차로 수행해야 한다. 기존 정책 파일을 교체해 등록하지 않는다. 현 도구의 재전송 방지는 이 저장소의 보존된 감사 파일에 한정된다. 분산 등록의 재전송 방지는 authority의 원자적 요청 ID/epoch 검사로 처리해야 하며 파일 삭제·다른 복제본 사용을 등록 승인으로 인정하지 않는다.

실제 관리자 부여는 키 등록 이후에도 기존 사용자 확인, onboarding, 승인 만료, 요청 ID, 상태 경쟁 검사 및 owner-aware gateway 검사를 모두 통과해야 한다. 이번 작업은 배포, 실제 키 생성, 등록, 관리자 부여를 수행하지 않았다.
