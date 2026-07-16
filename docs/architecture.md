# 시스템 아키텍처

## 개요

Carelog는 Next.js App Router 기반의 풀스택 웹 앱입니다.
클라이언트는 UI 렌더링만 담당하고, 모든 데이터 처리는 Server Actions를 통해 서버에서 수행됩니다.
Supabase Auth + 기관(institution) 단위 다중 테넌트 구조를 채택합니다.

```
브라우저 (Client Components)
    │  form submit / server action call
    ▼
proxy.ts (Next.js 16 미들웨어) ─── 세션 갱신 + 미인증 리다이렉트
    │
    ▼
Next.js Server Actions  ←→  Supabase (PostgreSQL + Auth)
    │
    ▼
Vercel Edge / Serverless 환경
```

## 디렉터리 구조

```
app/
├── (auth)/                        # 공개 라우트 그룹 (로그인 불필요)
│   ├── layout.tsx                 # 중앙 정렬 래퍼
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── onboarding/page.tsx        # Google OAuth 신규 사용자 기관명 등록
│   └── invite/[token]/page.tsx    # 직원 초대 수락
├── (dashboard)/                   # 인증 필요 라우트 그룹
│   ├── layout.tsx                 # 미인증 시 /login 리다이렉트 + 기관명 헤더
│   ├── page.tsx                   # 홈 (환자 검색 + 등록)
│   ├── patients/
│   │   └── [patientId]/page.tsx  # 환자 상세 + 상담 이력
│   └── view/
│       └── [consultationId]/page.tsx  # 상담 기록 상세
├── auth/
│   ├── callback/route.ts          # 직원 Google OAuth PKCE 코드 교환
│   └── patient-callback/route.ts  # 환자 Google OAuth 콜백 → patient_auth_links 연결
├── (patient)/                     # 환자 포털 라우트 그룹
│   ├── layout.tsx                 # 패스스루 (세션 체크는 개별 페이지)
│   ├── p/[token]/page.tsx         # SMS 초대 링크 — 주민번호+전화번호 입력
│   └── portal/
│       ├── login/page.tsx         # 재방문 환자 로그인 (OTP + Google 버튼)
│       ├── verify/page.tsx        # OTP 입력
│       ├── signup-cta/page.tsx    # OTP 완료 후 상담 미리보기 + Google 가입 CTA
│       ├── link-account/page.tsx  # Google 로그인 후 계정 미연결 시 안내
│       └── records/page.tsx       # 상담 내역 조회 (OTP 세션 OR Google 세션)
├── actions/
│   ├── auth.ts                    # signUp, signIn, signOut, setupInstitution
│   ├── institutions.ts            # getMyInstitution, inviteStaff, acceptInvitation
│   ├── patients.ts                # 환자 CRUD, 검색 (institution_id 필터)
│   ├── consultations.ts           # 상담 기록 CRUD + 환자 푸시 fire-and-forget
│   ├── chairs.ts                  # 체어 CRUD, 체어 임시 기록, 환자 연결, 검색, 감사 로그
│   ├── push.ts                    # subscribePush, unsubscribePush, sendPushToInstitution (직원 Web Push)
│   └── patient-portal.ts          # 환자 포털 Server Actions (초대·OTP·Google가입·환자푸시)
├── globals.css
└── layout.tsx                     # HTML/body/fonts 쉘만 포함

components/
├── auth/
│   ├── login-form.tsx             # 이메일+비밀번호 로그인 폼 + Google 로그인 버튼
│   ├── signup-form.tsx            # 이메일+비밀번호+기관명 가입 폼
│   └── onboarding-form.tsx        # Google 신규 사용자 기관명 입력 폼
├── chair/
│   ├── chair-provider.tsx         # ChairProvider (Context + useReducer) — 체어 전역 상태, MediaRecorder refs, 녹음 엔진(engine/setEngine·labEnabled) 공유
│   ├── consult-hero.tsx           # 홈 히어로 — record-first 진입점("상담 기록 시작"=즉시 녹음). 실험실이면 시작 버튼 위 EngineSelector 노출
│   ├── consultation-board.tsx     # 상담보드(DRAFT_CHAIR_KEY) — 녹음·전사·본문·체어·참여자·처방·저장. idle 폴백으로 EngineSelector
│   ├── engine-selector.tsx        # 녹음 엔진 픽커(기본/빠른메모/상세요약/용어보정/긴상담/다국어/비교) — 줄바꿈 pill, 히어로·보드 공용, context engine 사용
│
├── records/
│   └── records-browser.tsx        # 상담 기록 전체 열람·검색·필터(spec 011) — searchConsultations 호출, 날짜그룹·접이식 카드·전체복사. /records 페이지에서 사용
# (참고) app/(dashboard)/records/page.tsx = 전체보기 화면, consultations.searchConsultations(통합 검색),
#        consultation-history.tsx = 환자상세 접이식+환자내 검색(A6). 홈 home-feed '전체보기·검색'→/records.
│   ├── chair-overlay.tsx          # 체어 기록 다이얼로그 (createPortal → body); 현재 세션 녹음/편집 전용
│   ├── chair-patient-search.tsx   # 환자 검색 + linkChairRecordToPatient + 인라인 신규 등록
│   ├── chair-settings.tsx         # 설정 페이지 내 체어 관리 (admin/owner 전용)
│   ├── quick-record-trigger.tsx   # 홈 화면 빠른 기록 시작 버튼 + 위치 선택 UI
│   └── prescription-picker.tsx    # 컴팩트 처방 칩 선택 컴포넌트 (오버레이·통합 피드 공용)
├── home/
│   └── home-feed.tsx              # 홈 통합 피드 — 미연결 기록(액션 카드) + 최근 활동(연결 로그)을 시간순 병합, 토글로 함께/하나씩
├── layout/
│   ├── header.tsx                 # 기관명 + RefreshButton + 프로필 드롭다운
│   ├── refresh-button.tsx         # router.refresh() 클라이언트 컴포넌트
│   ├── institution-switcher.tsx   # 복수 기관 전환 드롭다운
│   └── session-refresher.tsx      # onAuthStateChange 리스너 (SIGNED_OUT → /login)
├── patient/
│   ├── send-invitation-button.tsx # 직원용: 환자 초대 문자 발송 버튼+모달
│   ├── patient-login-form.tsx     # 환자용: 주민번호+전화번호 입력 폼 + Google 로그인 버튼
│   ├── patient-otp-form.tsx       # 환자용: OTP 입력 폼 (isNewAccount 기반 리디렉션)
│   ├── patient-records-list.tsx   # 환자용: 상담 내역 목록 (펼치기/닫기)
│   ├── patient-signup-cta.tsx     # 환자용: Google OAuth 가입 버튼 (pending 쿠키 설정)
│   └── patient-push-banner.tsx    # 환자용: 새 진료 기록 Web Push 구독 배너
├── patient-home.tsx               # 검색 UI + 새 환자 등록 버튼
├── patient-form.tsx               # 새 환자 등록 폼
├── patient-edit-form.tsx          # 환자 정보 수정 모달
├── footer.tsx                     # SUWANT holdings Inc. 푸터
├── push-notification-banner.tsx   # 홈 화면 푸시 알림 수신 동의 배너
├── consultation-form.tsx          # 상담 기록 작성 폼 (처방 메모 포함)
├── consultation-history.tsx       # 상담 이력 목록 (HTML 렌더링)
├── rich-text-editor.tsx           # Tiptap 리치 텍스트 에디터 (인라인 이미지·주석 포함)
├── image-annotator.tsx            # 이미지 주석 캔버스 모달 (펜·직선·화살표·사각형·텍스트·지우개)
├── station-manager.tsx            # 체어 번호 설정
└── ui/
    └── dropdown-menu.tsx          # Radix UI 드롭다운 래퍼

lib/
├── supabase/
│   ├── client.ts                  # 브라우저용 Supabase 클라이언트
│   ├── server.ts                  # 서버용 Supabase 클라이언트 (쿠키 기반)
│   ├── middleware.ts              # updateSession() — proxy.ts에서 호출
│   ├── admin.ts                   # Service Role 클라이언트 (RLS 우회, 서버 전용)
│   └── config.ts                  # 테이블명·버킷명 환경변수 매핑
├── sms/
│   └── solapi.ts                  # sendSms(to, text) — Solapi SDK 래퍼
├── eo/                            # EO↔Carelog 연동 (카드 235, HTTP 전용·강결합 금지)
│   ├── gateway.ts                 # fetchEoMaster() — EO 마스터 게이트웨이 클라이언트(x-gateway-secret)
│   └── sync-master.ts             # syncEoMaster() — EO 직원 마스터 → clinic_members 캐시 동기화(admin client)
├── auth/
│   └── institution.ts             # getMyInstitutionId(), getMyInstitution(), getMyAuthorInfo() React.cache
├── types/
│   └── database.ts                # PatientRow, ConsultationRow, PatientInvitationRow 등 타입
├── patient-session.ts             # getPatientSession(cookies) — OTP 세션 OR Google 세션 폴백
├── patient-search.ts              # ilike 쿼리 유틸 (escapeIlike, fragments)
├── rrn-core.ts                    # 주민번호 파싱·정규화·검색 패턴
├── rrn-hash.ts                    # 주민번호 SHA-256 해시 (중복 방지용)
├── station-storage.ts             # 로컬스토리지 체어 번호 관리
└── utils.ts                       # 공통 유틸

proxy.ts                           # Next.js 16 미들웨어 진입점 (middleware.ts 대체)
public/
├── sw.js                          # Service Worker (Web Push 수신 + 기본 캐시)
└── icons/
    ├── icon-192.png               # PWA 아이콘 192×192
    └── icon-512.png               # PWA 아이콘 512×512 (maskable)
app/
└── manifest.ts                    # Web App Manifest (Next.js 16 방식)
supabase/
├── migrations/
│   ├── 20260509000001_staff_auth_institution.sql  # 기관 구조 + RLS 마이그레이션
│   ├── 20260510000001_patient_portal.sql          # 환자 포털 5개 테이블
│   ├── 20260517000001_push_subscriptions.sql      # 직원 Web Push 구독 정보
│   ├── 20260517000002_patient_auth_links.sql      # 환자 Google OAuth 연결 + 환자 푸시 구독
│   ├── 20260526000001_chair_quick_record.sql      # chairs, chair_audit_logs 테이블 + consultation 수정
│   ├── 20260607000001_clinic_members.sql          # clinic_members 디렉터리 + consultation.participants
│   └── 20260608000001_eo_integration.sql          # EO 마스터 캐시(clinic_members) + SSO/작성자 귀속 컬럼
└── schema.sql                     # 전체 스키마 (참조용)
```

app/api/ 라우트 핸들러:
```
app/api/
├── auth/sso/route.ts              # EO SSO 진입 — JWT 검증 → 세션 생성 + institutions UPSERT(완전자동: EO 자체발급 id 첫 SSO 시 {id,name} 생성, 있으면 보존) + institution_members(eo_employee_id·display_name)
├── cron/sync-master/route.ts      # Vercel Cron(10분) — 전 기관 syncEoMaster 폴링(미연동 404 스킵)
└── health/route.ts                # 헬스체크 (edge)
```

## 인증 흐름

```
1. 회원가입 (/signup)
   SignupForm → signUp(formData)
     → supabase.auth.signUp({ email, password, emailRedirectTo: /auth/callback })
     → admin client: institutions INSERT → institution_members INSERT (role: owner)
     → 이메일 인증 메일 발송
     → needsConfirmation: true → "이메일을 확인해 주세요" 안내

2. 이메일 인증
   확인 링크 클릭
     → /auth/callback?code=XXX
     → supabase.auth.exchangeCodeForSession(code)
     → 세션 쿠키 설정 → / 리다이렉트

3. 로그인 (/login)
   LoginForm → signIn(formData)
     → supabase.auth.signInWithPassword()
     → redirect('/')

   또는 Google 로그인
   LoginForm → signInWithOAuth({ provider: "google" })
     → Google 인증 → /auth/callback?code=XXX
     → institution_members 존재 여부 확인
       있으면 → / 리다이렉트
       없으면 → /onboarding 리다이렉트
   OnboardingForm → setupInstitution(institution_name)
     → 기관명 중복 검사(ilike, 대소문자 무시) → admin client: institutions INSERT
     → institution_members INSERT (role: owner) → redirect('/')
     (signUp 경로도 동일하게 auth 유저 생성 전 기관명 중복 차단)

   ※ 온보딩 트랩 방지(/auth/callback): 멤버가 없을 때 곧장 /onboarding으로 보내지 않고,
     대기 중(미수락·미만료) 직원 초대가 있으면 /invite/{token}(수락 동선)으로 보낸다.
     초대받은 사람이 로그인하다 엉뚱한 새 워크스페이스를 만드는 문제를 막는다.

3-1. 직원 초대 (설정 → StaffInviteForm → inviteStaff)
   - 이미 auth 계정이 있는 이메일 → institution_members 즉시 추가(즉시 직원 등록,
     비활성 멤버는 재활성화). inviteUserByEmail은 신규 전용이라 기존 계정엔 안 씀.
   - 신규 이메일 → institution_invitations INSERT + inviteUserByEmail(메일, redirectTo=/invite/token).
     메일 실패 시 방금 만든 초대 row 롤백(dangling 방지).
   - /invite/{token} → acceptInvitation → institution_members INSERT(초대 role) → accepted_at 기록

3-2. 직원 관리 (설정 → StaffList, owner/admin 전용)
   - setStaffActive: is_active 토글(비활성 시 접근 회수, 로그인 자체는 가능)
   - changeStaffRole: staff ↔ admin 역할 변경
   - removeStaff: institution_members 행 삭제(기관에서 완전 제거, 재초대 가능)
   - 공통 가드: 자기 자신·기관 대표(owner)·슈퍼어드민 계정은 변경/제거 불가, 마지막 owner 비활성 차단

4. 세션 유지
   proxy.ts → updateSession()
     → supabase.auth.getUser() → 쿠키 갱신
     → 미인증 + 비공개 경로 → /login 리다이렉트

5. 로그아웃
   Header signOut 버튼 → signOut()
     → supabase.auth.signOut() → redirect('/login')
```

## 다중 테넌트 데이터 격리

```
모든 patient / consultation 레코드는 institution_id 보유

Server Action 호출 시:
  getMyInstitutionId()   ← React.cache로 요청당 1회 쿼리
    → institution_members WHERE user_id = auth.uid()
    → institution_id 반환

쿼리 예시:
  supabase.from('patient')
    .select('*')
    .eq('institution_id', institutionId)   ← 기관 필터

RLS 이중 보호:
  get_my_institution_id() DB 함수 → policy WHERE institution_id = 함수()
```

## 메뉴·권한 구조 (3-tier)

권한 3단으로 메뉴를 필터링한다 (EO 메뉴 구조 참고 — 카드 481):

| tier | 식별 | 영역 |
|---|---|---|
| 사용자(staff) | `role='staff'` | 본인 작업·알림 |
| 고객사 관리자 | `role in (owner,admin)` | **내 워크스페이스** 운영설정 = `/settings`(요금제·기관·체어·멤버) |
| 플랫폼 운영진 | `isSuperAdmin()` | **전체 고객사** 총괄 = `/admin`(슈퍼어드민: 전 기관·직원·실험실 토글) |

**설정 ↔ 슈퍼어드민 경계 = 데이터 범위.** "한 기관 안에서만 의미" → 설정 / "여러 기관에 걸치거나 플랫폼이 고객사를 관리" → 슈퍼어드민. 새 메뉴 추가 시 이 기준으로 배치한다.

프로필 드롭다운: **권한자 전용(슈퍼어드민) 위 · 전원 공통(상담기록·설정·서비스소개) 아래**의 2분할. 슈퍼어드민 진입점은 `isSuperAdmin` 계정에만 노출.

## UX 원칙

### 환자 상세 페이지 (`/patients/[patientId]`)

**이 페이지는 직원과 환자가 함께 보는 화면입니다.**

- 상담 내용, 처방 메모, 첨부 사진이 그대로 노출됩니다
- 환자가 동석한 상태에서 직원이 상담을 기록하고 그 내용을 함께 확인하는 흐름입니다
- 따라서 상담 내용은 환자가 읽었을 때 이해 가능한 언어와 형식으로 작성되어야 합니다
- "상담 공유" 버튼(환자 포털 초대)도 이 페이지에 위치한 이유가 여기에 있습니다 — 상담을 마친 직후 바로 발송하는 흐름

**개발 시 유의사항:**
- 이 페이지에 추가하는 모든 UI 요소는 환자가 봐도 무방한 정보여야 합니다
- 직원 전용 내부 메모가 필요하다면 별도 필드(비공개 메모)로 분리해야 합니다
- 상담 내용의 서식(굵기, 줄바꿈 등)이 환자에게도 그대로 전달됩니다

---

## 데이터 흐름

### 환자 검색
```
PatientHome (Client)
  → searchPatients(query) [Server Action]
    → getMyInstitutionId() → .eq('institution_id', id)
    → Supabase .or([name, phone, chart_no, resident_no ilike])
    → 클라이언트 사이드 스코어 기반 재정렬
  → 결과 리스트 렌더
```

### 상담 기록 작성
```
ConsultationForm (Client)
  → RichTextEditor (Tiptap)
      → 이미지 삽입 (툴바 버튼 / 드래그 앤 드롭 / Ctrl+V 붙여넣기)
        → ImageAnnotator (캔버스 주석 모달)
          → 주석 완료 → Supabase Storage 즉시 업로드 (브라우저 클라이언트)
          → 반환된 publicUrl을 에디터에 <img> 태그로 삽입
      → 텍스트 + 이미지가 섞인 HTML 생성 (content 상태)
  → saveConsultation(patientId, content, formData) [Server Action]
    → getMyInstitutionId() → institution_id 포함 INSERT
    → content(HTML), image_urls([] — 이미지는 HTML에 포함), prescriptions, station_name 저장
    → revalidatePath('/patients/[id]')
    → 성공 시 { ok, mode } 반환 (redirect 안 함) → 폼이 토스트 표시 + clear + router.refresh()
```

**이미지 저장 방식 변경 이력**
- 구버전: 이미지를 별도 `image_urls` JSONB 배열로 분리 저장, 상담 이력에서 별도 갤러리 표시
- 현재: 이미지가 HTML content 안에 `<img src="supabase-url">` 태그로 인라인 포함
- `image_urls` 컬럼은 구버전 데이터 호환을 위해 유지 (신규 상담은 `[]`)

### 주민번호 처리
```
입력 (앞 6자리 + 뒤 7자리)
  → mergeResidentNoParts() → rrn-core.ts
  → normalizeFullResidentNo() → "XXXXXX-XXXXXXX" 형식
  → hashResidentNoForMatching() → SHA-256 해시 (resident_no_hash 컬럼)
  → DB 저장: resident_no (원본), resident_no_hash (중복방지 unique index)
  → UI 표시: maskResidentNo() → "880101-1******"
```

## 환자 포털 인증 흐름

환자 포털은 Supabase Auth와 완전 분리된 자체 세션 시스템을 사용합니다.

```
[직원] 환자 상세 → "상담 공유" 버튼 → SendInvitationButton (모달)
  → sendPatientInvitation() [Server Action]
    → patient_invitations INSERT (72시간 유효 토큰)
    → sendSms() → Solapi API → 환자 전화번호로 SMS 발송
    → 문자 내용: "[기관명] 상담 내역 확인: {site}/p/{token}"

[환자] SMS 링크 클릭 → /p/[token]
  → 초대 유효성 확인 (만료/수락 체크)
  → PatientLoginForm: 주민번호 앞6 + 뒤7 + 전화번호 입력

  → requestPatientOtp() [Server Action]
    → hashResidentNoForMatching(rrnFront+rrnBack) → rrnHash
    → patient.resident_no_hash 대조 (본인 확인)
    → patient_otps INSERT (6자리 코드, 5분 만료)
    → sendSms() → OTP 발송
    → 반환: { ok: true, rrnHash }

  → /portal/verify?phone=...&rrn_hash=...&token=...
  → PatientOtpForm: 6자리 코드 입력

  → verifyPatientOtp() [Server Action]
    → OTP 유효성 검증 (만료, attempt_count < 3, 코드 일치)
    → patient_accounts SELECT/INSERT WHERE rrn_hash = rrnHash
    → patient_sessions INSERT → patient_session_token 쿠키 설정 (30일 HttpOnly)
    → invitation_token 있으면: patient_account_links INSERT + accepted_at 업데이트

  → /portal/records
  → getPatientSession() → patient_sessions 조회 → 만료 체크
  → getPatientRecords() → patient_account_links → consultations JOIN institutions
  → PatientRecordsList: 기관명·날짜·내용·사진·처방메모 표시
```

### 환자 세션 검증
```
환자 요청 → /portal/records
  → getPatientSession(cookieStore)
    → patient_session_token 쿠키 읽기
    → admin client: patient_sessions WHERE token = ? AND expires_at > now()
    → 없거나 만료 → redirect('/portal/login')
    → 있으면 → { patientAccountId } 반환
```

### 체어 즉시 기록 (Chair Quick Record)

```
ChairProvider (Context + useReducer, MediaRecorder refs in useRef)
  ── 대시보드 layout 전체 래핑 → 페이지 이동에도 상태 유지
  ── props: initialChairs · members(clinic_members) · me(작성자 표시명, 참여자 '나')
  ── DRAFT_CHAIR_KEY="__draft__": 체어 없이 녹음하는 record-first 예약 세션 키
       (chairs.find(id===KEY) 미스 → per-chair 오버레이는 무반응, 상담보드만 이 키로 열림)

app/(dashboard)/page.tsx (홈 화면)
  ├── ConsultHero (Client) — 최상단 히어로 (record-first 진입)
  │     ── "상담 기록 시작" CTA 클릭 → openOverlay(DRAFT) + startRecording(DRAFT)
  │          (체어·참여자 선택 없이 즉시 녹음 — 같은 클릭 제스처로 getUserMedia)
  │
  └── HomeFeed (Client) — 미연결 기록 + 최근 활동 통합 피드
        ── getAllUnlinkedRecords()(미연결, 액션 카드) + getActivityLogs()(연결 완료 로그)
           두 집합은 상호 배타(같은 상담이 미연결→연결 단계로 이동) → created_at 시간순 병합
        ── 상단 토글 칩(미연결/활동): 둘 다(시간순) · 하나씩
        ── 미연결 카드: 체어 배지 + 미리보기 + 인라인 편집(RichTextEditor+PrescriptionPicker)
              + 환자 연결(ChairPatientSearch→linkChairRecordToPatient) + 삭제(deleteChairRecord)
        ── 연결 시 reload + router.refresh로 '활동' 쪽 동기화
        ── 활동 행: 환자명 + 미리보기, 클릭 시 /patients/[id]#consultation-[cid]

ConsultationBoard (Client, createPortal → document.body) — record-first 통합 보드 (spec 008)
  ── openChairId === DRAFT_CHAIR_KEY 일 때 렌더 (layout에 상시 마운트 → 작성 내용 보존 FR-016)
  ── 상단 녹음바: idle [녹음 시작] / recording 타이머+[중지] / processing 스피너 (보드 닫아도 녹음 지속)
  ── 본문: RichTextEditor (인라인 이미지 + ImageAnnotator 그림 주석) — 전사 결과 합류·편집
  ── 체어: 칩 선택 + 직접 입력(getOrCreateChairByName), 마지막 체어 기본 선택(lib/chair/last-chair)
  ── 참여자: ParticipantPicker (검색·'나' 자동·최근순·역할 후순위)
  │     └── getRecentParticipants() — 최근 consultation.participants distinct(최근순)
  ── 처방: PrescriptionPicker
  ── [저장] → saveChairRecord({chairId, content, participants, prescriptions}) → draft reset + refresh
  ── [버리기] = draft reset(확인 다이얼로그) / 닫기 = 보존
  ── 유실 가드(C-01): 미저장 시 beforeunload 경고 + IndexedDB 임시영속화(lib/chair/draft-store)
  │     └── 1초 디바운스 자동저장(본문·처방·참여자·체어·음성 blob, 24h 만료) → 재진입 시 복구 배너
  ── 실시간 진행 현황(C-05 1단계): 작성 중 3초마다 broadcast(lib/realtime/board-live)
  │     └── LiveSessionsBanner(홈)가 "△△님이 □ 체어에서 작성 중" 표시 — 메타만(본문 PII 제외)

ChairOverlay (Client, createPortal → document.body) — per-chair 진입(체어 칩에서 직접)
  ── 현재 세션 녹음/편집 전용. idle/recording/processing/has_records 4상태
  ── recording: overlay 닫아도 백그라운드 녹음 유지. (record-first 흐름은 ConsultationBoard 사용)

app/(dashboard)/patients/[patientId]/page.tsx
  └── ConsultationHistory → RelinkControls (체어 기록에만 표시)
        ── "다른 환자로 재연결" → relinkChairRecord({ consultationId, newPatientId })
        ── "미연결로 되돌리기" → unlinkChairRecord({ consultationId })
              ── patient_id = null 복원 + chair_audit_logs INSERT (patient_unlinked)

app/(dashboard)/layout.tsx
  └── export const maxDuration = 120  ← Server Action 타임아웃 (transcription용)
```

**체어 기록 저장 흐름**
일시정지(세션 63): `pauseRecording(chairId)`/`resumeRecording(chairId)` — `MediaRecorder.pause()/resume()`로
  스트림·누적 chunks 유지한 채 수집만 멈춤. status `"paused"`. 청크 모드는 segmentTimer 함께 정지/복원.
  UI는 consultation-board·chair-overlay 녹음 바 토글. 타이머 freeze, paused도 미저장 진행 중 취급.

```
handleStopRecording()
  → stopRecording(chairId) → Blob (MediaRecorder chunks)
  → transcribeChairAudio(formData, engine) [Server Action]
      → getMyInstitutionLab(): 비-lab이면 engine='basic' 강제(사고 차단)
      → transcribeEngine(formData, mode) → runs[]
          basic        : Whisper(ko) + Claude 요약
          quick        : Whisper(ko)만(요약 생략)
          detailed     : Whisper(ko) + Claude 구조화 상세 요약
          dental       : Whisper(ko) + Claude 치과 용어 교정·요약
          multilingual : Whisper(자동감지) + Claude 번역·요약 (원문/번역/요약). 실패 시 basic 폴백
          comparison   : basic + multilingual 동시 → 보드에서 한쪽 선택
  → setTranscriptionResult(chairId, run.summary) / insertText(run.insertText)

  ◆ chunk(긴 상담, spec 010 + 점진 전사 spec 016) — 클라이언트 오케스트레이션:
    녹음: chair-provider가 CHUNK_SEGMENT_MS(5분)마다 MediaRecorder stop→restart로
          유효 webm 구간 blob 배열 생성 → stopRecordingChunked(chairId): Promise<Blob[]>
    ★점진 전사(spec 016): 청크 onstop이 구간 push 직후 onSegmentReady(seg,index) 통지.
          보드가 녹음 시작 시 registerSegmentHandler로 등록 → 구간 완료 즉시 백그라운드 전사
          (liveTextsRef/liveTasksRef 누적). 종료 시 finalizeChunked가 진행 중 작업 대기 +
          누락 구간 안전망 전사 → 종료 후 대기가 "전체 전사"→"마지막 구간+요약"으로 단축.
          기존 일괄 transcribeSegments는 복구(applyRecover) 전용. 요약·삽입은 finishChunkTexts 공용.
    전사(복구 경로): 구간별 transcribeSegment(formData)(동시성 CHUNK_CONCURRENCY=3,
          실패 1회 재시도, 실패 격리) → 성공 전사문 순서대로 join
    요약: summarizeChunkTranscript(join) [Server Action] 1회 → 전체 맥락 요약
    진행률: chunkProgress(done/total) "n/m 구간 전사 중". 실패 구간은 본문에 표시.
    보관: 구간 concat 단일 blob을 uploadConsultationAudio(기존 단일 경로, 스키마 불변)
    복구: draft-store BoardDraft.audioSegments[]로 영속화 → applyRecover가 구간 재전사
    ※ transcribeSegment/summarizeChunkTranscript도 getMyInstitutionLab 게이트(lab 전용)
  ※ 공유 타입·상수: lib/transcribe/engines.ts (LAB_ENGINE_OPTIONS, CHUNK_* 상수) — "use server" 파일은
    async 함수만 export 가능하므로 런타임 상수는 일반 모듈에 분리.

handleStopAndSave() — "상담 종료 및 저장"(spec 020 서버 비동기 전사)
  → 음성(청크면 이어붙임)만 서버로: enqueueServerTranscription(FormData{audio,chairId,engine,prescriptions,participants,prefixHtml})
      → 플레이스홀더 상담 '🎙️ 전사 중' 즉시 생성 + uploadConsultationAudio(audio_path) + transcription_jobs(pending) 등록
      → 보드 즉시 종료·정리. 탭 닫기·폰 잠금 무관(서버가 처리).
  → 워커 cron /api/cron/process-transcriptions(매 분): pending 원자 클레임 → 음성 다운로드 →
      runServerTranscription(세션 없이, transcribe.ts) → consultation.content 갱신 → job done →
      deductCredit(institution·created_by 기준 토큰) → 완료 알림(sendNotification recipients:'all'). 3회 재시도 후 error.
  → 등록 실패: IndexedDB 임시본 보존 + 안내 + reportAutoSaveFailure(서버 로그). '상담 종료'로 재시도 가능.
  ※ 클라 자동저장(spec 016 doAutoSave/autoSaveRef) 코드는 잔존하나 이 버튼은 서버 위임으로 대체됨.

handleSave()  — "상담 종료"(전사만) 후 수동 저장
  → saveChairRecord({ chairId, content, prescriptions, transcriptionEngine }) [Server Action]
      → consultation INSERT (patient_id: null, status: 'draft', chair_id, transcription_engine)
      → chair_audit_logs INSERT (record_created)
      → revalidatePath('/')

환자 연결
  → linkChairRecordToPatient({ consultationId, patientId }) [Server Action]
      → patient_id / status='confirmed' / linked_at / linked_by 업데이트
      → chair_audit_logs INSERT (patient_linked, patient_id_before/after)
      → revalidatePath('/patients/[id]')

연결 해지 / 재연결 (환자 상세 페이지에서)
  → unlinkChairRecord({ consultationId })
      → patient_id = null, status='draft', linked_at/by = null
      → chair_audit_logs INSERT (patient_unlinked)
  → relinkChairRecord({ consultationId, newPatientId })
      → patient_id 교체, status='confirmed', linked_at/by 갱신
      → chair_audit_logs INSERT (patient_relinked, patient_id_before/after)
```

### EO ↔ Carelog 연동 (카드 235 — 계약: EO spec-016 / 카드#226)

> 원칙: **EO = 직원·클리닉 마스터의 SSOT.** Carelog는 받아 캐시(읽기 사본). 강결합 금지(HTTP만).
> **의료데이터(상담)는 게이트웨이로 절대 나가지 않는다** — 상담 EO API는 만들지 않음(계약 §4).

```
① 마스터 게이트웨이 (직원·클리닉 마스터를 EO에서 pull)
  Vercel Cron(10분) → GET /api/cron/sync-master   (CRON_SECRET Bearer 보호)
    → 전 기관 순회: syncEoMaster(institution_id)
        → fetchEoMaster()  [lib/eo/gateway.ts]
            → GET {EO_APP_URL}/api/gateway/carelog/master?institution_id=…
              Header: x-gateway-secret: CARELOG_GATEWAY_SECRET (서버-서버)
            → 200 정상 / 404 미연동(스킵) / 401 시크릿불일치(설정) / 500 재시도
        → clinic_members 캐시 갱신 (admin client, RLS 우회)  [lib/eo/sync-master.ts]
            · members[]를 eo_employee_id 키로 upsert (source='eo')
            · 응답에 없는 EO-source 행 → is_active=false
            · source='manual' 행은 절대 건드리지 않음 (수동 추가분 보호)
            · active=false(퇴사)·is_draft=true(미승인) → is_active=false

② SSO 보정 (EO 로그인 → Carelog 세션)
  "케어로그 열기" → GET /api/auth/sso?token=<JWT>
    → JWT 검증(HS256, CARELOG_SSO_SECRET) + exp(60초)
    → 확장 클레임 수용: employee_id·name·account_type·eo_role
    → institution_members 멤버십:
        · 신규  → role=mapEoRole(eo_role)  (clinic_admin→admin, 그 외 staff) + eo_employee_id·display_name
        · 기존  → role 불변, eo_employee_id·display_name만 갱신 (수동 권한 보호)
    → EO lazy 동기화 best-effort (syncEoMaster, 로그인 흐름 비차단)
    → magiclink token_hash → /auth/callback → Carelog 세션 확립

③ 작성자 귀속 (상담은 Carelog 내부에만 저장)
  saveConsultation / saveChairRecord
    → getMyAuthorInfo()  [lib/auth/institution.ts]
        → 세션 멤버의 eo_employee_id·display_name (없으면 이메일 폴백)
    → consultation INSERT 시 author_employee_id·author_name 기록
       (공용계정 account_type='shared'도 표시명은 남김)
```

---

## 핵심 설계 결정

| 결정 | 이유 |
|---|---|
| `proxy.ts` (Next.js 16) | `middleware.ts` 파일명이 Next.js 16에서 deprecated, `proxy` 함수 export 필요 |
| Route Groups `(auth)` / `(dashboard)` | 인증 필요 여부에 따라 레이아웃 분리, 미들웨어 보호 명확화 |
| `lib/supabase/admin.ts` Service Role | signUp 시 신규 유저는 institution_members 미보유 → RLS 우회 필요 |
| React.cache `getMyInstitutionId()` | 요청당 institution_id 쿼리 1회로 제한 (N+1 방지) |
| `/auth/callback` 라우트 | PKCE 이메일 인증 코드 교환 처리 (`@supabase/ssr` 표준 패턴) |
| Server Actions만으로 DB 접근 | 클라이언트에 Supabase 자격증명 노출 방지, RLS + 서버 검증 이중화 |
| `resident_no_hash` 별도 컬럼 | 평문 주민번호로 unique index 불가(개인정보 보호), 해시로 중복 방지 |
| `ChairOverlay` → `createPortal(body)` | 헤더에 `backdrop-filter` 있어 자식 z-index가 클리핑됨 — portal로 DOM 트리 탈출 필요 |
| MediaRecorder refs (`useRef`) | React state에 넣으면 re-render 시 recorder 중단됨; ref에 보관해야 overlay 닫기/열기에도 녹음 유지 |
| `maxDuration = 120` in layout.tsx | `"use server"` 파일에서 async 함수 아닌 export 불가 — Route Segment Config는 page/layout 파일에만 허용 |
| `chair_audit_logs` INSERT-only RLS | UPDATE/DELETE 정책 없음 → DB 레벨에서 레코드 불변성 강제 |

## 실시간 알림 (spec 007 — 실시간 체어 상담기록 알림)

체어에서 상담 기록이 올라오면(`saveChairRecord` → `consultation` insert + `chair_audit_logs` insert) 같은 기관의 열린 모든 직원 화면에 실시간 토스트·소리·목록갱신, 화면 꺼진 기기엔 Web Push.

```
saveChairRecord (Server Action)
  → consultation INSERT (patient_id null, chair_id, status draft)
  → chair_audit_logs INSERT (event_type 'record_created', actor_user_id)
  → sendPushToInstitution(...)            # US3, fire-and-forget
        │ Supabase Realtime(postgres_changes, RLS+filter: institution_id)
        ▼
열린 직원 화면: LiveAlertsProvider
  → 목록 refresh는 모든 기기(저장 기기 포함) / 토스트·소리는 "이 탭이 방금 저장"이면 생략(에코 방지)
  → wasLocalSave(consultation_id) ? refresh만 : 디바운스 → 토스트 + (armed면)효과음 + router.refresh()
화면 꺼짐/백그라운드 → OS Web Push (sw.js notificationclick → url)
```

> **에코 방지 = 탭 기준(consultation_id), user_id 아님** (세션24): 저장한 탭만 자기 토스트/소리를 숨기고,
> **같은 계정으로 다른 PC**에 로그인한 화면은 정상 알림. `lib/realtime/local-echo.ts`의 markLocalSave/wasLocalSave.
> 저장 기기의 '미연결 기록' 목록은 보드 저장 직후 `router.refresh()`로 즉시 갱신(타 기기는 realtime이 갱신).
> `HomeFeed`는 `initialRecords` prop 변경을 동기화해 router.refresh 결과를 반영.

신규/관련 파일:
- `lib/realtime/institution-events.ts` — `subscribeChairEvents()`(chair_audit_logs INSERT 구독, 기관 필터). 향후 이벤트 타입 확장 지점.
- `lib/realtime/local-echo.ts` — 이 탭이 저장한 consultation_id 기억(탭 기준 에코 방지).
- `components/notifications/live-alerts-provider.tsx` — 구독→토스트/소리/refresh, 에코·디바운스·재연결 재동기화. `app/(dashboard)/layout.tsx`에 마운트.
- `lib/html-to-text.ts` + `components/copy-all-button.tsx` — 상담 내용 HTML→평문 '전체 복사'(덴트웹 등 붙여넣기). 미연결기록·상담보드·환자 상담이력에 배치.
- `components/notifications/alert-toast.tsx` — 토스트 UI(체어명+도착, 진료내용 미표시).
- `components/notifications/alert-sound.ts` + `sound-arm-button.tsx` — 1회 활성화(자동재생 잠금 해제)·on/off, `public/sounds/alert.wav`.
- `app/actions/chairs.ts` `saveChairRecord` — Web Push 발송 추가(US3).

> 원칙: 실시간 구독은 **읽기 전용**(헌법 II), 쓰기는 기존 Server Action만. 전송선·토스트·푸시에 환자식별정보·진료본문 없음(헌법 I).

## 음성 원본 보관 (spec 009-audio-archive)

```
상담 저장(saveChairRecord) → consultationId
  → consultation-board가 보유한 녹음 blob을 uploadConsultationAudio(consultationId, blob)
       (비공개 버킷 consultation-audio: {institution_id}/{id}.webm, 비차단)
       → consultation.audio_path·audio_uploaded_at 갱신
       → plan=free면 최근 3개 초과분 롤링 정리(파일+audio_path)

재청취: AudioReplayButton → getConsultationAudioUrl(consultationId)
  → 서버: 기관·권한·등급 만료 판정 → createSignedUrl(60초) → <audio> 재생
  → pro 이상은 audio_replay_logs에 감사 1건

정리 cron: /api/cron/prune-audio(일1회, CRON_SECRET) → 등급별 만료 음성 삭제(텍스트 보존)
```

- 등급 정책 단일 출처: `lib/plan.ts`(retentionDays·FREE_ROLLING_MAX·auditReplay), `institutions.plan`.
- 신규 파일: `app/actions/audio.ts`, `components/chair/audio-replay-button.tsx`, `app/api/cron/prune-audio/route.ts`, `lib/plan.ts`.
- 음성은 비공개·서명URL·기관격리(헌법 I), 모든 mutation·URL발급은 Server Action(헌법 II).

## 알림함 (spec 012-notification-inbox)

```
이벤트(saveChairRecord/saveConsultation)
  → lib/notifications.sendNotification()
      → notifications insert(admin)  +  sendPushToInstitution (통합)
  → Supabase Realtime(notifications INSERT, institution_id 필터)
      → components/notifications/notification-bell.tsx (헤더) 재fetch + 배지 + setAppBadge
조회/읽음: app/api/notifications (GET) · /[id]/read (POST·PATCH) · /read-all (POST)
  → lib/notifications (getNotificationContext·getNotifications·markRead·markUnread·markAllRead)
데이터: notifications(broadcast) + notification_reads(user_id×id, 행=읽음). RLS 기관격리·본인읽음.
구독 헬퍼: lib/realtime/institution-events.ts subscribeNotifications (chair_audit_logs 패턴 재사용).
```
- 기존 실시간 토스트(LiveAlertsProvider, 일시적)와 별개 — 알림함은 영속 기록·읽음관리.

## 사용량·크레딧 (spec 013-usage-credit-dashboard)

```
[메뉴 사용량]
화면 진입(usePathname 변경)
  → components/usage/route-tracker.tsx (sendBeacon {menuId})
  → POST /api/menu-usage/track (세션에서 institution·user·role 신뢰원 확인, 화이트리스트)
  → increment_menu_usage RPC (institution,user,menu,day 카운트 +1, KST)

[크레딧 사용량]
AI 전사 성공(app/actions/transcribe.ts: transcribeEngine·transcribeAndSummarize·transcribeSegment·summarizeChunkTranscript)
  → recordUsage(feature)  ★비차단·비throw
  → lib/credits.deductCredit → deduct_credit RPC (credit_log 적재 + 잔액 차감, 음수 허용)

[조회 — 슈퍼어드민]
/admin → /admin/usage (app/(dashboard)/admin/usage/page.tsx, isSuperAdmin 게이트)
  → components/admin/usage-dashboard.tsx (2탭: 크레딧/메뉴, 기간·기관 필터)
  → GET /api/credits/summary  (총사용·기능별·사용자별·기관별·잔액·최근내역)
  → GET /api/menu-usage/summary (총합·기관별·메뉴별 역할분해·미사용)
  → POST /api/credits/grant (충전 시뮬레이션)
데이터: menu_usage_daily · institution_credits · credit_log. RLS enable+정책0(service_role만), 기관격리=쿼리필터.
```
- EO `/superadmin/menu-usage`(spec-075)·크레딧(spec-011) 벤치마크. 차이: RLS 정책0(더 강한 격리) + 크레딧 비차단(임상 안정성). 메뉴 정의는 `lib/usage/menu-config.ts`.
- **필터 고도화(spec 015)**: summary API가 `days` 프리셋 외 `from`/`to`(KST 커스텀 기간)·`user`(이메일)를 수용(`lib/usage/range.ts`로 KST 경계 일원화). 옵션 목록은 `/api/usage/filters`(기관+사용자) 1회 로드 → `components/admin/search-select.tsx` 검색형 드롭다운. 리포트는 `components/admin/report-date-nav.tsx`로 날짜 직접 선택.

## 이미지 이그레스 절감 (spec 017-egress-reduction)

```
업로드: rich-text-editor.uploadImage
  → lib/image/optimize.compressImageFile (다운스케일 1600px + webp q0.82) → Storage 저장
표시: 본문/갤러리 <img>
  → optimizeContentHtml(html)  : <img> src를 render/image 변환 URL로 + loading="lazy"
  → optimizeStorageUrl(url, {width})  : object/public → render/image/public?width=&quality=
  적용: home-feed·records-browser·consultation-history·patient-records-list·view/[id]
안전장치: NEXT_PUBLIC_IMG_TRANSFORM=off → 변환 끄고 원본 폴백(압축·lazy는 유지)
```
- 배경: Supabase 무료 이그레스 5GB 초과로 정지 → Pro 복구 후 재발 방지(2026-06-29). 주범=무압축 이미지.
- 음성(spec 009)은 재청취 클릭 시에만 다운로드(온디맨드) → 수동적 유출 아님, 범위 밖.

## 일일 사용 리포트 (spec 014-daily-usage-report)

```
[발행] 매일 08:00 KST (vercel.json cron 0 23 * * * UTC)
  → /api/cron/daily-usage-report (CRON_SECRET Bearer 또는 슈퍼어드민 세션)
  → lib/usage/daily-report.buildDailyReport({date:어제, scope:'all'})
       KST 0~24시 집계: menu_usage_daily(day) + credit_log(created_at 경계, 토큰 포함)
  → persistDailyReport → usage_reports upsert(멱등 스냅샷)
  → 전달: 슈퍼어드민 소속 기관마다 sendNotification(recipients=email, type:daily_report)
          + sendPushToUser(슈퍼어드민 uid) 웹푸시
[열람] 알림 클릭 → /admin/usage/report/[date] (RSC, 발행본 우선·없으면 즉석 집계)
  → components/admin/daily-report-view.tsx (요약·워크스페이스별·기능별(토큰)·메뉴별·사용자별·경고)
[토큰] app/actions/transcribe.ts: Claude usage(input/output) → EngineRun → recordUsage → credit_log.tokens_in/out
```
- 범용성: `buildDailyReport({scope})`가 institution_id도 받음 → 운영자(기관별) 리포트는 cron 루프 + recipients:'admins' 배선만 추가하면 재사용. 현재는 scope='all'(슈퍼어드민)만 발송.
- 슈퍼어드민은 크로스-기관이라 기관 푸시(sendPushToInstitution) 대신 user 단위 `sendPushToUser` 신규.
- **인프라 섹션(spec 018)**: `buildDailyReport`(scope='all')가 `get_infra_usage()` RPC(스토리지 버킷별 용량·객체수 + DB 크기, SECURITY DEFINER)로 인프라 스냅샷 포함 + 당일 신규 상담/이미지/음성 수. 스토리지 전일比 +500MB↑면 경고. 이그레스 실값은 플랫폼 지표(DB 밖) → Supabase Usage 참조(후속: SUPABASE_ACCESS_TOKEN Management API).

## 상담 카드 공용화 + 확인 꼬리표 (spec 021-review-flags)

```
[공용 카드] components/consultation/consultation-card.tsx (ConsultationCard / CardRecord)
  - 홈 home-feed의 연결/미연결 카드 로직을 단일 컴포넌트로 추출. useChairContext()로
    체어·멤버·오버레이·refreshUnlinkedCount 접근 → 홈·/records 어디서든 동일 동작.
  - 액션: 전체복사(CopyAllButton) · 음성듣기(AudioReplayButton, has_audio) ·
    미연결={환자연결(ChairPatientSearch)·인라인 편집(ConsultationEditor)·새 녹음(openOverlay)·삭제(deleteChairRecord)}
    연결={편집→/patients/[id] 링크·삭제(deleteConsultation)}. 하단에 <ReviewFlags/>.
  - onMutated(): 소비자가 목록 재조회(홈=reloadAll, records=reloadRows). onFlagsChanged(): 꼬리표 재조회.
[소비자] components/home/home-feed.tsx · components/records/records-browser.tsx
  - 각자 데이터 로딩·정렬/그룹·토글만 담당하고 카드 렌더는 공용 카드에 위임(중복 제거).
  - SearchedConsultation·AllUnlinkedRecord → CardRecord 매핑. 꼬리표는 getReviewFlagsFor(ids) 일괄 로드.
  - records: '확인 필요만' 필터(열린 꼬리표 달린 행만 클라 필터) + searchConsultations participants 추가.
[확인 꼬리표] lib/review-flags.ts(REVIEW_FLAG_TYPES 확장형) · app/actions/review-flags.ts ·
             components/consultation/review-flags.tsx (amber 칩 + '+ 확인 필요' 피커, ✓완료/✕삭제)
  → consultation_review_flags 테이블(멤버십 RLS). migration 20260705000001.
```
- 통일 효과: 홈에서 하던 카드 처리(편집·삭제·연결·복사·음성)를 /records에서도 100% 동일하게. 코드도 단일 소스.
- 꼬리표는 담당(김도은 선생 등)이 정리 내용을 차트에 옮기기 전 '확인 필요' 항목을 남기고, 확인되면 완료/삭제하는 워크플로. type은 코드 config라 항목 추가 시 `REVIEW_FLAG_TYPES`에 한 줄.

## 공지·업데이트 티커 (spec 022-announcements)

```
[발행] /admin/announcements (슈퍼어드민 전용) → components/admin/announcement-manager.tsx
  → app/actions/announcements.ts createAnnouncement/setActive/setPinned/delete
      (requireSuperAdmin: getUser+isSuperAdmin → admin(service_role) 클라로 RLS 우회 write)
  → announcements 테이블(전역, institution_id 없음)
[표시] app/(dashboard)/page.tsx (RSC) getActiveAnnouncements() [세션 클라, RLS: 활성·기간 내]
  → <AnnouncementTicker items> — 헤더 아래 전체폭 한 줄, seamless 마퀴(globals.css carelog-marquee)
      · hover/focus 정지, prefers-reduced-motion 정지, 공지 0건이면 렌더 안 함
      · '새 공지' 점 = localStorage last-seen(carelog.announce.seen) 비교(DB 읽음테이블 없이)
  → '전체보기' /announcements (RSC 목록, 고정 우선·최신순)
```
- 알림함(notifications, 기관별 RLS)과 분리: 공지는 전역·중앙 발행이라 별도 테이블. 알림함은 상담 저장/연결/리포트 등 기관 내 이벤트.
- EO 참조: EO 레포 접근 범위 밖 → Carelog에 포팅된 알림함(spec 012)을 벤치마크. 후속으로 EO→Carelog 공지 동기화는 게이트웨이 연동 시.

## 업데이트 피드 (spec 023-update-feed)

```
[적재] 다온 세션 마무리 → lib/update-feed.ts UPDATE_FEED에 엔트리 append (배포 = 적재)
[결정] /admin/updates (슈퍼어드민 전용) → components/admin/update-feed-manager.tsx
  → app/actions/update-feed.ts (requireSuperAdmin + admin 클라 service_role)
      · getUpdateFeed: 피드(코드) + update_feed_decisions(DB) 병합, 최신순
      · 선택 → composeAnnouncementDraft(제목·본문 자동 조합) → 초안 수정 → publishUpdateAnnouncement
        (announcements insert + 엔트리 published 기록) → spec 022 티커에 즉시 노출
      · dismissUpdateEntries(보류) / clearUpdateDecision(대기로 되돌리기)
```
- 피드는 대표에게만: 페이지 가드(isSuperAdmin redirect) + 결정 테이블 RLS deny-all(service_role만).
- 에이전트가 DB에 못 쓰는 제약을 뒤집어 **배포 파이프라인을 적재 경로**로 사용 — 피드 소스는 git 이력에 남는 코드.

## 상담 이미지 라이브러리 + 상담 캔버스 (spec 025-consult-assets)

```
[등록] /settings '상담 자료'(owner/admin) → components/settings/consult-assets-manager.tsx
  → 클라 compressImageFile(webp) → app/actions/consult-assets.ts createConsultAsset(FormData)
      (requireOwnerAdmin → admin 클라 service_role: 스토리지 업로드 + consult_assets insert)
[사용] rich-text-editor 툴바 '📚 자료' → components/consult-assets/asset-picker.tsx
      (getConsultAssets: 기관+전역 활성, 카테고리 칩·검색·확대 미리보기·즉석 업로드)
  → 선택 삽입: setImage + caption 문단. 저장 HTML에 인라인 → 카드·환자 포털·복사 추가작업 0.
[캔버스] 에디터 전체화면 토글(⛶ 크게) + 이미지 정렬(선택 시 글감싸기 좌/우·가운데, data-align + float 인라인 style)
      왼쪽 글감싸기 2장 연속 = 나란히 배치. globals.css .tiptap/.rich-content clearfix.
```
- 전역(Carelog 제공) 자산은 스키마만 준비(institution_id null) — 발행 UI(/admin/assets)는 후속.
