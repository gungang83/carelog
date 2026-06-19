# Carelog 프로젝트 상태

> **제품 정체성(SSOT)**: Carelog는 **환자 전용 서비스가 아니다.** 의료기관 상담 기록(B2B) ↔ 환자 평생 보관·생애주기 건강관리(B2C)를 잇는 **연결고리**. 상세: [docs/product-vision.md](docs/product-vision.md)

**최종 업데이트**: 2026-06-19 (세션 27 — SSO 로그인 성능 핫픽스)
**현재 버전**: main 브랜치

---

## 구현 완료 기능

| 기능 | 상태 | 비고 |
|---|---|---|
| 환자 등록 | ✅ 완료 | 이름, 차트번호, 전화번호, 주민번호 |
| 환자 수정 | ✅ 완료 | 수정 모달, 주민번호 포함 |
| 통합 검색 | ✅ 완료 | 이름 / 전화번호 / 차트번호 / 주민번호 앞자리 |
| 상담 기록 작성 | ✅ 완료 | 리치 텍스트(HTML), 인라인 이미지(주석 포함), 처방 메모 |
| 상담 이력 조회 | ✅ 완료 | 환자 상세 페이지, HTML 렌더링 |
| 리치 텍스트 에디터 | ✅ 완료 | Tiptap — 볼드·이탤릭·제목·목록·인용·구분선·실행취소 |
| 인라인 이미지 편집 | ✅ 완료 | 텍스트 흐름 안에 이미지 삽입, 모서리 드래그로 크기 조절 |
| 이미지 주석 도구 | ✅ 완료 | 펜·직선·화살표·사각형·텍스트·지우개, 색상 7종, Ctrl+Z |
| 이미지 삽입 방법 | ✅ 완료 | 툴바 버튼 / 드래그 앤 드롭 / Ctrl+V 클립보드 붙여넣기 |
| 체어 번호 관리 | ✅ 완료 | 로컬스토리지 기반, 상담 기록에 자동 저장 |
| 주민번호 마스킹 | ✅ 완료 | 목록/상세 화면 880101-1****** 형식 |
| 주민번호 해시 | ✅ 완료 | SHA-256, unique index로 중복 방지 |
| Vercel 배포 | ✅ 완료 | GitHub main 연동 자동 배포 |
| Supabase Auth 연동 | ✅ 완료 | 이메일+비밀번호, 세션 쿠키, proxy 미들웨어 |
| 이메일 인증 콜백 | ✅ 완료 | /auth/callback PKCE 코드 교환, 자동 로그인 |
| 기관 등록 (signUp) | ✅ 완료 | 기관명 + 이메일 + 비밀번호로 신규 기관 생성 |
| 다기관 격리 구조 | ✅ 완료 | institution_id 필터 + RLS (get_my_institution_id) |
| 로그인/로그아웃 | ✅ 완료 | `/login`, `/signup` 페이지 |
| 기존 데이터 기관 귀속 | ✅ 완료 | 시드 기관 → 예미안치과 마이그레이션 완료 |
| 직원 초대 (Server Action) | ✅ 완료 | inviteStaff, acceptInvitation 백엔드 구현 |
| 디자인 시스템 문서 | ✅ 완료 | docs/design.md |
| 환자 포털 — SMS 초대 발송 | ✅ 완료 | 직원이 환자 상세에서 "상담 공유" 버튼으로 Solapi SMS 발송 |
| 환자 포털 — OTP 가입 | ✅ 완료 | 주민번호+전화번호 → OTP 인증 → patient_accounts 생성 |
| 환자 포털 — 상담 내역 조회 | ✅ 완료 | /portal/records — 모든 연결 기관 상담 통합 조회 |
| 환자 포털 — 로그아웃 | ✅ 완료 | patient_session_token 쿠키 삭제 + DB 세션 삭제 |
| Google OAuth 로그인 | ✅ 완료 (외부 설정 필요) | Google 로그인 버튼 + 신규 사용자 기관 등록 온보딩 흐름 |
| 헤더 기관 전환 드롭다운 | ✅ 완료 | 복수 기관 소속 직원용 드롭다운, 단일 기관은 텍스트만 표시 |
| 직원 권한 관리 (설정 페이지) | ✅ 완료 | `/settings` — 직원 목록 조회, is_active 토글, 직원 초대, 기관명 수정 |
| 최고 관리자 패널 | ✅ 완료 | `/admin` — 전체 기관 통합 조회, 기관별 직원 권한 관리 |
| PWA 홈 화면 추가 | ✅ 완료 | manifest.ts, 아이콘(192/512), sw.js, Apple 메타태그 |
| Web Push 알림 | ✅ 완료 | VAPID, push_subscriptions 테이블, 상담 저장 시 자동 발송 |
| 항시 로그인 | ✅ 완료 | proxy.ts updateSession() + SessionRefresher 클라이언트 리스너 |
| 헤더 고정 + 새로고침 | ✅ 완료 | sticky 헤더 + RefreshButton (router.refresh()) |
| 푸터 브랜딩 | ✅ 완료 | SUWANT holdings Inc. 푸터 전 페이지 표시 |
| 환자 Google OAuth 가입 | ✅ 완료 | SMS OTP 인증 후 /portal/signup-cta → Google OAuth → patient_auth_links 연결 |
| 환자 Google 재로그인 | ✅ 완료 | /portal/login Google 버튼 → /auth/patient-callback → /portal/records |
| 환자 포털 이중 인증 지원 | ✅ 완료 | OTP 쿠키 세션 OR Supabase Google 세션 모두 허용 (getPatientSession 업데이트) |
| 이중 역할 전환 | ✅ 완료 | 직원 헤더 "내 진료 기록" → /portal/records, 환자 화면 "직원 화면" → / |
| 환자 푸시 알림 | ✅ 완료 | patient_push_subscriptions + sendPushToPatient, 상담 저장 시 fire-and-forget |
| 환자 계정 연결 오류 안내 | ✅ 완료 | /portal/link-account — OTP 없이 Google 로그인 시도 시 안내 |
| 체어 즉시 기록 (Chair Quick Record) | ✅ 완료 | 체어 선택 → 즉시 녹음 → AI 변환 → 임시 저장 → 환자 연결 |
| 상담보드 (Consultation Board, record-first) | ✅ 구현(spec 008) | 홈 "상담 기록 시작" 1탭 → **체어·참여자 선택 없이 즉시 녹음** → 보드에서 본문·그림·체어·참여자·처방 병행 채움 → 저장. 참여자 검색·'나' 자동·최근·역할 후순위. 마지막 체어 기기별 기억(보드 기본 선택). DB 변경 0 |
| 미연결 기록 관리 (홈 인라인) | ✅ 완료 | 전체 체어 통합 조회 · 인라인 RichTextEditor 편집 · 처방 선택 · 환자 연결 |
| 체어 기록 재연결/해제 | ✅ 완료 | 환자 상담 기록에서 다른 환자로 재연결 또는 미연결 상태로 되돌리기 |
| 참여자(원장·직원·담당자) 선택 | ✅ 완료 | 녹음 시작 시 참여자 선택 + 마스킹, `clinic_members` 디렉터리 + `consultation.participants` 스냅샷. 마이그레이션 적용 완료 |
| 이미지 줌/팬 | ✅ 완료 | 보기 라이트박스(`ZoomableImage`) + 주석 화면(CSS transform 줌·팬). 휠/버튼/핀치/드래그/더블클릭, 외부 라이브러리 없음 |
| EO 마스터 게이트웨이 캐시 | ✅ **라이브** (2026-06-10) | EO 직원 마스터를 `clinic_members`에 캐시(`source='eo'`). `lib/eo/gateway.ts`+`sync-master.ts`, Vercel Cron `/api/cron/sync-master`(10분). 수동분 보호. 예미안(0e4e85d6) 직원 30명 동기화 확인 |
| EO SSO 작성자 귀속 | ✅ **라이브** (2026-06-10) | `/api/auth/sso` 확장 클레임 수용 → `institution_members.eo_employee_id`·`display_name` 저장. 상담 저장 시 `author_employee_id`·`author_name` 자동 기록 |

---

## 2026-06-19 세션 27 (fix) — SSO 로그인 성능 핫픽스 (카드 476)

헤임달 카드 476: `app/api/auth/sso/route.ts`가 로그인마다 무거운 작업을 동기 실행 → 느림. 서범기 데모 직결.

| 수정 | 내용 |
|---|---|
| ① 최대 병목 제거 | 기존 유저 조회를 `createUser(낙관적 실패)` + `listUsers({perPage:1000})`+JS find → **`generateLink(magiclink)` 1회**로 userId+세션토큰 동시 획득(기존 유저=대부분은 호출 1회). supabase-js 2.101엔 getUserByEmail 없어 generateLink-first 채택 |
| ② await 제거 | `await syncEoMaster`(EO fetch+다건 upsert)를 로그인 경로에서 제거 → 폴링 cron(`/api/cron/sync-master`)에 위임 |
| ③ 낙관적 create 제거 | generateLink-first가 곧 "존재확인 먼저", create는 신규 유저에만 |
| ④ 콜백 홉 단축 | 보류 — 쿠키/세션 흐름 리스크로 데모 직전 미적용(①② 만으로 ★최대 병목 둘 제거) |
| 빌드 | `npm run build` ✅ |

> 검증: 프로덕션 [SSO] 로그 타임스탬프 간격(userId→generating→redirecting) 단축 확인. 실 EO SSO 클릭 1회 검증 권장. 문제 시 `git revert`로 즉시 롤백.
>
> **결과(대표 체감): 여전히 생각보다 빠르지 않음.** ①② 제거에도 남은 지연 후보 → ⏳재방문:
> - ④ 보류한 콜백 홉(`/auth/callback` 1회 추가 리다이렉트+verifyOtp)
> - `generateLink`·Supabase admin 호출 자체 지연(GoTrue 왕복) / Supabase 리전
> - **로그인 직후 대시보드 레이아웃 5개 쿼리**(getMyInstitutions·getMyInstitutionId·getChairs·getClinicMembers·getMyAuthorInfo) — "첫 화면 느림"의 유력 원인
> - 서버리스 콜드스타트
> → 데모 직전 재최적화 시 ④ + 대시보드 쿼리 병렬/슬림화부터 검토.

---

## 2026-06-19 세션 26 (기획) — 요금·등급 정책(v2) + 음성 원본 보관 + spec 009

녹음 원본 보관 논의가 가격정책으로 확장 → 비판적 검토로 구조 확정. `docs/pricing-tiers.md`(v2) + `specs/009-audio-archive` 등급 정렬.

| 결정 | 내용 |
|---|---|
| 과금 단위 | **병원 월정액** + **토큰(전사 1분=토큰1)** 분리(변동원가 회수). 다지점=Enterprise 문의 |
| 등급 | **Free / Standard / Pro / Enterprise** (멤버 수 차등 없음) |
| 가격 | Standard 정가 ₩39,000(도입 ₩19,000) / Pro ₩59,000 / Free ₩0 / Enterprise 문의 |
| 포함 전사 | Free 30분 / Standard 300분 / Pro 1,000분(권장) · 초과 토큰 충전(원가~₩10/분, 판매 ₩30~50/분 초안) |
| 음성 원본 | Free=최근3 롤링(텍스트 유지) / Standard=90일 / Pro·Ent=1년+·감사 |
| 핵심 원칙 | 정액=기능·보관 / 토큰=전사분량. **상담보드(코어) 비매**, 모듈=주변부 고급. Free=맛보기+넛징 |
| 구현 연결 | `institutions.plan`(free/standard/pro/enterprise) → 게이트. 음성 보관=spec 009, 토큰 빌링=별건(향후) |

> 비판 검토: Pro 3,000→1,000분으로 낮춰 마진 80%대 확보(전사 원가 회피). 음성=중앙(Storage) 보관, 텍스트 차트는 등급 무관 영구. 법적 음성 보존의무 미결.

---

## 2026-06-19 세션 25 (기록) — 서범기 데모(강남 오늘의 치과) 진행중 캡처

모건 핸드오프: 강남 오늘의 치과 "신환 접수~상담 flow 효율화" Carelog 데모 흐름이 살아있음(서범기=연결고리, 주인공=상담실장). **결정: 데모 전용 작업은 하지 않고 핵심 기능 완성도를 높이는 것으로 대응.** 스코프·over-promise 위험·권장 시나리오를 카드로 보존.

| 항목 | 내용 |
|---|---|
| 기록 | `specs/000-backlog/seobeomgi-demo-scope.md` — 데모 대상·보여줄 수 있는 것·못 보여주는 것(덴트웹 자동연동 X·OCR X·상담PPT X·SMS 키 확인)·권장 시나리오 |
| 결정 | 별도 데모 개발 없음. 상담보드·녹음·전체복사 등 제품 기능 강화 = 곧 데모 준비 |
| 데모 임박 시(별도) | Solapi 키·데모 기기(안드/PC 크로미움) 점검 → 샘플 신환 시드 |
| 참조 | 미팅노트 260618_서범기미팅(구글닥). testers.md·beta-champion-pipeline은 미확보(EO 자산) |

> over-promise 방지: 덴트웹/OE 자동 연동은 없음(복사 1회·수동 업로드). 강조점은 "상담실장의 중복 손기입 제거".

---

## 2026-06-19 세션 24 (구현) — 다기기 알림·자동 refresh·전체 복사

케어로그 치과 실사용 도입 + 예미안 파일럿(도은쌤 주1회·시간당 3만·4회) 확정. 현장 요구 3건 반영. DB 변경 0.

| 작업 | 결과 |
|---|---|
| ① 같은 계정 다른 기기 알림 | 실시간 알림 에코 방지를 `actor_user_id` → **"이 탭이 방금 저장한 consultation_id"** 기준으로 변경(`lib/realtime/local-echo.ts`). 저장한 탭만 자기 토스트/소리 숨김 → **같은 계정으로 여러 PC 로그인 시 다른 화면은 알림 수신**. `live-alerts-provider`·`consultation-board`·`chair-overlay`에 `markLocalSave` 배선, `LiveAlertsProvider` currentUserId prop 제거 |
| ② 미연결기록 자동 refresh(타 기기 포함) | `UnlinkedRecordsSection`이 `initialRecords` prop 변경을 state에 반영하도록 동기화 effect 추가(기존 버그: useState 1회 초기화 후 미갱신). 실시간 알림의 `router.refresh()`가 모든 기기에서 목록 갱신 + 저장 기기는 보드 저장 직후 `router.refresh()`로 즉시 반영 |
| ③ 전체 복사 | `lib/html-to-text.ts`(HTML→평문, 줄바꿈 보존) + `components/copy-all-button.tsx`(클립보드 복사). **미연결 기록 카드·편집화면·상담보드·환자 상담이력**에 "전체 복사" 버튼 → 덴트웹 등 외부 EMR에 붙여넣기. 미연결 편집화면에 **"저장 후 환자 연결"**(편집→저장→연결 한 동선) 추가 |
| 빌드 | `npm run build` ✅ |

> 멀티기기(파일럿 워크스트림 A)에서 한 사람이 여러 PC를 같은 계정으로 띄워둬도 알림·목록이 일관되게 동기화됨.

---

## 2026-06-18 세션 23 (구현) — 상담보드 record-first (spec 008)

대표님 인사이트: 참여자 26명 선택이 과부하 + 급한 진료에 "선택 게이트"가 기록을 막는다 → **"선택 → 녹음"을 "녹음 → 채워넣기"로 역전**. spec-kit 전 과정(specify→plan→tasks→implement)으로 구현.

| 작업 | 결과 |
|---|---|
| 토대 — draft 세션 | `chair-provider.tsx`에 `DRAFT_CHAIR_KEY` — 체어 없이 녹음 시작/중지(기존 키 메커니즘 재사용), members·me context 노출. 기존 per-chair 오버레이 회귀 없음 |
| US1 record-first | `consultation-board.tsx`(신규) — 1탭 즉시 녹음 → 중지·전사 → **저장 시 체어 귀속**. `consult-hero.tsx`는 record-first 보드 진입으로 단순화(기존 picker 제거). 보드 닫아도 작성 내용·녹음 보존(FR-016) |
| US2 참여자 부담 해소 | `participant-picker.tsx`(신규, 검색·'나' 자동·최근순·역할 후순위) + `getRecentParticipants`(신규 읽기 액션, 최근 상담 participants distinct). 26명 노이즈(대표·한량·미분류) 후순위, 검색으로 전체 도달 |
| US3 종합 캔버스 | 보드 본문=`RichTextEditor`(인라인 이미지+그림 주석) + `PrescriptionPicker`. 녹음 도는 동안 본문·그림·처방·체어 병행(상태 분리로 녹음 끊김 0) |
| 설계 핵심 | **DB·서버 액션 시그니처 변경 0**(MVP) — `saveChairRecord(chairId,…)` 그대로, 변경은 클라이언트 재구성 + 읽기 액션 1개. 마이그레이션 불요 |
| 빌드 | `npm run build` ✅ (TypeScript 통과) |
| ⏳ 남은 것 | T017 녹음 일시정지(선택, 보류) · T021 실기기 수동검증(파일럿에서 SC-007) · main 배포(다온) |

> 멀티기기 세팅(예미안 파일럿 워크스트림 A)과 직결: 기기=체어 매핑 + record-first로 김도은 1년차가 "급할 때 빠짐없이 기록"하는 핵심 루프 완성.

---

## 2026-06-18 세션 22 (구현) — 원탭 녹음 UX (spec 006 강화)

체어 녹음 진입 단축. 기존 콜드 스타트는 "상담 기록 시작 → 체어 선택 → 녹음 시작" 3탭. 마지막 체어를 기억해 홈에서 1탭으로 바로 녹음 시작.

| 작업 | 결과 |
|---|---|
| 마지막 체어 기억 | `components/chair/consult-hero.tsx` — `localStorage["carelog:lastChairId"]`에 체어 선택 시 저장(`rememberChair`). 기기별이라 각 직원 기기가 자기 체어를 기억. 삭제된 체어 id는 복원 시 무시 |
| 원탭 녹음 버튼 | 마지막 체어가 있으면 히어로 1차 CTA를 `{체어명} 바로 녹음`으로 노출 → 같은 클릭 제스처 안에서 `openOverlay` + `startRecording` 호출(getUserMedia 사용자 제스처 보존). 보조 동선 "다른 체어로 기록"은 기존 picker로 |
| 폴백 | localStorage 미지원/차단 또는 마지막 체어 없음 → 기존 "상담 기록 시작" 흐름 그대로. 마이크 권한 거부 시 오버레이는 idle로 열려 재시도 가능 |
| 범위 | UI/클라이언트 한정 — DB/서버 액션/스키마 변경 없음. 기존 006 즉시기록 파이프라인 재사용 |
| 빌드 | `npm run build` ✅ (TypeScript 통과) |

> iOS "마이크 허용 1회화"는 PWA 설치 시 origin 권한이 유지되므로 별도 코드 없이 자연 충족. 체어 녹음 신뢰성(빈 녹음) 원인 확정은 대표님 요청으로 파킹(진단 계측 c81a4ef 배포 상태 유지).

---

## 2026-06-14 세션 21 (구현) — 실시간 체어 상담기록 알림 (spec 007)

spec-kit 전 과정(specify→plan→tasks→implement)으로 spec 007 구현. 예미안처럼 체어마다 PWA 띄워둔 환경에서 한 체어 기록이 올라오면 전 화면 실시간 인지.

| 작업 | 결과 |
|---|---|
| US1 실시간 토스트+목록갱신 | `lib/realtime/institution-events.ts`(chair_audit_logs INSERT 구독) + `components/notifications/live-alerts-provider.tsx`(에코방지·디바운스·재연결 refresh) + `alert-toast.tsx`, 대시보드 레이아웃 마운트 |
| US2 소리 | `alert-sound.ts`+`sound-arm-button.tsx`(1회 활성화·on/off, localStorage) + 헤더 배치, `public/sounds/alert.wav`(딩동) |
| US3 Web Push | `saveChairRecord`에 `sendPushToInstitution` fire-and-forget 추가(체어명·도착사실만) |
| 설계 핵심 | 진료본문 든 `consultation` 아닌 **`chair_audit_logs`(PII 0) 구독** → 전송선 환자정보 없음(헌법 I), `actor_user_id`로 에코방지. 목록은 `router.refresh()` 서버 재조회(헌법 II) |
| DB | 마이그레이션 `20260614000001_realtime_chair_audit_logs.sql`(chair_audit_logs를 supabase_realtime publication에 추가, 멱등). schema.sql·database.md 동기화 |
| 빌드 | `npm run build` ✅ |
| ⏳ 남은 수동작업 | **(1) 마이그레이션 Supabase 적용**(다온/대표 — 대시보드 Replication 확인) **(2) 실기기 검증**(두 화면 토스트/소리/푸시, quickstart.md) |

> 기기 확정: PC·안드로이드 태블릿·안드로이드 폰(보조), iOS 범위 밖 → 푸시·소리 제약 없음. 향후 알림·소통 기능(직원 호출·환자 도착 등)은 이 파이프라인 확장.

---

## 2026-06-13 세션 20 (기획) — 성장 축: 상담 데이터 → 경영관리·CRM

대표님 발의. 방향 캡처(스펙 아님). Carelog를 병원 상담 플랫폼으로 키우며 상담 데이터(상담 성공률 등)를 구조화 축적 → 경영관리·CRM 원천으로 잇는 사다리.

| 산출물 | 내용 |
|---|---|
| `docs/consult-analytics-crm-vision.md` | 신규 방향 문서 — 발전 사다리(기록→데이터·지표→경영관리·CRM), 수집 후보 필드, 지표 예시, EO 경계, 첫 걸음 |
| `roadmap.md` | 채움 — 지금(EO 안정화)/다음(상담 결과·유형+성공률 1단계)/나중(경영 대시보드·CRM·EO 피드·도메인 확장) |
| `docs/product-vision.md` | 관련 문서 목록에 성장 축 포인터 추가(기둥1 심화로 연결, SSOT 본문 불변) |

> 다음 액션: 우선순위 합의 후 1단계 `specs/007-consult-outcomes`(가칭) — `consultation` 결과/유형/전환/금액 필드 + 성공률 집계로 spec-kit 시작.

---

## 2026-06-10 세션 19 작업 내용 (EO 연동 프로덕션 라이브)

카드 235·237 마무리. 테오(EO) 측 게이트웨이 API·기관 연동·SSO 클레임 준비 완료 회신 → 시크릿 재발급 수신 → Carelog 배포·검증.

| 작업 | 결과 |
|---|---|
| 시크릿 등록 | 테오 새 `CARELOG_GATEWAY_SECRET` 재발급 → 대표님이 Carelog Vercel Production 등록 |
| EO 코드 배포 | work→`main`·`dev` 머지 배포. `lib/eo/*`·sync-master cron·SSO 확장 프로덕션 반영 |
| **cron 미들웨어 버그 fix** | `updateSession` 공개경로에 `/api/cron/` 누락 → Vercel Cron이 `/login`으로 307 리다이렉트되어 동기화 불가. `lib/supabase/middleware.ts`에 `/api/cron/` 추가(라우트 자체 `CRON_SECRET` 검증). 세션17 작성분이 미배포라 안 잡혔던 케이스 |
| 라이브 검증 | `GET /api/cron/sync-master` → `{ok:true, synced:1, skipped:1}`, 예미안(0e4e85d6) `synced(+0/~30/-0)` = EO 직원 30명 캐시. `error:config` 없음(시크릿 정상) |
| 연동 institution_id | `0e4e85d6-d839-48ef-a1fb-1915521b9395` (예미안치과의원, EO member_count 30) |
| 남은 확인(수동) | SSO 로그인 → 상담 저장 → `author_employee_id`·`author_name` 채워짐 최종 확인(EO "케어로그 열기" 경유) |

> 결정: EO는 import 없이 HTTP 게이트웨이/SSO로만 연동(헤임달 §3·§4). 상담 EO API 미구현(의료데이터 격리). 다음: SSO 작성자 귀속 실사용 확인 후 카드 237 종료.

---

## 2026-06-10 세션 18 작업 내용 (직원 초대 버그 수정 + 중복 워크스페이스 정리)

설정 화면 직원 초대에서 "초대 이메일 발송 실패: A user with this email address has already been registered" 발생 → 원인 분석 후 수정.

| 작업 | 결과 |
|---|---|
| 원인 | `inviteStaff`가 신규 전용 API `inviteUserByEmail`을 사용 → **이미 구글 로그인 등으로 auth 계정이 있는 이메일**엔 실패. 또한 콜백이 멤버 없으면 무조건 `/onboarding`(새 워크스페이스)로 보내 **초대받은 사람이 중복 워크스페이스를 생성**하는 트랩 존재 |
| ① `inviteStaff` 분기 (즉시 직원 추가) | 이미 가입된 계정이면 `inviteUserByEmail` 대신 `institution_members`에 **즉시 추가**(role 반영, 비활성 멤버는 재활성화). 신규 이메일은 기존 메일 초대 유지. `app/actions/institutions.ts` |
| ② 온보딩 트랩 보정 | `app/auth/callback/route.ts` — 멤버 없을 때 **대기 중(미수락·미만료) 초대가 있으면 `/invite/{token}`** 수락 동선으로, 없을 때만 `/onboarding` |
| ③ dangling invitation 방지 | 신규 이메일 초대 메일 발송 실패 시 방금 만든 `institution_invitations` row 롤백(delete) |
| 폼 UX | `staff-invite-form.tsx` — "직원으로 추가했습니다" vs "초대 이메일을 발송했습니다" 분기 + 즉시 추가 시 `router.refresh()`로 목록 갱신 |
| 데이터 핫픽스 | `yemian2012@gmail.com` 예미안치과(0e4e85d6) 직원 즉시 등록(SQL). 환자 테스트로 생긴 **중복 워크스페이스 `a15efbd8`(예미안치과, owner jihun0729)** 삭제 — 빈 워크스페이스(멤버 1건)라 cascade로 정리 |
| ④ 워크스페이스 이름 중복 방지 | `signUp`·`setupInstitution`에 기관명 **대소문자 무시 중복 검사**(`ilike`) 추가. signUp은 auth 유저 생성 **전에** 차단해 orphan 계정 방지. `app/actions/auth.ts` |
| ⑤ 직원 역할 변경 + 완전 제거 | `admin.ts`에 `changeStaffRole`(staff↔admin), `removeStaff`(멤버십 삭제) 액션 추가. 자기 자신·대표·슈퍼어드민 보호. `staff-list.tsx`에 역할 셀렉트 + 제거 버튼 배선(기존 활성/비활성 토글 유지) |
| 빌드/린트 | `npm run build` ✅ · 변경 파일 린트 이슈 없음(auth.ts `_formData` 미사용 경고는 기존 건) |

> 결정: "이미 계정 있는 사람 초대 = **즉시 직원 추가**"(이메일/수락 단계 없음), "워크스페이스 이름 = 전역 중복 불가".
> 후속 강화 후보(미적용): `institutions.name`에 DB 레벨 부분 unique index(`lower(name)`)로 동시성 레이스까지 차단. EO 게이트웨이 main 배포는 빌/테오 시크릿 회신 대기 중.

---

## 2026-06-08 세션 17 작업 내용 (카드 235 — EO 게이트웨이/SSO/작성자 귀속 구현)

핸드오프 카드 235 §6 구현계획 ①②③ 전체 구현. 계약: EO `spec-016`/카드#226(테오). 브랜치 `claude/festive-planck-FCghV`.

| 작업 | 결과 |
|---|---|
| ① 마스터 캐시 — `clinic_members` 재활용 | 마이그레이션 `20260608000001_eo_integration.sql`: `clinic_members`에 `eo_employee_id`·`email`·`eo_role`·`position`·`source`(manual/eo)·`synced_at` 추가. 기존 `unique(institution_id,name)` 완화 → 부분 unique 2종(manual 이름 / eo_employee_id). `lib/eo/gateway.ts` `fetchEoMaster()`(헤더 `x-gateway-secret`, 응답코드 200/400/401/404/500 매핑), `lib/eo/sync-master.ts` `syncEoMaster()`(eo_employee_id upsert·source='eo'·미존재 행 비활성·**manual 행 불가침**). 폴링 `app/api/cron/sync-master/route.ts`(Vercel Cron 10분, `CRON_SECRET` Bearer 보호) + `vercel.json` crons 등록 |
| ② SSO 보정 — `/api/auth/sso` | 확장 클레임(`employee_id`·`name`·`account_type`·`eo_role`) 수용. 신규 멤버는 `mapEoRole`(clinic_admin→admin, 그 외 staff)로 추가, 기존 멤버는 role 불변·`eo_employee_id`/`display_name`만 갱신(권한 과승격 방지). 로그인 시 해당 기관 EO lazy 동기화(best-effort, 비차단) |
| ③ 작성자 귀속 — `consultation` | 마이그레이션에 `author_employee_id`·`author_name` 추가. `lib/auth/institution.ts`에 `getMyAuthorInfo()` 신설 → `saveConsultation`·`saveChairRecord` 저장 시 자동 기록. 공용계정도 표시명 보존. **상담 EO API 미구현(계약 §4 의료데이터 격리)** |
| 타입·문서 | `lib/types/database.ts`(ConsultationRow·ClinicMemberRow·InstitutionMemberRow 컬럼), `supabase/schema.sql`, `docs/database.md`, `docs/architecture.md` 현행화 |
| 빌드 검증 | `npm run build` ✅ (TypeScript 통과, `/api/cron/sync-master` 동적 라우트 등록 확인) |

> ⏳ **배포 시 필수**: (1) `20260608000001_eo_integration.sql` Supabase 적용. (2) `CARELOG_GATEWAY_SECRET`을 **EO·Carelog 양쪽 Vercel**에 동일 등록(서버-서버). (3) `CARELOG_SSO_SECRET`(기존)·`EO_APP_URL` 확인, 선택 `CRON_SECRET` 등록.
> 🌿 카드의 `claude/dreamy-cerf-7LI1q` 대신 새 배정 브랜치 `claude/festive-planck-FCghV`에서 작업(카드 핸드오프 doc은 cherry-pick으로 동반).

---

## 2026-06-08 세션 16 작업 내용 (완료분 배포 + EO 계약 카드226 수신)

| 작업 | 결과 |
|---|---|
| 완료분 프로덕션 배포 | 참여자 선택 + 이미지 줌/팬(#2) + 홈 히어로 카피(#1) — `clinic_members` 마이그레이션 Supabase 적용 확인 후 `main` 머지·배포. 카드 235(EO 연동)와 분리해 완료분 우선 배포(완료분 방치 금지) |
| EO↔Carelog 연동 계약 수신 (카드226) | 테오 작성 `specs/016-carelog-integration/contracts/eo-gateway-and-sso.md` 전문 확보(EO 레포 자산, 빌 경유 전달). **확정 사항**: ① 마스터 게이트웨이 = Carelog가 `GET /api/gateway/carelog/master`로 pull(헤더 `x-gateway-secret: CARELOG_GATEWAY_SECRET`, 5~15분 폴링) → `clinic_members` 캐시 upsert(키=`employee_id`). ② SSO = 라이브, 클레임 확장(`employee_id`·`name`·`account_type`·`eo_role`·`scope`) → 작성자 귀속 키 저장 보정. ③ 상담 = **EO API 없음**(의료데이터 게이트웨이 금지), SSO 세션 후 Carelog 내부 저장·열람, 작성자만 `employee_id`/`email` 귀속 |
| 카드 235 착수 (다음) | ① `clinic_members` 재활용 캐시(eo_employee_id·email·eo_role 컬럼 + EO-source 동기화) ② `/api/auth/sso` 확장 클레임 수용 + `institution_members.eo_employee_id` 저장 ③ `consultation` 작성자 컬럼(author_employee_id·author_name) + 저장 시 귀속 |

> 📌 사전 추측 정정(빌): 게이트웨이는 `sso-token` 재사용 ❌ → 별도 서버-서버 시크릿 `x-gateway-secret`. 상담 EO API 구현 ❌(만들면 계약 위반).

---

## 2026-06-07 세션 14 작업 내용 (UX #1 + EO 통합 기획)

"2~5번 클릭이면 끝" 원칙으로 일상 플로우 점검 → 개선 착수 + EO↔Carelog 층위 기획.

| 작업 | 결과 |
|---|---|
| #1 상담 저장 성공 피드백 | `saveConsultation` 성공 시 redirect 제거 → `{ ok, mode }` 반환. `consultation-form`이 모드별 토스트("저장했어요 ✓"/"임시 저장"/"전송") + 폼 초기화 + `router.refresh()`로 타임라인 즉시 갱신. 죽은 코드(`ok` 항상 false)였던 성공 메시지 살림. `RichTextEditor`에 `clear()` 추가. **배포 완료** |
| EO↔Carelog 층위·통합 기획 | `docs/eo-carelog-integration.md` — SSOT 분할 + 브리지 계약 제안, 진료 후 피드백 파일럿. **제안 카드 25** EO 실비에게 전달(회신 대기) |

> 후보(미착수): #2 저장 버튼/동의 정리, #3 검색결과 행 전체 탭, #5 에러 문구 친화화, #4 체어 저장+연결 통합, #6 홈/환자목록 역할 분리. 환자 여정 단계적 가입(#7·#8)은 EO 보안/층위 합의 후 `specs/007`로.
>
> ⏳ **대기**: EO 실비 회신(층위 6문항) → `specs/007-eo-bridge-feedback` 착수.

---

## 2026-06-07 세션 15 작업 내용 (EO 통합 — 카드224 회신 반영)

실비 핸드오프 카드224(제안 카드25 회신) 수신 → `docs/eo-carelog-integration.md` 갱신.

| 작업 | 결과 |
|---|---|
| 미결 6문항 회신 반영 | **확정**: 클리닉·직원 마스터=EO 이관(Q1) / 환자 SSOT=Carelog(Q2) / 피드백 직원식별 O(Q4) / EO에 `sso-token`+`workspace_carelog_links` 기존재→재사용·중복금지(Q6). **방향확정·세부TBD**: 전송 관문=헤임달(카드219) 일원화·`sso-token` 재사용(Q5). **미결**: 암호화 lib/KMS·키공유(Q3) |
| 브리지 계약 1차 초안 | EO→CL 마스터(읽기)·CL→EO 환자 이벤트(`feedback.submitted`/`consent.updated`/`engagement.signal`) 공통 봉투·payload 초안. EO 소유 영역·헤임달 인증은 TBD 표기 |
| Living Consult 온보딩 기획 (카드229·달리) | `docs/living-consult-onboarding.md` — 진료 중 진입 부담↓: ①환자 설명화면+빠른녹음 버튼 ②의료진 멘트. **다온 결정**: 모니터=2기기+Realtime 읽기전용 `/present/[chairId]`, 동의='녹음·기록 동의'를 진료시점 캡처(개인정보 동의와 분리·거절도 기록), 기기=2기기 기본+1기기 폴백. 카피/멘트는 달리 브리프 확정안으로 대체 예정 |
| 제품 비전·정체성 SSOT 확정 (대표님 정의) | `docs/product-vision.md` 신규 — **환자 전용 아님**. 세 기둥: ①의료기관 상담 기록·시각화(STT/AI/상담보드→의무기록, B2B) ②연결고리(상담·사진·처방내역 환자 전달) ③환자 통합 보관·소통·생애주기 건강관리(B2C). README 첫 정의 교체 + project_status 상단 앵커 + 문서표 링크 |
| 빠른 녹음 설명화면 **구현** (Living Consult MVP) | `app/present/[chairId]` 신규 라우트(로그인 불요) + `components/chair/present-screen.tsx`. 흐름: 설명→선택(체어·담당의사·담당자, 선택 안 해도 진행)→**"같이 이야기 나누고 있어요"**(녹음 표현 X·sky 톤)→**상담 요약 시각화**(처방/다음방문 등)→**진료기록 받아보기 유도**. 메인카피 "기록으로 남겨서 저희가 전달해드릴게요", '삭제' 표현 배제(병원 보관). 미들웨어 `/present/` 공개경로. **빌드 통과**, 5개 상태 스크린샷 확인. **프로덕션 배포 완료**(carelog-tau.vercel.app/present/A). ⏳ 실제 음성 듣기·AI 요약(006 파이프라인)·Realtime 동기화·동의 컬럼 저장은 후속 |
| 홈 최상단 히어로 전환 (Living Consult 톤) | 기존 `QuickRecordTrigger`(빠른 기록 시작 버튼) → **`components/chair/consult-hero.tsx`**(`ConsultHero`)로 대체. 홈 최상단에 "오늘 진료, 기록으로 남겨서 환자에게 전달해요" 헤드라인 + "상담 기록 시작" CTA, 그 아래 대시보드(미연결 기록·환자검색·최근활동) 펼침. **기능 동일**(체어 칩/직접입력 → `openOverlay`). 기존 plain 헤더 제거, `quick-record-trigger.tsx` 삭제, architecture.md 갱신. **프로덕션 배포 완료** |
| 참여자(원장·직원·담당자) 선택 — 멤버 디렉터리 | ✅ **마이그레이션 적용·배포 완료(세션 16)**. 녹음 시작 시 참여자 선택 + 마스킹(송정훈→송정*). 신규: `clinic_members` 테이블(체어 패턴) + `consultation.participants` jsonb 스냅샷. 액션 `clinic-members.ts`(getClinicMembers·upsertClinicMember), 설정 '멤버 관리' UI, 히어로 참여자 칩, `saveChairRecord`에 participants 저장, 오버레이 참여자 표시. 이름은 추후 EO 이관 예정. 마이그레이션 `20260607000001_clinic_members.sql` Supabase 적용 완료. 빌드 통과 |
| 홈 히어로 카피 미세조정 (#1) | 서브카피 "…검토 후 보내면 **환자가 직접 받아 보관해요**"로 환자가치 강조(이전 다온 문구 반영). 88915aa(zen-cerf)는 옛 헤더 수정이라 무효·미병합 |
| 이미지 줌/팬 (#2) | **보기 라이트박스**(`consultation-history`): 재사용 `ZoomableImage`(휠/버튼/핀치/드래그/더블클릭) 적용. **주석 화면**(`image-annotator`): CSS transform 줌(그리기 좌표 보존) + ✋이동 툴(팬) + 핀치 + 휠 + 줌버튼. 외부 라이브러리 없음. 빌드 통과·프리뷰 확인 |

> ⚠️ **세션 환경 한계**: 이 세션은 `carelog` 단독 클론(`../eo`·`../iris` 미존재) + GitHub MCP 범위 `gungang83/carelog` 한정. 카드26 지시1(EO 암호화·RRN 처리 이식)·지시2(EO 기존 피드백 기획 대조)는 **EO 소스 접근 확보 후** 수행 — 추측 산출물 배제.
>
> ⏳ **다음**: 헤임달 관문계약(카드219·spec-048) 확인 → Q3·전송 스키마 확정 → `specs/007-eo-bridge-feedback` 스펙 착수.
> 🌿 작업 브랜치: 이 세션은 `claude/dreamy-cerf-7LI1q` (CLAUDE.local.md 표기 `claude/zen-cerf-hWuUw`와 상이 — 세션별 브랜치 차이 확인 요).

---

## 2026-06-01 세션 13 작업 내용 (빠른 기록 4종 개선/버그픽스)

| 작업 | 결과 |
|---|---|
| ① 녹음 중 화면 잠금 대응 | `chair-provider.tsx`에 Screen Wake Lock 추가(녹음 중 화면 꺼짐 방지) + 복귀 시 재획득 + `recorder.onerror` 트랙 정리. 모바일 잠금으로 인한 녹음 손상/에러 방지 |
| ② 신규 환자 임시 등록 | `createPatientAndLink`는 기존 구현 — 검색 화면에 "새 환자 등록" 버튼을 **항상** 노출하도록 개선(`chair-patient-search.tsx`) |
| ③ 줄바꿈 손실 | 저장 시 평문 전사 텍스트를 HTML로 정규화(`ensureHtml`/`plainTextToHtml` in `sanitize-html.ts`) → `saveChairRecord`/`updateChairRecordContent` 적용. 기존 평문 기록도 마이그레이션에서 일괄 변환 |
| ④ 연결 후 최근 활동 미노출/클릭불가 | `activity_logs` INSERT 트리거가 draft(patient_id NULL)는 건너뛰고, **UPDATE 트리거 신설**로 연결/재연결/해제 시 동기화. 기존 NULL 로그 정리 (migration 20260601000001) |
| 문서 | `supabase/schema.sql`에 activity_logs 섹션 현행화, `docs/database.md` 갱신 |

> ✅ **DB 마이그레이션 적용 완료**: `20260601000001_activity_log_patient_sync.sql` — Supabase SQL Editor 실행 완료, 폰 테스트로 ①~④ 정상 확인됨.

---

## 2026-05-31 세션 12 작업 내용 (조직 공통 PLAYBOOK 도입)

> 실비(EO 기획) 핸드오프: EO·Carelog·Iris 공통 운영 플레이북 도입.

| 작업 | 결과 |
|---|---|
| `PLAYBOOK.md` 신규 (루트) | EO 원본 기준 조직 공통 운영 플레이북 — 커뮤니케이션·에이전트 정의·커밋 컨벤션·협업 규칙·핸드오프 카드·배포 정책·운영 철학·동기화 프로토콜. §2 Daon 성격란 채움 |
| `CLAUDE.md` 정리 | 최상단에 PLAYBOOK 우선 참조 줄 추가; 공통 규칙(협업·커밋컨벤션·에이전트 정의) 제거 → **Carelog 특화(운영 주체·브랜치·Vercel 배포)만** 남김 |
| 정체성 추적 방침 명시 | 원격 web 세션이라 `CLAUDE.local.md`를 레포에 커밋(추적)해 정체성 유지 — PLAYBOOK의 "git 미추적"과 다른 Carelog 예외임을 CLAUDE.md에 기록 |
| EO 제안서 후속 | 디자인 공통화 제안(`proposal-eo-design-system.md`)과 별개로, 운영 방식 공통화가 PLAYBOOK으로 먼저 도입됨 |

> 📌 **동기화 의무**: EO `PLAYBOOK.md`가 바뀌면 실비가 "동기화 카드"를 보냄 → 다온이 Carelog `PLAYBOOK.md`에 반영. 두 레포 상단 버전(날짜) 일치로 확인. (PLAYBOOK §7)

---

## 2026-05-30 세션 11 작업 내용 (멀티 에이전트 협업 체계 이식)

| 작업 | 결과 |
|---|---|
| `docs/multi-agent-playbook-template.md` 신규 | EO 검증 멀티 에이전트 협업 모델(원격 웹세션판) 이식용 템플릿 전문 |
| `.gitattributes` 신규 | `CLAUDE.local.md merge=ours` — 정체성 파일 머지 보호 |
| `CLAUDE.md` 협업 섹션 추가 | 2역할(기획 PM / 시니어 개발·배포) 소유권·브랜치 전략·커밋 컨벤션·협업 규칙 |
| `roadmap.md` 신규 | 기획 PM 로드맵 골격 |
| `specs/000-backlog/README.md` 신규 | 핸드오프 큐 골격 |
| `CLAUDE.local.md` 신규 | **다온(🟣) 정체성 — 기획 PM + 시니어 개발·배포 겸임** |
| `dev` 브랜치 생성 | main/dev 2단 브랜치 구조 확립 |
| 운영 체제 확정 | 현재 다온이 기획·개발·배포 전 역할 겸임 (추후 분리 가능) |
| **VAPID 빌드 취약점 수정** | `push.ts`·`patient-portal.ts`가 모듈 로드/호출 시 `setVapidDetails`를 비널 단언으로 호출 → 환경변수 없는 환경(Vercel Preview)에서 빌드 붕괴. 지연 초기화 + env 가드로 변경(없으면 푸시만 건너뜀, 빌드는 통과) |
| dev Preview 배포 실패 대응 | `dev` 브랜치 push가 Preview 배포를 트리거했으나 Preview 환경에 `VAPID_*` 미설정으로 실패 → 위 코드 가드로 해결 |
| `vercel.json` 신규 | `git.deploymentEnabled`로 `dev`·작업 브랜치 자동 배포 비활성 → **main(Production)만 배포**, Preview 노이즈/크레딧 제거 |

---

## 2026-05-27 세션 10 작업 내용 (문서 정리 + 미연결 기록 성능 개선)

| 작업 | 결과 |
|---|---|
| `README.md` 업데이트 | 주요 기능 목록 현행화 (체어 즉시 기록·환자 포털·Web Push·다중 테넌트 추가); 프로젝트 구조 라우트 그룹 반영; 문서 표에 `docs/design.md` 추가 |
| `docs/architecture.md` 수정 | 체어 즉시 기록 데이터 흐름 전면 재작성 — 삭제된 ChairButtons·ChairRecordList 제거, QuickRecordTrigger·UnlinkedRecordsSection·RelinkControls 반영; unlinkChairRecord·relinkChairRecord 흐름 추가 |
| `docs/database.md` 수정 | 마이그레이션 목록에 `20260517000002_patient_auth_links.sql` 추가; `chair_audit_logs.event_type`에 `patient_unlinked` / `patient_relinked` 추가 |
| 미연결 기록 로딩 성능 개선 | `page.tsx`에서 `getAllUnlinkedRecords`를 서버 사이드로 병렬 페칭 후 prop으로 전달 → 클라이언트 `useEffect` 왕복 제거, 화면 로드 즉시 표시 |
| 빌드 검증 | `npm run build` ✅ 통과 |

---

## 2026-05-25 세션 9 작업 내용 (빠른 기록 UX 고도화)

| 작업 | 결과 |
|---|---|
| 헤더 A/B/C 체어 버튼 제거 | `header.tsx`에서 `ChairButtons` 완전 제거 |
| `chair-buttons.tsx` 삭제 | 불필요 파일 삭제 |
| `chair-record-list.tsx` 삭제 | 홈 인라인 섹션으로 대체되어 삭제 |
| `getAllUnlinkedRecords` 액션 | 모든 체어 미연결 기록 통합 조회 (chair_id, prescriptions 포함) |
| `unlinkChairRecord` 액션 | 연결된 기록을 미연결 상태로 되돌리기 + 감사 로그 |
| `relinkChairRecord` 액션 | 다른 환자로 재연결 + 감사 로그 |
| `saveChairRecord` / `updateChairRecordContent` 업데이트 | prescriptions 파라미터 추가 |
| `prescription-picker.tsx` 생성 | 컴팩트 칩 형태의 처방 선택 컴포넌트 |
| `chair-overlay.tsx` 업그레이드 | has_records 상태에 PrescriptionPicker 추가; DB 기록만 있는 경우 idle 표시 |
| `unlinked-records-section.tsx` 생성 | 홈 화면 미연결 기록 인라인 섹션 (RichTextEditor + PrescriptionPicker + 환자 연결 + 삭제) |
| `quick-record-trigger.tsx` 단순화 | amber 배지 버튼 제거, "빠른 기록 시작" 단일 버튼 |
| 홈 페이지 업데이트 | `UnlinkedRecordsSection` 추가 (QuickRecordTrigger와 PatientHome 사이) |
| `getConsultationsByPatientId` 업데이트 | `chair_id` 컬럼 포함 조회 |
| `ConsultationHistoryItem` 타입 업데이트 | `chair_id: string \| null` 추가 |
| `consultation-history.tsx` 업데이트 | `RelinkControls` 컴포넌트 추가 (체어 기록에만 표시) |
| 빌드 검증 | `npm run build` ✅ 통과 (TypeScript 포함) |

---

## 2026-05-25 세션 8 작업 내용 (체어 즉시 기록 — spec 006)

| 작업 | 결과 |
|---|---|
| speckit 006 전체 실행 | spec.md → plan.md → tasks.md → 구현 완료 |
| DB 마이그레이션 | `chairs`, `chair_audit_logs` 테이블 추가; `consultation` 수정 (patient_id nullable, chair_id/linked_at/linked_by 추가) |
| `app/actions/chairs.ts` | 체어 CRUD + 체어 기록 CRUD + 환자 연결 + 감사 로그 Server Actions |
| `components/chair/chair-provider.tsx` | Context + useReducer 전역 상태; MediaRecorder ref 보관 |
| `components/chair/chair-buttons.tsx` | 헤더 내 체어 상태 버튼 (idle/recording/has_records 배지) |
| `components/chair/chair-overlay.tsx` | createPortal(body) 다이얼로그; 4단계 상태 UI |
| `components/chair/chair-record-list.tsx` | 미연결 기록 목록 + 삭제 |
| `components/chair/chair-patient-search.tsx` | 환자 검색 + 연결 |
| `components/chair/chair-settings.tsx` | 설정 페이지 체어 관리 (admin/owner) |
| `app/(dashboard)/layout.tsx` 수정 | maxDuration=120, ChairProvider 래핑, ChairOverlay 삽입 |
| `components/layout/header.tsx` 수정 | ChairButtons 추가 |
| `app/(dashboard)/settings/page.tsx` 수정 | ChairSettings 섹션 추가 |
| `lib/types/database.ts` 수정 | ChairRow, ChairAuditLogRow 타입 추가; ConsultationRow 필드 갱신 |
| `supabase/schema.sql` 업데이트 | chairs, chair_audit_logs DDL + RLS; consultation 변경 반영 |
| 빌드 검증 | `npm run build` ✅ 통과 (TypeScript 포함, 19 static pages) |

---

## 2026-05-17 세션 7 작업 내용 (환자 앱 — Google OAuth 가입 + 이중 역할 + 환자 푸시)

| 작업 | 결과 |
|---|---|
| speckit 005 계획 수립 | research.md, data-model.md, contracts/, quickstart.md, plan.md, tasks.md 생성 |
| DB 마이그레이션 | `patient_auth_links`, `patient_push_subscriptions` 테이블 추가 (migration 20260517000002) |
| getPatientSession 업데이트 | OTP 쿠키 → Supabase Google 세션 폴백 지원 |
| /auth/patient-callback | 환자 Google OAuth 전용 콜백 라우트 생성 |
| /portal/signup-cta | OTP 인증 후 상담 미리보기 + Google 가입 CTA 페이지 |
| /portal/link-account | Google 로그인 했지만 환자 계정 미연결 시 안내 |
| PatientSignupCta 컴포넌트 | Google OAuth 가입 버튼 (pending 쿠키 설정 + OAuth 리디렉션) |
| PatientLoginForm 업데이트 | OTP 폼 아래 Google 로그인 버튼 추가 |
| PatientOtpForm 업데이트 | isNewAccount + invitationToken 시 /portal/signup-cta 리디렉션 |
| 직원 헤더 업데이트 | "내 진료 기록" 링크 추가 (/portal/records) |
| /portal/records 업데이트 | PatientPushBanner 추가, "직원 화면" 링크 추가 |
| PatientPushBanner 생성 | 환자용 Web Push 구독 배너 (patient_push_subscriptions 사용) |
| consultations.ts 업데이트 | 상담 저장 시 환자에게도 푸시 알림 fire-and-forget |
| 빌드 검증 | `npm run build` ✅ 통과 |

---

## 2026-05-11 세션 3 작업 내용 (리치 에디터 + 이미지 주석)

| 작업 | 결과 |
|---|---|
| Tiptap 리치 텍스트 에디터 통합 | `components/rich-text-editor.tsx` 생성 — StarterKit + Placeholder, 툴바 (B/I/S/H1~H3/목록/인용/구분선/실행취소) |
| 상담 폼 textarea → RichTextEditor 교체 | `consultation-form.tsx` 수정 |
| 상담 이력 HTML 렌더링 | `consultation-history.tsx` `dangerouslySetInnerHTML` 적용 |
| globals.css rich text 스타일 추가 | Tiptap placeholder + h1~h3/bold/italic/list/blockquote/hr 스타일 |
| `@tiptap/extension-image` 설치 | Tiptap 인라인 이미지 지원 |
| ResizableImage 커스텀 확장 | `ReactNodeViewRenderer` + 모서리 드래그 크기 조절 핸들 |
| 이미지 Supabase Storage 즉시 업로드 | 저장 버튼 누르기 전에 브라우저 클라이언트로 업로드, URL을 HTML에 포함 |
| 이미지 주석 도구 (`ImageAnnotator`) | `components/image-annotator.tsx` — 펜·직선·화살표·사각형·텍스트·지우개, 색상 7종, 두께 3단계, Ctrl+Z, 터치 지원 |
| 이미지 삽입 흐름 통합 | 툴바 버튼 / 드래그 앤 드롭 / Ctrl+V → 주석 도구 → Supabase 업로드 → 에디터 인라인 삽입 |
| 기존 별도 이미지 첨부 섹션 제거 | `consultation-form.tsx` 단순화 |
| 빌드 검증 | `npm run build` ✅ 통과 |

---

## 2026-05-14 세션 5 작업 내용 (어드민 패널 — 기관 전환 + 직원 권한 관리)

| 작업 | 결과 |
|---|---|
| `supabase/migrations/20260514000001_admin_panel.sql` | `institution_members.is_active` 컬럼 추가 (Supabase SQL Editor에서 적용 완료) |
| `lib/admin.ts` 생성 | `isSuperAdmin(email)` 유틸리티 함수 |
| `lib/auth/institution.ts` 재작성 | `getMyInstitutions()`, `getMyInstitutionId()` (쿠키 우선), `getMyInstitution()` |
| `app/actions/admin.ts` 생성 | `switchInstitution`, `getStaffList`, `setStaffActive`, `getAllInstitutions`, `getInstitutionStaff`, `setStaffActiveAsAdmin`, `updateInstitutionName` |
| `components/layout/institution-switcher.tsx` 생성 | 기관 전환 드롭다운 클라이언트 컴포넌트 |
| `components/layout/header.tsx` 수정 | props 교체 (`institutionName` → `institutions`/`activeInstitutionId`), 설정 링크 추가 |
| `app/(dashboard)/layout.tsx` 수정 | `getMyInstitutions()` + `getMyInstitutionId()` 사용, is_active=false 접근 차단 |
| `components/settings/staff-list.tsx` 생성 | 직원 목록 테이블 + is_active 토글 |
| `components/settings/staff-invite-form.tsx` 생성 | 직원 초대 폼 |
| `components/settings/institution-name-form.tsx` 생성 | 기관명 수정 폼 |
| `app/(dashboard)/settings/page.tsx` 생성 | 설정 페이지 (owner: 기관 프로필 + 직원 관리 / admin: 직원 관리 / staff: 안내) |
| `components/admin/institution-list.tsx` 생성 | 기관 목록 + 기관별 직원 펼치기/권한 토글 |
| `app/(dashboard)/admin/page.tsx` 생성 | 최고 관리자 패널 (슈퍼 어드민 전용) |
| 빌드 검증 | `npm run build` ✅ 통과 |

---

## 2026-05-12 세션 4 작업 내용 (Google OAuth 로그인)

| 작업 | 결과 |
|---|---|
| Google 로그인 버튼 추가 | `components/auth/login-form.tsx` — Google 아이콘 버튼, `signInWithOAuth({ provider: "google" })` |
| 온보딩 플로우 구현 | `app/(auth)/onboarding/page.tsx` + `components/auth/onboarding-form.tsx` — 신규 Google 사용자 기관명 입력 |
| `setupInstitution` Server Action | `app/actions/auth.ts` — institution + member 생성, 이미 기관 있으면 스킵 |
| `/auth/callback` 수정 | institution_members 존재 여부 확인 → 없으면 `/onboarding` 리다이렉트 |
| 빌드 검증 | `npm run build` ✅ 통과 |

---

## 2026-05-10 세션 2 작업 내용 (환자 포털 구현)

| 작업 | 결과 |
|---|---|
| solapi 패키지 설치 | v6.0.1 (패키지명: solapi, not @solapi/node-sdk) |
| 마이그레이션 파일 생성 | supabase/migrations/20260510000001_patient_portal.sql (5개 테이블) |
| app/(patient)/ 라우트 그룹 생성 | /p/[token], /portal/login, /portal/verify, /portal/records |
| lib/sms/solapi.ts 생성 | sendSms() 함수 구현 |
| lib/patient-session.ts 생성 | getPatientSession() 함수 구현 |
| 미들웨어 공개 경로 추가 | /p/, /portal/login, /portal/verify |
| DB 타입 추가 | PatientInvitationRow 등 5개 신규 타입 |
| app/actions/patient-portal.ts 생성 | sendPatientInvitation, requestPatientOtp, verifyPatientOtp, getPatientRecords, patientLogout |
| SendInvitationButton 컴포넌트 | 직원용 모달 UI + 동의 체크 |
| PatientLoginForm 컴포넌트 | 주민번호 앞/뒤 + 전화번호 입력 |
| PatientOtpForm 컴포넌트 | 6자리 OTP 입력 |
| PatientRecordsList 컴포넌트 | 상담 카드 펼치기/닫기 |
| 환자 상세 페이지 업데이트 | "환자 포털" 섹션 + SendInvitationButton 추가 |
| DB 마이그레이션 실행 | 사용자가 Supabase SQL Editor에서 직접 실행 완료 |
| 빌드 검증 | npm run build ✅ 통과 |
| 문서 현행화 | architecture.md, database.md, schema.sql, project_status.md 업데이트 |

---

## 2026-05-10 세션 1 작업 내용

| 작업 | 결과 |
|---|---|
| BOM 인코딩 오류 수정 | `SUPABASE_SERVICE_ROLE_KEY` BOM(U+FEFF) 제거 |
| Vercel env var 재설정 | printf로 BOM 없이 production/development 환경변수 재추가 |
| /auth/callback 라우트 추가 | PKCE 이메일 인증 코드 교환 → 자동 로그인 |
| Supabase Site URL 수정 | localhost:3000 → carelog-tau.vercel.app |
| 이메일 인증 수동 처리 | SQL로 email_confirmed_at 직접 설정 |
| 기존 데이터 기관 귀속 | patient 1건, consultation 8건 → 예미안치과로 UPDATE |
| 전체 동작 검증 | 로그인 + 환자 검색 정상 확인 |
| 문서 현행화 | architecture.md, database.md, schema.sql, tasks.md 전면 업데이트 |

---

## 알려진 이슈 / 남은 작업

| 이슈 | 심각도 | 상태 |
|---|---|---|
| Solapi 실제 API 키 미설정 | 높음 | ⏳ .env.local과 Vercel에 실제 키 입력 필요 |
| Google OAuth 외부 설정 미완료 | 높음 | ⏳ Google Cloud Console + Supabase Dashboard 설정 필요 (아래 참조) |
| NEXT_PUBLIC_SITE_URL 환경변수 미설정 | 낮음 | Vercel에 https://carelog-tau.vercel.app 추가 권장 |
| spec 002 quickstart 시나리오 수동 검증 | 낮음 | ⏳ Solapi 키 설정 후 전체 흐름 테스트 필요 |
| 어드민 패널 DB 마이그레이션 | 완료 | ✅ 20260514000001_admin_panel.sql 적용 완료 |
| **chair_quick_record DB 마이그레이션** | 높음 | ⏳ 20260526000001_chair_quick_record.sql Supabase에 적용 필요 |
| **activity_log_patient_sync 마이그레이션** | — | ✅ 20260601000001 적용 완료 (세션 13) — 최근 활동 환자 연결 동기화 + 기존 줄바꿈 변환 |
| Vercel Preview 환경 VAPID 미설정 | 낮음 | dev/Preview 빌드는 코드 가드로 통과하나 Preview에서 푸시는 비활성. 필요 시 Vercel Preview 스코프에 VAPID_* 추가 |
| **EO 연동 마이그레이션 적용** | — | ✅ `20260608000001_eo_integration.sql` Supabase 적용 완료 (세션 17) — clinic_members EO 컬럼 + consultation 작성자 컬럼 |
| **`CARELOG_GATEWAY_SECRET` 양쪽 Vercel 등록** | 높음 | ⏳ EO·Carelog 양쪽에 동일 시크릿 등록 전까지 게이트웨이 동기화는 config 사유로 조용히 스킵됨 |

---

## 다음 우선순위

1. **chair_quick_record DB 마이그레이션 적용** — Supabase SQL Editor에서 `supabase/migrations/20260526000001_chair_quick_record.sql` 실행
2. **체어 기록 기능 수동 검증** — 헤더 A/B/C 버튼 → 녹음 → AI 변환 → 환자 연결 전체 흐름
3. **Google OAuth 외부 설정** — Google Cloud Console + Supabase Dashboard 설정 (아래 설명 참조)
4. **Solapi 계정 생성** + 발신번호 등록 후 `.env.local` 및 Vercel에 API 키 입력
5. **spec 002 quickstart 7개 시나리오** 수동 검증 (환자 포털 전체 흐름)

### Google OAuth 설정 가이드

**1. Google Cloud Console**
- console.cloud.google.com → 프로젝트 선택 또는 생성
- APIs & Services → OAuth consent screen → External → 앱 정보 입력
- APIs & Services → Credentials → Create Credentials → OAuth client ID
  - Application type: Web application
  - Authorized redirect URIs:
    - `https://svffiungfijiybvrrnpu.supabase.co/auth/v1/callback`
- Client ID와 Client Secret 복사

**2. Supabase Dashboard**
- supabase.com → 프로젝트 → Authentication → Providers → Google
- Client ID와 Client Secret 붙여넣기 → Save

---

## 중장기 로드맵

| Phase | 내용 | 상태 |
|---|---|---|
| Phase 1 | 직원 로그인 + 기관 계정 + RLS | ✅ 완료 |
| Phase 2 (spec 002) | 환자 포털 — SMS 초대 + OTP 가입 + 상담 조회 | ✅ 완료 (Solapi 키 입력 대기) |
| Phase 2.5 | 리치 에디터 + 인라인 이미지 + 주석 도구 | ✅ 완료 |
| Phase 3 (spec 003) | 어드민 패널 — 기관 전환 + 직원 권한 관리 + 최고 관리자 | ✅ 완료 |
| Phase 4 | 콘텐츠 블록 모델 + Audit log | 미착수 |
| Phase 4 | AI 기능 (오디오 전사, 상담 요약) | ✅ 체어 기록 통해 구현 완료 |
| Phase 5 (spec 006) | 체어 즉시 기록 — 헤더 오버레이 + 환자 연결 + 감사 로그 | ✅ 완료 |

---

## 개발 원칙

모든 기능 개발은 Spec-Driven Development:
`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`

Constitution: `.specify/memory/constitution.md` (v1.1.0)

## 인프라 현황

| 항목 | 값 |
|---|---|
| 배포 URL | https://carelog-tau.vercel.app |
| Supabase 프로젝트 | svffiungfijiybvrrnpu |
| Supabase Site URL | https://carelog-tau.vercel.app |
| Redirect URLs | https://carelog-tau.vercel.app/**, http://localhost:3000/** |
| DB 마이그레이션 적용 완료 | 20260509000001_staff_auth_institution.sql, 20260510000001_patient_portal.sql |
