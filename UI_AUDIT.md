# Jalisco Produce Export UI/UX 레이아웃 감사

검사일: 2026-10-22 UTC. 대상: 현재 스테이징과 로컬 수정본. 스테이징을 이번 작업에서 재배포하지 않았다.

## 검사 방법과 증거 범위

Chromium을 실제 실행해 요청한 5개 뷰포트에서 페이지를 열고, 전체 페이지 PNG·주요 화면의 첫 화면 PNG·DOM 좌표·문서 폭·헤더/내비게이션 위치·그리드 열·작은 조작 요소를 수집했다. 주요 수정 전후 화면을 직접 보았고, 모든 화면 상태의 첫 화면은 뷰포트별 contact sheet로 비교했다. 가로 스크롤 검사만으로 접근성이나 모든 기능의 정상 작동을 판정하지 않았다.

- 수정 전: 실제 스테이징 `https://jalisco-auth-staging.yukikato123123123.workers.dev`.
- 수정 후: 최종 로컬 Worker 빌드 `http://localhost:8787`. 스테이징에 아직 반영되지 않은 결과다.
- 공개 페이지와 비로그인 보호 경로는 실제 HTTP 응답으로 검사했다.
- 인증된 대시보드, 유효한 복구 세션, 온보딩, 긴 데이터, 저장 중/성공/오류 상태는 **브라우저 API 응답을 가로챈 합성 데이터**다. 실계정 인증·원격 D1 저장 성공을 의미하지 않는다. 실제 사용자 데이터·비밀번호·이메일은 사용하지 않았다.
- 스크립트는 실제 공개 상태에서 GET 이외의 API 요청을 차단한다. 합성 상태에서는 모든 API 응답을 로컬에서 처리하고 미정의 API는 403으로 차단한다.
- 합성 대시보드의 이름·품목명은 서버 허용 길이인 120자, 공백 없는 문자열이다. 이메일은 `.test` 도메인이다. 길어진 소개와 오류도 검사했다.
- 검사 도구: `scripts/audit-layout.mjs`. 최종 성공 기록은 `.wrangler/layout-audit/final/metrics.json`이다.

## 실제 페이지와 경로 목록

| 경로/화면 | 구현 상태와 검사 범위 |
| --- | --- |
| `/` | 공개 랜딩. PRODUCER 탭의 소개·수확·대비 차트·생산자 자료·준비 상태, 공통 헤더와 푸터 |
| `/` LOGISTICS 탭 | 공개 지도, 레이어 체크박스, 범례, 지도 보기·목적지 버튼, 지도 상세 표시 |
| `/` COMMERCIAL 탭 | 가격·포장 정보와 문의 폼. 문의는 기존의 로컬 미리보기 기능이며 외부 전송 기능이 아니다 |
| `/` READINESS 탭 | 준비 상태·서류·정보 disclosure |
| `/explore` | 공개 목록, 검색·지역/국가/분류 필터, 빈 결과·로딩·오류 |
| `/explore?id=…` | 공개 품목 링크와 생산자·공급 정보 disclosure. 별도 `/products/:id` 상세 페이지는 없음 |
| `/login` | 로그인 폼과 오류 상태 |
| `/signup` | 계정 유형 선택 카드와 가입 폼, 선택 완료 상태 |
| `/verify-email` | 이메일 코드 입력, 재발송 disclosure |
| `/verify-email?purpose=recovery` | 복구 코드 목적 선택 및 만료 링크 오류 안내 |
| `/forgot-password` | 복구 요청 폼. 이번 감사에서 이메일을 발송하지 않음 |
| `/reset-password` | 비로그인 거부 화면과 합성 복구 세션의 새 비밀번호 폼. 비밀번호 변경 미실행 |
| `/onboarding` | 비로그인 거부 및 합성 온보딩 폼 |
| `/account` | 계정 진입. 비로그인 오류 화면 검사; 역할별 이동은 기존 브라우저 테스트로 검사 |
| `/producer/dashboard` | 비로그인 보호 화면과 합성 프로필·요약·등록/편집/삭제 버튼·품목 상태 폼 |
| `/buyer/dashboard` | 비로그인 보호 화면과 합성 구매자 프로필·관심 품목·공개 검색 |
| `/workspace`, `/buyer` | 기존 생산자/구매자 호환 진입 경로. 비로그인 화면 검사 |
| 관리자 페이지 | **미구현**. 관리자 화면이나 관리자 기능 검증 성공을 주장하지 않음 |

공개 앵커 `#overview`, `#supply`, `#packaging`, `#pricing`, `#markets`, `#documents`, `#contact`는 랜딩 내부 탭/문의 이동 코드가 처리하며 독립 페이지는 아니다.

## 화면 크기별 최종 검사

각 크기마다 같은 32개 상태를 실제 브라우저로 검사했다. 인증된 상태는 위에 설명한 합성 데이터다.

| 뷰포트 | 상태 수 | 캡처/측정 실패 | 문서 가로 넘침 | 레이아웃 결과 |
| --- | ---: | ---: | ---: | --- |
| 375×812 | 32 | 0 | 0 | 검사 범위 PASS |
| 390×844 | 32 | 0 | 0 | 검사 범위 PASS |
| 768×1024 | 32 | 0 | 0 | 검사 범위 PASS |
| 1366×768 | 32 | 0 | 0 | 검사 범위 PASS |
| 1440×900 | 32 | 0 | 0 | 검사 범위 PASS |

32개 상태: landing, logistics, commercial-form, readiness, explore, login, signup, verify-email, forgot-password, reset-password, onboarding, account, producer-dashboard, buyer-dashboard, workspace, buyer, produce-detail-long, explore-empty, explore-error, explore-loading, producer-long, buyer-long, reset-authorized, onboarding-form, verify-error, login-error, producer-empty, buyer-empty, producer-success, producer-saving, buyer-error, signup-selected.

PASS는 해당 레이아웃·화면 상태에 대한 판정이다. 지도 타일 인증 실패, 실제 메일 복구, 원격 데이터 저장까지 성공했다는 판정은 아니다. 작은 화면에서는 폼 전체를 세로로 스크롤해야 하며, 긴 문자열은 내용을 숨기지 않고 줄바꿈한다.

## 관찰한 문제와 수정

| ID | 심각도 | 페이지/크기와 실제 증상 | 원인 파일·규칙 | 수정/권장 조치 |
| --- | --- | --- | --- | --- |
| L01 | 높음 | 두 대시보드, 5개 크기 모두. 120자 공백 없는 이름이 환영 제목 밖으로 넘침. 375px 뷰포트에서 문서 폭 2186px; 1440px에서 2694px | `AccountPages.tsx`의 동적 제목과 `account.css` 제목에 긴 문자열 줄바꿈 없음 | `layout.css`에서 카드 제목·버튼의 안전한 줄바꿈, grid `minmax(0,1fr)`, 카드/필드 최소 폭 적용. 최종 문서 폭은 모든 크기에서 뷰포트와 동일 |
| L02 | 높음 | 공개 문의 진입, 768×1024. 제목이 고정 헤더 뒤에 가려짐. 문의 top 약155px, 헤더 bottom213px | `styles.css` `.presentation-header` sticky와 고정 155px scroll margin | 공통 헤더를 문서 흐름에 두고 앵커 여백24px 적용. 재현 브라우저에서 문의 top약24px, 헤더는 화면 밖. 회귀 테스트 추가 |
| L03 | 보통 | 공개 헤더 375/390. 높이292px로 모바일 화면의 약36% 점유. 스크롤 후에도 크게 남음 | 공개 전용 헤더의 여러 줄 도구·4개 탭과 공통 nav 배치 | 공유 `SiteHeader`에서 도구/브랜드 행과 2열 nav, 4개 탭 배치. 모바일 공개 헤더220px, 비고정. 일반 페이지153px. 탭 추가 높이는 의도적이며 공통 브랜드·nav 규칙은 동일 |
| L04 | 보통 | 가입/로그인 등 375/390/768. 반복 소개와 그림 공간 때문에 실제 폼 진입이 늦음. 375px 가입 제목 y639.5px | `account.css`의 큰 intro·소개문·단일 열 전환 | 모바일/태블릿 소개를 짧게 하고 그림·반복 설명을 숨김. 가입 폼 제목 y404.8px. 로그인 이메일 필드가 5개 크기 모두 첫 화면 안에 들어오는지 테스트 |
| L05 | 보통 | 프로듀서 대시보드 데스크톱. 네 요약이 세로로 길게 쌓이고 큰 홍보용 왼쪽 열이 작업 공간을 차지 | `.account-wide` 2열, `.producer-summary` 일반 dl | 업무 화면을 전체 폭으로 전환하고 요약을 데스크톱4열/모바일2열로 묶음. 프로필·품목 필드는 넓은 화면2열, 작은 화면1열 |
| L06 | 보통 | 생산자·구매자 소개와 품목 설명. 긴 저장 문자열이 단일 행 input 안에서만 보여 전체 검토가 어려움 | `ProducerDashboard.tsx`, `BuyerCenter.tsx`가 bio/description을 input으로 표시 | 같은 name·최대 길이·FormData를 유지하며 4행 textarea로 변경. 값 유지, 편집, 상태 select 회귀 테스트 |
| L07 | 보통 | 밝은 인증/탐색 카드의 작은 금색 eyebrow가 흐림, 전체 크기 | `.account-card .eyebrow` #bfa56b / 배경 #faf6eb | 실제 computed color 기준 대비 약2.21:1→5.61:1. 짙은 금갈색 토큰 #746033 적용. 이는 해당 문구의 측정이며 전체 사이트 WCAG 인증을 뜻하지 않음 |
| L08 | 보통 | Explore에 푸터가 없고, 브랜드·헤더 높이·좌우 시작선이 인증 페이지와 달랐음. 1366px에서 인증 본문 최대1250px, 탐색 카드1300px | `main.tsx`, `AccountPages.tsx`, `ExploreProduce.tsx`의 독립 헤더/푸터와 별도 폭 | `SiteChrome.tsx` 공통 헤더/푸터와 `layout.css` 폭1360px·가변 gutter 토큰. 5개 크기에서 공통 헤더 높이·브랜드/본문 시작선·겹침을 테스트 |
| L09 | 보통 | 문의 폼 768×1024. 좁은 소개 열에서 “requirements,”가 단어 중간과 마지막 s로 나뉨 | `.inquiry-layout` 최소240px 소개 열과 내부30px 패딩 | 900px 이하 소개/폼을 세로 배치. 5개 크기 재캡처. 태블릿 앵커 진입 테스트에서 소개 폭 최소300px도 확인 |
| L10 | 높음, 미해결 | 실제 스테이징 LOGISTICS 배경 타일에 401 Invalid Authentication 표시 | 외부 `tiles.stadiamaps.com` 제공자 인증/호스팅 도메인 설정. 정확한 설정 원인은 관리 접근 없이 단정 불가 | 이번 브라우저에서 타일 응답6개 모두 HTTP401 확인. 지도 레이어와 컨트롤은 표시되나 정상 배경 지도라고 판정하지 않음. 제공자 도메인 권한 설정 별도 확인 필요; secrets·제공자 설정은 변경하지 않음 |

치명적 레이아웃 결함은 이번 검사에서 확인되지 않았다. L01/L02의 높은 심각도는 실제 데이터/이동에서 내용이 화면 밖으로 사라지거나 가려졌기 때문이다. 버튼의 기존 primary/secondary/destructive 위계, 체크박스 동의, select 값, 탭 키보드 이동과 내비게이션은 유지했다. 공개 푸터의 기존 Back to top 이동도 공유 컴포넌트의 presentation 옵션으로 유지하고 회귀 검사했다. 라디오/체크박스 자체는20px이나 연결된 label 전체가 조작 영역이므로 자동 수집의 작은 input 수를 곧바로 터치 실패로 판정하지 않았다.

## 수정한 파일

- `src/components/SiteChrome.tsx` (신규): 실제 공유 브랜드·헤더·푸터. 공개 페이지는 언어/문의 도구 및 기존 탭을 슬롯으로 제공.
- `src/layout.css` (신규): 페이지 폭·gutter·간격·색 토큰, 공통 헤더, 반응형 폼·대시보드 요약, 긴 문자열, 탐색 카드, 문의 배치. 페이지별 임시 CSS 대신 공통 규칙을 한 파일에 둠.
- `src/main.tsx`: 공유 chrome와 레이아웃 스타일 적용. 기존 탭·언어·문의 이벤트 유지.
- `src/components/AccountPages.tsx`, `ExploreProduce.tsx`: 공유 chrome 적용. 인증 콜백과 API 로직 변경 없음.
- `src/components/ProducerDashboard.tsx`: 요약 항목 그룹, 반응형 fieldset, 소개/설명 textarea. API·소유권·검증 규칙 변경 없음.
- `src/components/BuyerCenter.tsx`: 반응형 fieldset와 소개 textarea. 데이터 처리 변경 없음.
- `src/i18n.ts`: 공개 페이지에서 공유 푸터 안내가 번역되도록 스페인어 문구 추가.
- `scripts/audit-layout.mjs` (신규): 안전한 실제 브라우저 감사 재실행 도구.
- `tests/browser/layout.spec.ts` (신규): 5개 뷰포트 × 공통 chrome/생산자/구매자 =15개 테스트.
- `UI_AUDIT.md` (이 보고서).

이 목록은 이번 감사에서 직접 변경한 파일만 나타낸다. 작업 시작 시 존재했던 많은 미커밋 파일과 앞선 인증 수정은 보존했다. Worker·DB·secrets·배포 설정을 이번 감사에서 변경하지 않았다.

## 스크린샷과 측정 위치

- 비교 색인: `.wrangler/layout-audit/index.html`.
- 수정 전 실제 스테이징 공개/비로그인: `.wrangler/layout-audit/before/`.
- 수정 전 단일 품목 상세(120자 동일 데이터·합성 API): `.wrangler/layout-audit/before-detail/`.
- 수정 전 인증 대시보드(합성 API): `.wrangler/layout-audit/before-dashboards/`.
- 수정 전 저장/빈 결과/선택 상태(합성 API): `.wrangler/layout-audit/before-states/`.
- **최종 수정 후 160개 화면과 측정**: `.wrangler/layout-audit/final/`.
- 뷰포트별 시각 검토 시트: `.wrangler/layout-audit/contact-sheets/final-{375,390,768,1366,1440}.png`.
- 앵커 가림 전후: `before/contact-anchor-768x1024.png`, `after/contact-anchor-768x1024.png`, `anchor-metrics.json`.
- 지도 실제 응답: `.wrangler/layout-audit/map-status.json`, `before/map-provider-390x844.png`.
- 파일명 규칙: `{상태}-{폭}x{높이}.png`. 업무/지도/문의는 `-viewport.png`도 저장.

예: 긴 이름 문제는 `before-dashboards/producer-long-375x812-viewport.png`와 `final/producer-long-375x812-viewport.png`를 비교한다. 모바일 가입은 `before/signup-375x812.png`와 `final/signup-375x812.png`를 비교한다. 모두 저장소 내부의 ignored 증거이며 배포 자산에 포함되지 않는다.

초기 실행에서 대시보드 fixture의 역할 누락 때문에10개 캡처가 실패했고, fixture를 고친 `before-dashboards` 실행에서 전부 성공했다. 초기 새 textarea 테스트는 Playwright의 label text 조회가 textarea 초기 텍스트를 포함해 실패했으며, 실제 접근성 트리의 textbox 이름으로 바꾸어 최종 통과했다. 최종 감사 재실행 중 한 번은 브라우저 테스트가 자신의 서버를 종료해 연결 거부가 발생했다. 독립 로컬 서버에서 다시 실행해 **final/metrics.json은160개·오류0개**로 완료했다. 로컬 공개 API는 현재 공급자 설정이 없는 상태에서 HTTP503을 반환하므로, 목록 화면이 status 대신 alert에 정착하는 경우도 기다리도록 감사 도구를 수정했다. 해당 5개 캡처를 다시 실행해 final 기록에 병합했다. 이러한 도구 실행 오류를 제품 결함으로 집계하지 않았다.

## 실제 실행한 검증

| 검증 | 결과 |
| --- | --- |
| 최종 브라우저 시각·좌표 감사 | 32상태×5크기=160개, 캡처 오류0, 문서 가로 넘침0 |
| `npm run test:browser` | **57 passed**. 기존42개 전부 유지 + 신규15개. 합성 응답 기반 데이터 검증은 원격 저장 검증이 아님 |
| `npm run test:auth` | **51 passed**, 로컬 workerd/D1·합성 제공자 포함 |
| `npm test` | **32 passed**, 공개 UI·번역·탭·지도·문의 모델 |
| `npm run test:producer` | **5 passed**, 로컬 합성 프로필·품목·관심 품목·격리 |
| `npm run check:staging` | PASS |
| `npm run test:deployment` | PASS, Node suite1개 |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS. 기존 JS 번들500kB 초과 advisory 있음 |
| `npm run dry-run:staging` | PASS, 실제 배포 아님 |
| `git diff --check` | PASS |
| 실제 이메일 링크·실사용자 데이터 저장·비밀번호 변경 | **미실행**. 이번 작업 범위는 레이아웃 감사이며 실제 사용자 데이터 변경 금지 |

## 남은 문제와 배포

- 지도 배경 제공자의 HTTP401 인증 문제는 미해결이다. API 키를 새로 넣거나 설정을 임의 변경하지 않았다.
- 인증된 합성 화면의 레이아웃 검증을 실계정 원격 CRUD/메일 검증으로 간주하지 않는다.
- 로컬 실제 `/api/public/produce`는 HTTP503이다. 로컬 설정에는 Supabase 공급자 설정이 없고, Worker는 공개 API보다 먼저 필수 설정을 검사한다. 이를 정상 목록 조회로 표시하지 않았다. 스테이징 실제 공개 화면과 합성 목록/빈 결과/오류 화면을 분리해 검사했으며, 이번 작업에서 secrets를 추가하지 않았다.
- Chromium 기준이다. 실제 iOS Safari/Android 기기, 스크린리더 전체 사용성, 사이트 전체의 WCAG 적합성 인증은 수행하지 않았다. 키보드 포커스/탭과 선택 동작, 해당 대비 측정은 수행했다.
- 매우 긴 이름·설명은 모바일에서 여러 줄/세로 스크롤을 만든다. 생략해 데이터 자체를 숨기지 않았다.
- **스테이징 재배포 필요**: 이번 수정은 로컬에만 있다. 이번 지시는 감사·수정·dry-run 및 재배포 필요 여부 보고이므로 실제 deploy는 실행하지 않았다. 운영 배포·비밀키/세션 키 변경·계정 변경·Git add/commit/push 없음.

재실행 예시(로컬 Worker가 먼저 실행되어 있어야 함):

```sh
AUDIT_ORIGIN=http://localhost:8787 \
AUDIT_OUTPUT=.wrangler/layout-audit/recheck \
LD_LIBRARY_PATH=/home/administrator/.local/share/geoai-playwright-runtime/usr/lib/x86_64-linux-gnu \
node scripts/audit-layout.mjs
```

## 감사 수정본 스테이징 배포 및 재검증 — 2026-10-22

이 절은 앞선 감사 시점의 “미배포/재배포 필요” 상태를 갱신한다. 기존 미커밋 변경을 보존하고 감사 보고서와 실제 코드·라우팅·폼 필드·인증 경계·배포 구성을 검토했다. 추가 애플리케이션 소스 수정은 필요하지 않았다. 이번 턴에서 변경한 저장소 문서는 이 배포 결과 기록뿐이다.

### 재실행한 필수 검사

- `npm run check:staging`: PASS.
- `npm run test:deployment`: PASS, Node suite 1개.
- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS. 기존 약505kB JS 번들 크기 advisory는 남아 있다.
- `npm run dry-run:staging`: PASS.
- `npm run test:browser`: PASS, **57개**. 기존 인증·폼·역할 이동·검색·탭·내비게이션과 신규 레이아웃 검사 포함. 기존 런타임 라이브러리 경로를 `LD_LIBRARY_PATH`에 지정했다.
- `npm run test:auth`: PASS, **51개**. 합성 제공자와 로컬 workerd/D1을 사용한다.
- `npm test`: PASS, **32개** 프로토타입/번역/지도/문의 모델 검사.
- `npm run test:producer`: PASS, **5개** 생산자·구매자 API 검사.
- `git diff --check`: PASS.

### 실제 배포

Cloudflare `whoami` 인증 성공 및 스테이징 설정 계정 일치를 확인했다. 저장소 `AUTH_DEPLOYMENT.md`의 기존 명령만 사용했다.

```sh
WRANGLER_SEND_METRICS=false npx wrangler deploy --config ./wrangler.staging.jsonc
```

- 대상 Worker: `jalisco-auth-staging`.
- D1 바인딩: 기존 `jalisco-auth-staging`, ID `7712d6bb-2414-44d3-9282-cb5b941d740e` 유지. 마이그레이션 없음.
- 실제 URL: https://jalisco-auth-staging.yukikato123123123.workers.dev/
- 새 배포 버전: **`f597d880-f99f-4739-b196-bf06db458eff`**.
- 배포된 JS `index-C0r7rdk8.js`와 CSS `index-DwI4-FKo.css`를 원격에서 읽어 로컬 빌드와 SHA-256 일치를 확인했다. 모두 HTTP200.

### 실제 원격 결과와 설정 문제

- 실제 공개 API `/api/public/produce`: **HTTP200**, 현재 공개 품목1개. 국가 필터 요청도 HTTP200; 공개 데이터를 수정하지 않았다.
- 비로그인 `/api/auth/session`, `/api/producer/dashboard`, `/api/buyer/dashboard`: 모두 **HTTP401**.
- 실제 공개 화면에서 검색/필터 초기화, 지도 레이어 체크 해제/복원 동작 확인. 이 브라우저 실행에서 JavaScript pageerror 없음.
- 실제 계정 로그인·CRUD·이메일 요청/복구·비밀번호 변경은 수행하지 않았다. 긴 대시보드 데이터는 API를 가로챈 합성 상태이며 원격 D1 저장 증거가 아니다.
- 실제 배포 화면에서 받은 지도 타일은 여전히 **HTTP401**. 요청의 `Origin` 및 `Referer`는 모두 부재하고 문서의 referrer 정책은 `no-referrer`다. 소스 타일 URL에는 API key가 없다. [Stadia 공식 인증 문서](https://docs.stadiamaps.com/authentication/)는 도메인 인증이 이 두 헤더로 동작하며 `no-referrer`를 401의 알려진 원인으로 설명한다. 따라서 현재 요청은 도메인 인증에 필요한 출처 정보를 제공하지 않는다는 점을 확인했다. 제공자 계정의 실제 도메인 등록/권한은 확인하지 못했다.
- 지도 후속 조치: 담당자가 Stadia Properties → Authentication Configuration에서 정확한 스테이징 호스트 `jalisco-auth-staging.yukikato123123123.workers.dev`의 허용 여부를 확인하고, 지도 요청에 한정된 출처 전달 정책을 별도 검토해야 한다. 인증 링크 보호를 위해 넣은 전역 `no-referrer`를 임의로 완화하거나 키를 추가하지 않았다. 제공자 설정 변경은 중단한 상태다.
- 공개 API **503은 로컬 환경에서 여전히 재현**된다. 실제 로컬 GET 결과는 `Authentication is not configured. Public pages remain available.`이다. `wrangler.local.jsonc`에는 `AUTH_ORIGIN`만 있고, Worker는 `/api/public/produce`에 도달하기 전에 필수 Supabase URL/key 등 설정을 검사한다. 로컬 공급자 설정 미비는 해결하지 않았으며, 스테이징 API가503이라는 의미는 아니다. 현재 스테이징에서는200이다. 향후 로컬 실연동이 필요하면 별도 승인된 로컬 전용 설정을 준비해야 한다. 이번에는 secrets를 추가/변경하지 않았다.

증거: ignored `.wrangler/layout-release/live-results.json`, `.wrangler/layout-release/screenshots/`의 PNG 및 `metrics.json`. 실제 사용자 데이터, 비밀키·세션 키, 운영 환경, 계정은 변경하지 않았다. Git stage/commit/push 없음. Safari 실제 기기, 실계정 CRUD, 실제 메일 복구는 미검증이다.

### 배포 후 화면 검사 최종 결과

현재 배포 URL에서 핵심13개 상태(landing, logistics, commercial-form, explore, login, signup, verify-email, forgot-password, reset-password, producer-dashboard, buyer-dashboard, producer-long, buyer-long)를 375×812, 390×844, 768×1024, 1366×768, 1440×900으로 검사했다. **65개 캡처/측정 성공, 오류0, 문서 가로 넘침0, 페이지 HTTP 상태는 모두200**이다. 로그인 화면·모바일 문의/메뉴·태블릿 로그인·데스크톱 지도와 긴 이름 대시보드 스크린샷을 직접 검토했다. 보호된 페이지의 HTML200은 로그인 성공을 뜻하지 않으며, 실제 보호 API401 및 접근 불가 화면을 별도로 확인했다. `producer-long`/`buyer-long`은 배포된 UI에 합성 API 응답을 연결한 표시 검사다. 실제 계정이나 원격 데이터는 생성/수정하지 않았다.

## 후속 재검증 및 재배포 시도 — 2026-10-22 (MMT)

이 절은 이번 요청의 실제 실행 결과다. 위의 성공한 배포/원격 화면 기록은 이전 실행의 증거이며, 이번 재배포 성공이나 현재 원격 상태를 보장하지 않는다.

- 기존 Git 변경 및 미추적 파일을 보존했다. 애플리케이션 소스·배포 설정 추가 수정은 없으며, 이번에 수정한 추적 대상 문서는 이 보고서뿐이다. 실행 증거는 ignored `.wrangler/release-recheck/`에 저장했다. stage/commit/push 없음.
- 공통 chrome, 폼의 name/FormData 및 textarea 값 처리, 경로/역할 이동, Worker의 인증 경계와 스테이징 전용 배포 설정을 검토했다. 검토 및 아래 테스트 범위에서 회귀는 발견하지 못했다.
- PASS: `npm run check:staging`, `npm run test:deployment` (suite 1개), `npm run lint`, `npm run typecheck`, `npm run build`, `npm run dry-run:staging`, `npm test` (32개), `npm run test:producer` (5개), `npm run test:auth` (51개), `npm run test:browser` (57개), 공급자 진단 테스트 (4개), `git diff --check`.
- 인증/브라우저 검사의 첫 샌드박스 실행은 실패했다. 로컬 workerd/서버/Chromium 실행 권한을 확보한 재실행에서 모두 통과했으며, 이 과정에서 소스 수정은 하지 않았다. 브라우저 실행에는 기존 Chromium 라이브러리 경로를 사용했다. 5개 뷰포트의 공통 레이아웃 및 긴 생산자/구매자 합성 데이터 검사가 포함된다.
- 기존 JS 번들 505.18kB advisory는 남아 있다. 빌드 실패는 아니다.
- **이번 스테이징 재배포는 차단됨.** `wrangler whoami`는 일반/승격된 실행에서 모두 인증 토큰 만료 및 Cloudflare 인증 서버 연결 실패를 보고했다. 읽기 전용 진단에서 `dash.cloudflare.com` DNS 해석 실패, 스테이징 HTTPS 연결 reset도 관찰했다. Chromium의 실제 `/login` 및 `/api/public/produce` 접근도 각각 15초 시간 초과했다. 인증 정보를 변경하거나 연결/권한을 우회하지 않았으며 deploy 명령은 실행하지 않았다.
- 대상 URL: https://jalisco-auth-staging.yukikato123123123.workers.dev/ . 이번 배포 버전은 없고, 배포 후 검증도 완료할 수 없다. 이전 기록을 이번 결과로 재사용하지 않는다.
- 지도 HTTP401: 이전 감사의 미해결 상태를 유지한다. 현재 코드에 키 없는 Stadia 타일 URL과 전역 `no-referrer`가 남아 있어 제공자 도메인 인증에 필요한 출처 전달/등록 설정 확인이 필요하다. 이번 원격 상태는 네트워크 문제로 재확인하지 못했다. 제공자 설정·키·referrer 정책은 변경하지 않았다.
- 공개 API HTTP503: 이번 로컬 GET에서 `Authentication is not configured. Public pages remain available.` 및 HTTP503을 재현했다. 로컬 공급자 설정 누락과 Worker의 API 선행 설정 검사에 따른 별도 미해결 문제다. 현재 스테이징 API 상태는 확인 불가이며, 이전의 원격200을 이번 결과로 주장하지 않는다. secrets 추가/변경 없음.
- 다음 조치: 실행 환경의 DNS/HTTPS 연결을 복구하고, 필요하면 소유자가 기존 Cloudflare 인증을 갱신한 뒤 `whoami` 계정 일치를 재확인한다. 검사/빌드 상태를 재확인하고 기존 명령 `WRANGLER_SEND_METRICS=false npx wrangler deploy --config ./wrangler.staging.jsonc`만 사용하여 스테이징에 배포한 다음 실제 URL을 재검사해야 한다. 지도 도메인 권한/출처 정책과 로컬 전용 공급자 설정은 담당자의 별도 검토가 필요하다.
- 운영 배포·원격 DB 마이그레이션·실계정 CRUD·이메일 발송/복구·비밀번호 변경·실제 사용자 데이터/세션 키 수정·계정 삭제는 실행하지 않았다. Safari 실기기도 미검증이다.

## 전체 사이트 디자인 확장 — 2026-10-22 (MMT)

이번 절은 농장.zip/대면.zip을 첨부한 후속 요청의 결과다. 공개·계정·업무 화면 개선과 로컬 검증을 수행했다. **전체 완료 및 원격 배포 완료 상태는 아니다.** 구매자 공개 동의 모델, 관리자 권한 정책과 관리 기능, 실제 원격 데이터 검증, 스테이징 재배포가 남아 있다. 앞선 배포 성공 기록을 이번 결과로 재사용하지 않는다.

### 입력과 사진 사용

농장 ZIP의 실제 JPEG 3장과 대면 ZIP의 스크린샷 8장을 추출해 직접 확인했다. 첨부 이미지는 참고 자료로 사용했으며 별도의 실행 지시로 취급하지 않았다. 제공된 세 사진을 바이트 단위로 그대로 보존했고 임의 사진/생성 이미지를 사용하지 않았다.

| 원본 사진 | 실제 사용 위치 |
| --- | --- |
| 2026-10-13 1.49.58 PM | `public/images/el-grullo-farm.jpeg`: 홈페이지 농장 사진 히어로 |
| 2026-10-19 10.36.40 AM | `public/images/nopal-harvest.jpeg`: Explore의 수확물 소개, `/producers/field-notes`의 수확 사진 |
| 2026-10-21 12.57.46 PM | `public/images/el-grullo-fields.jpeg`: 홈페이지 산지 소개, 생산자 목록의 농장 이야기, 농장 이야기 상세, 데스크톱 인증 화면의 소개 사진 |

공개 상품 레코드에는 사진 연결 정보가 없다. 따라서 제공 사진을 임의 생산자의 상품 재고 사진으로 연결하지 않았다. 수확 사진은 편집 소개 이미지임을 표시했으며, 포장 규격·재고·수출 적격성을 사진으로 입증하지 않는다.

### 이번에 수정/추가한 파일과 동작

기존 미커밋 변경을 보존했다. 아래는 이번 디자인 요청에서 직접 수정한 범위다. 기존의 다른 변경 파일과 새 파일은 그대로 두었다.

- `src/main.tsx`: 사진 히어로, 기존 브랜드 메시지와 CTA, 산지 이야기, Logistics 설명 분리. 기존 네 탭/언어/문의/지도/보고 수치를 유지했다. 최초 해시 및 같은 문서 내 해시 변경으로 문의·문서 등 기존 탭을 열도록 보완했다.
- `src/platform.css` (신규): 기존 숲 녹색·크림·금색과 세리프를 이어가는 레이아웃. 반응형 히어로/디렉터리/상품 검색/업무 목록, Commercial의 데스크톱 행 배치, 지도 실패 배경, 링크 대비 보완. 기존 `styles.css`, `layout.css`, `account.css`를 통째로 교체하지 않았다.
- `src/components/FarmStory.tsx`, `DirectoryPage.tsx`, `AdminPage.tsx` (신규): 농장 소개, 공개 디렉터리 및 관리자 접근 불가 화면.
- `src/components/SiteNav.tsx`: 공개 Producers/Buyers 연결 추가. 기존 업무 공간·계정 진입 유지.
- `src/components/ExploreProduce.tsx`: 수확 소개 사진, 공개 생산자 연결, 허용된 이메일 문의 링크, 오류 재시도, 기존 `?id=...` 상세 disclosure 열기. 기존 검색·필터·페이지 이동·저장 버튼 유지.
- `src/components/ProducerDashboard.tsx`, `BuyerCenter.tsx`: 기존 데이터 내 검색, 생산자 게시 상태 필터, 역할별 섹션 내비게이션, 작업 목록 배치, 오류 중 잘못 남는 로딩 문구 보완. 기존 저장/수정/삭제/관심 품목 기능 유지.
- `src/components/AccountPages.tsx`: 소개 그림을 제공 사진으로 변경. Supabase 콜백·복구·인증 처리 변경 없음.
- `src/components/MarketMap.tsx`: 타일 실패 시 오류 타일을 숨기고 중립 격자 배경/설명 제공. GIS 벡터·레이어·줌·포커스 기능 유지. 키나 전역 referrer 정책 변경 없음.
- `src/presentation.ts`, `src/i18n.ts`: 공개 섹션 최초 해시 선택과 새 공개 소개 문구의 스페인어 번역.
- `worker/directory.ts` (신규), `worker/index.ts`: 공개 생산자 쿼리, 비공개 구매자 정보 비노출, `/api/admin` 및 하위 API 접근 차단. 명시적 공개 GET만 인증 공급자 설정 검사에서 분리했다. 인증·복구·역할·소유권·세션 키 경계는 유지했다.
- `tests/directory.test.mjs`, `tests/browser/platform.spec.ts` (신규), `tests/presentation.test.mjs`, `tests/charts.test.mjs`, `tests/gis.test.mjs`: 디렉터리·프라이버시·관리자 거부·사진·반응형·지도 실패·직접 링크·업무 검색 검사. 기존 테스트를 삭제하지 않았다. 초기 탭의 정확한 소스 문자열을 검사하던 두 assertion은 기본 탭 선택 함수의 결과 검사로 바꾸고 실제 브라우저의 해시 이동 검사를 추가했다.
- `package.json`: `test:directory`만 추가. 기존 스크립트 변경분 보존.
- `public/images/` JPEG 3개 및 이 `UI_AUDIT.md` 기록.

### 페이지와 실제 데이터 경계

- `/producers`: 공개 상품을 게시한 생산자만 기존 D1 테이블에서 조회한다. 회사/생산자명으로 이미 공개된 회사 표시명과 품목을 검색하고 국가·지역 필터/페이지 이동을 지원한다. 개인 계정 이름, 공급자 사용자 ID, 비공개 상품은 반환하지 않는다. 지원하지 않는 수출 준비 필터·검증 배지·예측 수치는 만들지 않았다.
- `/producers/:publicItemId`: 현재 공개 상품 ID로 생산자와 그 생산자의 공개 품목/물량/가용성 상세를 조회한다. 연락처는 기존 `public_contact`가 허용한 필드만 표시한다. 해당 상품을 비공개/삭제하면 그 링크로 사적인 프로필을 조회할 수 없다. 디렉터리 ID는 공개 상품에 의존하므로 그 상품이 사라진 링크는 더 이상 유효하지 않을 수 있다.
- `/producers/field-notes`: 제공 사진을 사용하는 편집 산지 소개다. 실시간 재고/검증된 공급자 레코드와 구별한다.
- `/buyers`: 독립적인 구매 목적 소개·회사/시장 검색 UI·빈 상태와 비공개 정책을 제공한다. **현재 스키마에 구매자 공개 동의/공개 관심 품목 필드가 없으므로 공개 API는 빈 목록만 반환한다.** 기존 `buyer_profiles`, 관심 품목, 연락처를 임의로 공개하지 않았다. 실제 회사 검색·공개 상세·생산자 연결 데이터 기능은 미완료다. `/buyers/:id`는 공개 프로필 없음 상태를 제공하며 사적 계정을 조회하지 않는다.
- `/admin`: **관리자 관리 기능 미구현/차단 상태.** 기존 역할 제약은 producer/buyer뿐이고 승인된 운영자 grant 원천이 없다. 사용자 metadata 또는 app_metadata의 `admin` 주장만으로 권한을 부여하지 않는다. 실제 계정/상품/문의 목록·계정 상태 변경·위험 작업은 제공하지 않는다. 관리자 자격 설정·철회·감사 정책이 확정된 뒤 별도 구현이 필요하다.
- 저장소 구조는 Supabase Auth + 서버 전용 D1이다. 상품/프로필은 Supabase DB/RLS를 직접 사용하는 구조가 아니다. D1의 서버 쿼리와 기존 역할·소유권 검사를 검토했다. 실제 Supabase 관리 콘솔/RLS 정책은 접근할 수 없어 확인했다고 주장하지 않는다. 새로운 Supabase 키·서비스 역할 키·정책 변경 없음.
- 주문·결제·물류 추적과 서버 문의 저장은 기존에도 없었다. 기존 문의는 로컬 미리보기로 유지하며 이메일 전송/실제 주문 처리를 완료했다고 표시하지 않는다.

### 최종 검사 결과

| 명령/검사 | 최종 결과 |
| --- | --- |
| `npm run check:staging` | PASS |
| `npm run test:deployment` | PASS, Node suite 1개 |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS, frontend/Worker |
| `npm run build` | PASS, JS 번들 약520kB advisory 유지 |
| `npm run dry-run:staging` | PASS, 최종 빌드로 포장만 수행; 배포 아님 |
| `npm test` | PASS, 33개 |
| `npm run test:auth` | PASS, 51개; 로컬 workerd/D1 및 합성 제공자 |
| `npm run test:producer` | PASS, 5개 |
| `npm run test:directory` | PASS, 4개; 공개 검색/상세, 비공개 필드, 구매자 비노출, 관리자 접근 거부 |
| `node --experimental-strip-types --test tests/provider-diagnostics.test.mjs tests/directory.test.mjs` | PASS, 8개 |
| `npm run test:browser` | PASS, 69개, 기존 57개 유지 + 신규 12개 |
| `git diff --check` | PASS |
| 기존 레이아웃 감사 도구 | PASS, 32상태×5크기=160개, 캡처 오류0, 문서 가로 넘침0 |

뷰포트: 375×812, 390×844, 768×1024, 1366×768, 1440×900. 새 브라우저 검사는 신규 페이지·상세·농장 소개·구매자 빈 상태·관리자 거부의 스크린샷과 이미지 로드, JavaScript pageerror 부재를 검사한다. 모바일/태블릿 히어로 단일 열과 첫 화면 CTA도 확인했다. 기존 감사 도구는 인증 화면, 120자 이름, 긴 설명, 로딩·빈 결과·오류·성공/저장 중 합성 상태를 포함한다. 주요 모바일/태블릿/데스크톱 및 긴 문자열 화면을 직접 열어 검토했다. 합성 인증 화면은 실계정 성공 증거가 아니다.

개발 중 모바일 히어로 열 배치, CTA 대비, 해시만 바뀌는 문의/탭 이동을 발견해 보완했다. 새 문구의 번역 누락과 기존 초기 상태 소스 문자열 검사를 조정한 뒤 프로토타입 전체가 통과했다. 추가 select 필터 테스트의 label text 조회 실패는 실제 접근성 combobox 이름 조회로 수정했다. 최종 결과에 실패를 숨기거나 최초 실패를 성공으로 집계하지 않았다.

증거는 ignored `.wrangler/design-release/`에 있다: 명령별 로그, `layout/metrics.json`, 기존 감사 PNG 160개, 신규 화면 `screenshots/` (모바일 첫 화면/새 디렉터리/지도 실패 포함), 원격 접속 시도 `live-access.json`.

### 지도 401 / 공개 API 503 조사

지도 공급자 401의 실제 설정 문제는 미해결이다. 키 없는 Stadia URL과 전역 `no-referrer`를 유지했다. 공급자 도메인 등록과 지도 요청의 출처 전달 정책은 담당자의 별도 검토가 필요하다. 이번에는 타일 HTTP401을 합성한 브라우저 테스트에서 중립 배경으로 전환되고 레이어 체크/복원이 유지됨을 검증했다. 원격 네트워크가 차단되어 실제 공급자의 현재 HTTP 상태를 확인하지 못했으며, 제공자 인증이 해결됐다고 주장하지 않는다.

기본 로컬 `/api/public/produce`와 `/api/public/producers`는 여전히503이다. 인증 설정에 불필요하게 의존하던 공개 GET 경로를 분리한 다음에도503이 남아, 로컬 테이블 이름만 읽어 확인했다. 기존 `.wrangler/state/v3/d1`에는 `profiles`, `sessions`, `auth_limits` 등만 있고 `producer_items`/`producer_profiles`/`buyer_profiles`가 없다. 기존 로컬 DB의 마이그레이션·데이터를 변경하지 않았다.

대신 새 `.wrangler/design-release/disposable-state`에만 기존0001~0005 마이그레이션을 적용했다. 그 상태를 명시한 로컬 workerd에서 공급자 URL/key나 세션 키 없이 실제 GET을 확인했다:

- `/api/public/produce`: HTTP200, items0.
- `/api/public/producers`: HTTP200, items0.
- `/api/public/buyers`: HTTP200, items0, publication unavailable.
- `/api/auth/session`: HTTP503, 인증 공급자 미설정 상태 그대로 차단.

이 결과는 정상 스키마에서 공개 읽기 의존성 보완이 동작한다는 증거다. 기본 로컬 DB 또는 현재 원격503이 모두 해결됐다는 의미는 아니다. 공개 검색/상세의 실제 데이터 결과는 별도 disposable SQLite fixture로 검증했다. 데이터가 없는 임시 DB에서200을 받았다고 실계정/원격 공급 데이터가 검증된 것으로 취급하지 않는다. 증거: `local-api.json`, `disposable-api.json`, `disposable-migrations.log`.

### 스테이징 배포와 필요한 후속 조치

대상 URL은 https://jalisco-auth-staging.yukikato123123123.workers.dev/ 이다. **이번 배포는 실행하지 못했다.** `wrangler whoami`가 기존 토큰 만료 및 Cloudflare 인증 서버 연결 실패를 보고했다. Chromium에서 `/`, `/login`, `/api/public/produce`, `/api/public/producers`에 GET만 시도했으나 timeout/connection reset이었다. 새 원격 버전·배포 후 화면·원격 공개 API 정상 응답은 확인할 수 없다.

1. 실행 환경의 DNS/HTTPS 연결 복구 후 소유자가 필요한 경우 기존 Cloudflare 인증을 갱신하고, `whoami`의 계정과 스테이징 설정 일치를 확인한다. 설정·secrets를 임의로 대체하지 않는다.
2. 현재 원격 스키마 및 기존 마이그레이션 적용 여부를 허용된 읽기 전용 범위에서 확인한다. 기본 로컬 DB는 보유 데이터/세션 영향 검토 없이 마이그레이션하지 않는다. 이번 임시 DB 결과를 원격 스키마 검증으로 대체하지 않는다.
3. 기존 필수 검사 상태를 확인한 후 기존 명령 `WRANGLER_SEND_METRICS=false npx wrangler deploy --config ./wrangler.staging.jsonc`로 스테이징에만 배포하고 실제 페이지·사진·검색·역할 접근을 재검증한다.
4. 구매자 공개 동의/노출 필드·관심 품목 모델과 운영자 권한 부여/철회·감사 정책을 먼저 확정한다. 그 정책에 따른 공개 Buyer 상세 및 관리자 관리 기능을 구현·검증해야 전체 완료로 볼 수 있다.
5. 지도 담당자가 정확한 스테이징 호스트 허용과 출처 정책을 검토한다. 전체 인증 링크 보호 정책을 임의로 완화하지 않는다.

운영 배포, 원격 DB 마이그레이션, secrets/세션 키/실제 사용자 데이터 변경, 계정/거래 데이터 삭제, Git stage/commit/push 없음. 실계정 CRUD, 실제 가입·로그인·이메일 복구, Safari 실기기, 전체 접근성 적합성은 미검증이다.

## 미완료 항목 후속 작업 — 2026-10-22: 실행 전 마이그레이션 계획

기준선은 이전 디자인 검증(브라우저69, 인증51, 프로토타입33, 생산자 API5, 디렉터리4 PASS)이다. 디자인을 재작성하지 않는다. Cloudflare 인증 복구 후 실제 `whoami` 계정의 Account ID가 `wrangler.staging.jsonc`와 일치함을 확인했고, check:staging 및 최초 dry-run이 통과했다. 토큰 값은 읽거나 기록하지 않았다.

읽기 전용 실제 스테이징 D1 스키마·원장을 확인한 결과0001~0005가 적용되어 있다. 임시 DB 결과로 대체하지 않았다. 기본 로컬 DB 원장에는0001/0002만 있다.

- 새0006은 `buyer_publications` 테이블과 인덱스만 추가한다. 기존 buyer_profiles/연락처/관심 품목의 backfill은 없다. 공개 레코드는 본인의 정상 buyer 세션이 동의 notice v1에 명시적으로 동의할 때만 작성한다. 기존 모든 계정은 계속 비공개다. 개인정보/계약/내부 문의용 필드는 이 테이블 및 공개 API에 없다.
- 로컬에는 기존0004/0005와 신규0006만 적용한다. `.wrangler/completion-release/local-public-migrations.jsonc`는 기존 로컬 DB 이름/UUID와 절대 persist 경로를 그대로 사용하고, 검토한 세 SQL만 복사한 별도 migrations_dir를 지정한다. 이는 임시 DB를 성공으로 표시하는 방식이 아니라 기본 로컬 DB의 누락된 공개 데이터 테이블을 추가하는 작업이다.
- 기존 세션을 무효화할 수 있는0003은 기본 로컬 DB에 적용하지 않는다. 해당 DB의 profiles/sessions/auth_limits 행 및 관계를 수정하지 않는다. 마이그레이션 전후 기존 테이블 행 수와 스키마를 비교한다. 기본 로컬의 인증용0003은 계속 미적용이며, 로컬 인증 공급자 설정도 이번에 추가하지 않는다.
- 원격은 기존 스테이징 DB `7712d6bb-2414-44d3-9282-cb5b941d740e`의0006만 추가한다. 기존 데이터·세션을 수정하는 SQL은 없다. 모든 필수 검사가 통과한 뒤 기존 staging migration 명령을 사용하고 원장/새 스키마를 재확인한다. 원격에 예상하지 못한 pending migration 또는 스키마가 나타나면 중단한다.
- 운영 DB/설정은 사용하지 않는다. DROP/DELETE/기존 테이블 ALTER/사용자 상태 변경/키 교체는 수행하지 않는다. 문제가 생겨도 새 테이블을 DROP하는 rollback을 하지 않고 공개 기능을 비노출 상태로 유지한다.

관리자 권한은 기존 신뢰할 운영자 grant 원천이 여전히 없어 임의 부여하지 않는다. 현재 Supabase Auth + 서버 전용 D1 구조를 유지하고 조작된 user/app metadata의 관리자 주장을 계속 거부한다. 관리자 관리 기능은 소유자가 운영자 지정/철회/재인증/감사 정책을 승인한 뒤 구현해야 한다.

## 미완료 항목 후속 작업 — 2026-10-22: 최종 실행 결과

앞선 차단 상태를 이 절의 실제 결과로 갱신한다. 기존 디자인·Git 변경·secrets를 보존했다. 이번 단계는 Buyer 동의 기능, 기본 로컬 D1 복구, 스테이징0006 적용 및 재배포에 한정했다.

### Cloudflare 인증과 배포

사용자의 인증 갱신 후 같은 환경의 `getent hosts api.cloudflare.com`과 `wrangler whoami`가 성공했다. 계정 ID는 기존 staging config와 일치했다. 인증 정보 값은 출력하거나 저장소에 기록하지 않았다. 스테이징 Worker/D1 이름·UUID·origin은 변경하지 않았다.

최초 배포는 자산 업로드 중 실패했다. CLI 원문은 `Asset upload failed. Retrying... 5 of 5 attempts.` 및 `fetch failed`였다. Wrangler 로그에서 비밀값 없이 추출한 오류 코드는 `EAI_AGAIN`, `UND_ERR_CONNECT_TIMEOUT`이다. 인증된 D1 조회/마이그레이션은 성공했으므로 이 실패를 배포 권한 거부로 판단하지 않았다. 직후 DNS/HTTPS 연결이 회복된 것을 확인하고 **한 번만** 재배포를 시도했다.

기존 명령:

```sh
WRANGLER_SEND_METRICS=false npx wrangler deploy --config ./wrangler.staging.jsonc
```

재시도 결과는 **성공**이다. 자산6개가 업로드되고 `Uploaded jalisco-auth-staging`, `Deployed jalisco-auth-staging triggers`가 출력되었다.

- 실제 배포 URL: https://jalisco-auth-staging.yukikato123123123.workers.dev/
- 배포 버전: `1b7ba0ba-ac63-4f16-b8c0-eb457f0c70e2`.
- 운영 배포 없음. 계정 재생성·키 교체·다른 호스트/계정/프록시를 통한 우회 없음.
- 증거: `.wrangler/completion-release/deploy.log`, `deploy-retry.log`, `deploy-network-causes.json`.

### 실제 D1 스키마와503

스테이징은 실제 원격 스키마와 `d1_migrations`를 읽어0001~0005 적용을 확인한 뒤, 기존 명령 `wrangler d1 migrations apply DB --remote --config ./wrangler.staging.jsonc`로 **0006 하나만** 적용했다. 원장은0001~0006이며 기존 profiles/sessions/producer_items/buyer_profiles/buyer_saved_items의 마이그레이션 전후 행 수가 일치했다. 기존 데이터의 수정/공개 backfill은 없다.

기본 로컬 DB에는 계획대로0004/0005/0006을 추가했다. 실제 프로젝트의 `.wrangler/state/v3/d1`을 사용했고 기존 profiles/sessions/auth_limits의 행 수가 유지됐다. 세션을 무효화할 수 있는0003은 기본 로컬에 여전히 미적용이다. 기존 `npm run dev:worker`로 실행한 뒤 실제 GET 결과:

| API | 기본 로컬 | 실제 스테이징 배포 직후 |
| --- | --- | --- |
| `/api/public/produce` | 200, items0 | 200, items1 |
| `/api/public/producers` | 200, items0 | 200, items1 |
| `/api/public/buyers` | 200, items0 | 200, items0 |
| `/api/auth/session` | 503, 로컬 인증 공급자 미설정 | 401, 비로그인 |
| producer/buyer dashboard 및 admin overview | 실계정 미검증 | 401, 비로그인 |

**공개 API의 로컬503은 해결됐다.** 임시 DB 성공을 기본 로컬/실제 스테이징 성공으로 대체하지 않았다. 로컬 인증 API503은 별개이며 공급자 설정/0003은 이번에 변경하지 않았다. 원격 API200은 배포 직후의 실제 결과이며 이후 네트워크 오류 기간까지 정상 가용성을 보장하는 주장이 아니다.

### Buyer 공개 동의 기능

신규 `migrations/0006_buyer_publication.sql`은 공개용 snapshot을 위한 별도 테이블/인덱스만 만든다. 기존 비공개 buyer_profiles나 saved items를 복사하지 않는다. 새 테이블에는 개인 이메일·전화·문의·계약 필드가 없다.

- 본인의 정상 buyer 세션만 `/api/buyer/publication`에 쓸 수 있다. 소유자 ID는 서버 세션에서 얻는다. 클라이언트의 user_id/public_id 지정은 권한 근거로 사용하지 않는다.
- 게시·갱신마다 `publish:true`, `explicit_consent:true`, `consent_version:'buyer-directory-v1'`가 필요하다. 동의 시각은 서버가 기록한다. DB도 게시 상태에 유효한 동의 버전/시각과 미철회를 요구한다.
- 공개 해제는 본인 레코드만 published0 및 철회 시각으로 갱신한다. 목록/검색/직접 상세 URL에서 즉시 제외된다. 재게시에는 다시 명시적 동의가 필요하다.
- Buyer Center에는 비공개 회사 프로필과 별도의 빈 공개 입력 폼, 동의 체크박스, 공개/갱신/해제 및 공개 프로필 연결이 있다. 비공개 소개/연락처를 자동 입력하지 않는다.
- `/buyers`는 회사/국가/시장/관심 품목 검색과 필터, 페이지 이동, `/buyers/:publicId` 상세를 지원한다. 공개 응답은 회사·국가·지역·시장·관심 품목·공개 소개·독립 공개 ID의 allowlist뿐이다. 생산자 탐색 연결은 실제 producer 검색으로 이동하며 메시지를 보냈다고 표시하지 않는다.
- 실제 구매자/가짜 회사를 만들거나 기존 구매자를 공개하지 않았다. 현재 원격 공개 구매자는0개다. 실제 계정의 게시/철회는 수행하지 않았고 자동화된 합성 계정 테스트로 검증했다.

이번 직접 수정 파일: `worker/buyer.ts`, `worker/directory.ts`, `worker/index.ts`, `src/components/BuyerCenter.tsx`, `DirectoryPage.tsx`, 신규 `BuyerPublication.tsx`, `BuyerDirectoryEntry.tsx`, 신규0006, 테스트 fixture의 마이그레이션 목록, `tests/directory.test.mjs`, 신규 `tests/browser/buyer-publication.spec.ts`, 이 문서. 기존 디자인 CSS·사진·전체 레이아웃은 재작성하지 않았다.

### 관리자 권한

기존 관리자 거부 정책과 테스트를 유지했다. 일반/구매자/복구 세션 및 user_metadata/app_metadata의 admin 주장은 권한을 얻지 못한다. Cloudflare 배포 계정 소유권을 애플리케이션 관리자 권한으로 간주하지 않았다. 실제 Supabase 관리 콘솔/RLS 정책 접근은 없었으며, 앱 데이터는 서버 전용 D1이므로 Supabase DB RLS로 관리되는 구조가 아니다.

관리자 계정·상품·문의 관리 및 계정 상태 변경은 **여전히 미구현/차단**이다. 소유자가 신뢰할 Supabase issuer/user ID, 운영자 부여·철회 방식, 허용 작업 범위, 재인증과 감사 정책을 확정해야 한다. 일반 가입으로 admin 역할을 만드는 경로·권한 부여용 기본 계정·임의 grant/secrets는 추가하지 않았다. 서버 문의 저장 기능도 기존에 없으므로 실제 문의 관리를 구현했다고 주장하지 않는다.

### 최종 필수 검사

| 검사 | 결과 |
| --- | --- |
| `npm run check:staging` | PASS |
| `npm run test:deployment` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; JS526.81kB advisory 유지 |
| `npm run dry-run:staging` | PASS; 최종 코드/빌드 포장 |
| `npm test` | PASS, 33개 |
| `npm run test:auth` | PASS, 51개 |
| `npm run test:producer` | PASS, 5개 |
| `npm run test:directory` | PASS, 7개 |
| `npm run test:browser` | PASS, 75개; 기존69 + Buyer6 |
| 공급자 진단 테스트 | PASS, 4개 |
| `git diff --check` | PASS |

새 테스트는 동의 없는 기존 계정 비공개, 잘못된 동의 버전·미체크 거부, 철회/재동의, 본인 소유권, 비공개 프로필 갱신과 공개 snapshot 분리, 공개 필드 allowlist, 검색·필터·상세, 5개 뷰포트의 긴 공개 회사명/소개 및 브라우저 게시·철회 흐름을 검증한다. 로컬 테스트는 실제 계정 원격 CRUD의 증거가 아니다.

### 배포 후 실제 브라우저와 제한

배포 직후 실제 API 응답은 위 표와 같다. 원격 JS `index-queWNt8d.js`, CSS `index-MYWA4eTr.css`와 농장 JPEG3개는 모두HTTP200이며 로컬 빌드와 SHA-256이 일치했다. Chromium의 실제 모바일 로그인 폼을 직접 확인했다. 지도 공급자의 실제 타일HTTP401도 확인됐다.

다만 **원격 전체 브라우저 검증은 PASS로 판정하지 않는다.** 첫 검사70개 페이지/뷰포트 조합 중 홈페이지1366 요청 하나가25초 시간 초과했고, 일부 스크린샷은 데이터·이미지가 로딩 중이었다. 그 결과는 `live-initial-results.json` / `live-initial-summary.json`에 보존했다. 이를 정상 목록/사진 검증 성공으로 집계하지 않는다.

API 결과와 이미지 디코딩 완료를 기다리도록 감사 도구를 보완해 한 차례 재확인했지만, 375/390의28개 시도에서 timeout/reset/DNS 오류가 연속 재발했다. 원문에는 다음이 포함된다:

```text
page.goto: net::ERR_CONNECTION_RESET at https://jalisco-auth-staging.yukikato123123123.workers.dev/login
page.goto: net::ERR_NAME_NOT_RESOLVED at https://jalisco-auth-staging.yukikato123123123.workers.dev/forgot-password
page.goto: net::ERR_TIMED_OUT at https://jalisco-auth-staging.yukikato123123123.workers.dev/
locator.waitFor: Timeout 20000ms exceeded.
```

재확인은 중단했고 재배포를 더 반복하지 않았다. 추가 연결 진단 명령은 자동 권한 검토가 제한 시간 내 완료되지 않아 실행되지 않았다. 이를 권한이 없다는 확정 판단으로 해석하지 않으며 우회하지 않았다. 증거는 `live-results.json`, `live-recheck-blocked.json`, `live-smoke-final.log`에 있다.

지도401의 제공자 인증 설정은 미해결이다. 로컬 합성401 테스트에서는 대체 배경과 GIS 조작이 통과했지만 실제 원격 대체 상태의 최종 확인은 네트워크 불안정으로 완료하지 못했다. 전역 no-referrer·지도 키·제공자 도메인 설정은 변경하지 않았다.

필요한 후속 조치는 네트워크 안정화 후 현재 배포 URL의 공개 목록·사진·로그인·보호 화면을 다시 확인하는 것이다. 배포 자체는 이미 성공했으므로 단순 검증을 위해 또 배포할 필요는 없다. 실제 정상/구매자/관리자 계정 CRUD·게시/철회·실제 이메일 복구·비밀번호 변경·Safari 실기기 검증은 미실행이다. secrets/세션 키/운영 데이터/실제 사용자 행 변경·계정 삭제·Git stage/commit/push 없음.

## Complete redesign and secure operations — 2026-10-22

- Preserved the dirty `feature/secure-authentication` checkout and all existing
  untracked work. Fetched `origin/main` without merging; main is `4160e8b`, branch
  is two commits ahead before this task's uncommitted edits. No commit/push.
- New `/` Home has supplied El Grullo farm imagery, preserved brand wording,
  EN/ES selection, discovery paths and next steps. Supplied photos remain in the
  existing editorial/profile views. No relevant supplied ZIP assets were found.
- Navigation adds Home, Logistics, Commercial and Readiness while retaining
  account/workspace links. Existing presentation hashes remain supported.
- `/logistics` gives explicit planning stages and the existing illustrative map
  with tile-failure fallback. `/commercial` reads published product specifications,
  quantities and optional asking prices. `/readiness` reads the signed-in producer
  workspace and separates completeness from verification. Unsupported documents,
  packaging, shipments and negotiated terms are never fabricated.
- Existing Explore Produce, producer/buyer directories and account/workspace forms
  retain their shared design system, search, paging, privacy and state handling.
  Producer editorial content is labeled separately from actual directory records.
- Admin sections inspect actual records, with search, status filters, pagination,
  expandable details, confirmation/reason for changes and append-only audit.
  Authorization and bootstrap limitations are documented in AUTHENTICATION.md.
- Staging D1 read-only evidence: 3 producer account records, 3 producer profiles,
  2 producers with no product records, 1 public product owned by 1 producer,
  1 eligible directory producer. The public staging API returned 1 distinct
  producer. El Grullo is a static editorial story, not an account record.
  No missing products were invented or auto-published. Three eligible producers
  are tested with distinct database fixtures; this is not a claim of 3 live listings.
- Local checks: typecheck, lint, build, staging config validation and deployment
  dry-run passed. Node regression tests: 182 passed, including real workerd/D1.
  Chromium tests: 80 passed using existing geoai-playwright-runtime libraries.
  Initial restricted-socket and missing-library runs failed; these were resolved
  through the existing runtime and appropriate execution permissions.
- Browser checks cover 375/390/768/1366/1440 widths, public/account routes, filters,
  three eligible records at the database boundary, buyer consent/revocation,
  access denial, confirmation UI, localization persistence and no page overflow.
  Browser API/tile stubs are contract tests, not live provider or map availability.
- Build has a non-failing JS chunk-size warning (~545 kB uncompressed). Browser
  bundle scan found no session key, publishable-key variable, service-role marker
  or staging Supabase project URL.
- Actual recovery email reception, SMTP settings and real signed-in admin access
  remain unverified: no test mailbox/provider management connection or approved
  admin identity was supplied. The owner explicitly requested no automatic grants.

### Staging release evidence

- Applied only additive `0007_admin_operations.sql` to the verified staging D1
  `7712d6bb-2414-44d3-9282-cb5b941d740e`. No existing business rows changed.
- Deployed Worker version `fb1fbdac-6439-4b2c-ac68-6a5b002d20d4` to
  https://jalisco-auth-staging.yukikato123123123.workers.dev/ . Production config,
  resources, credentials, Git commits and remote branches were not changed.
- Live HTTP checks: **43 PASS**. HTML and referenced JS/CSS SHA-256 values match
  the local build. Public routes and farm images return 200. Public APIs return
  1 producer, 1 product, 0 buyers. Anonymous session/workspace/admin APIs return
  401, invalid-Origin login/admin writes return 403, and invalid authentication
  inputs return 400 without contacting email delivery.
- Live Chromium (no API interception): **30 PASS**, 15 routes at 375 and 1440 px.
  Home renders its new hero, producer directory renders the single eligible
  producer, admin shows sign-in denial, and no tested route has horizontal
  page overflow or JavaScript page errors. Screenshots and machine-readable
  results are in ignored `.wrangler/redesign/`; repeatable read-only verification
  scripts are `scripts/verify-redesign-{staging,browser}.mjs`.
- Post-deployment D1: 0 administrator grants, 0 administrative actions, 3 producer
  accounts, 3 producer profiles, 1 public product. No automatic grant was made.
- Final lint and whitespace checks pass, including the new verification scripts.

| Required check | Result | Evidence / limit |
| --- | --- | --- |
| New root Home | PASS | Local browser and live mobile/desktop rendered hero |
| Public/account navigation | PASS | 80 browser tests; live 15 routes at two sizes |
| Three distinct eligible producers | PASS locally | SQLite fixtures return 3 distinct records; live has only 1 eligible |
| Missing/private profiles, revoked consent, empty states | PASS | Directory/privacy/database and browser tests |
| Product search and category/origin filters | PASS | Queries execute against seeded database records; browser form coverage |
| Anonymous and ordinary-user admin denial | PASS | Worker tests; live anonymous 401 on all 7 admin sections |
| Metadata spoofing | PASS | Provider metadata cannot replace server-only grant |
| Configured trusted admin | PASS locally / BLOCKED live | Synthetic trusted grant tested; owner requested no automatic grants |
| Buyer consent/privacy | PASS | Explicit consent, revocation, owner-bound writes and public projections |
| Login/signup/recovery/workspaces | PASS contracts / BLOCKED real mail | Worker, workerd/D1 and browser regressions; no verified mailbox/provider management |
| Mobile/tablet/desktop overflow | PASS | 375/390/768/1366/1440 local; 375/1440 live |
| Tests/lint/types/build/config/dry-run | PASS | 182 Node tests, 80 browser tests, final lint/typecheck/build and staging dry-run |

External remaining prerequisites: separately approved administrator identity if the
owner later wants to activate privileged access; authenticated Supabase settings
and test-mailbox access to verify real email recovery, SMTP and provider settings.
There are no stored inquiry, shipment, document or product-image records, so the
console accurately reports unavailable workflows. Specification edits remain in
the producer workspace; administrative product actions currently manage visibility.
No claim of live login, mail receipt, authenticated admin success, real map service
availability, or three public producer listings is made.
