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
│   ├── chair-provider.tsx         # ChairProvider (Context + useReducer) — 체어 전역 상태, MediaRecorder refs
│   ├── chair-overlay.tsx          # 체어 기록 다이얼로그 (createPortal → body); 현재 세션 녹음/편집 전용
│   ├── chair-patient-search.tsx   # 환자 검색 + linkChairRecordToPatient + 인라인 신규 등록
│   ├── chair-settings.tsx         # 설정 페이지 내 체어 관리 (admin/owner 전용)
│   ├── quick-record-trigger.tsx   # 홈 화면 빠른 기록 시작 버튼 + 위치 선택 UI
│   ├── unlinked-records-section.tsx # 홈 화면 미연결 기록 통합 인라인 목록 (RichTextEditor 편집)
│   └── prescription-picker.tsx    # 컴팩트 처방 칩 선택 컴포넌트 (오버레이·미연결 섹션 공용)
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
├── auth/sso/route.ts              # EO SSO 진입 — JWT 검증 → 세션 생성 + eo_employee_id·display_name 저장 + EO lazy 동기화
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
     → admin client: institutions INSERT → institution_members INSERT (role: owner)
     → redirect('/')

   ※ 온보딩 트랩 방지(/auth/callback): 멤버가 없을 때 곧장 /onboarding으로 보내지 않고,
     대기 중(미수락·미만료) 직원 초대가 있으면 /invite/{token}(수락 동선)으로 보낸다.
     초대받은 사람이 로그인하다 엉뚱한 새 워크스페이스를 만드는 문제를 막는다.

3-1. 직원 초대 (설정 → StaffInviteForm → inviteStaff)
   - 이미 auth 계정이 있는 이메일 → institution_members 즉시 추가(즉시 직원 등록,
     비활성 멤버는 재활성화). inviteUserByEmail은 신규 전용이라 기존 계정엔 안 씀.
   - 신규 이메일 → institution_invitations INSERT + inviteUserByEmail(메일, redirectTo=/invite/token).
     메일 실패 시 방금 만든 초대 row 롤백(dangling 방지).
   - /invite/{token} → acceptInvitation → institution_members INSERT(초대 role) → accepted_at 기록

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

app/(dashboard)/page.tsx (홈 화면)
  ├── ConsultHero (Client) — 최상단 히어로 (Living Consult 톤, 이전 QuickRecordTrigger 대체)
  │     ── "오늘 진료, 기록으로 남겨서 환자에게 전달해요" 헤드라인 + "상담 기록 시작" CTA
  │     ── 클릭 → 체어 목록 칩 표시 (등록된 chairs 또는 직접 입력)
  │     ── 체어 선택 → openOverlay(chairId)  (기능은 기존과 동일)
  │
  └── UnlinkedRecordsSection (Client)
        ── getAllUnlinkedRecords() → 모든 체어의 미연결 기록 통합 목록
        ── 체어 이름 배지 + 타임스탬프 + 내용 미리보기
        ── 인라인 편집: RichTextEditor + PrescriptionPicker
        ── 인라인 환자 연결: ChairPatientSearch
              └── linkChairRecordToPatient({ consultationId, patientId })
        ── 삭제: deleteChairRecord → 감사 로그 먼저, 이후 delete

ChairOverlay (Client, createPortal → document.body)
  ── backdrop-filter 스택 컨텍스트 탈출을 위해 portal 사용
  ── 현재 세션 녹음/편집 전용 (과거 기록 목록 없음)
  ── idle: 녹음 시작 버튼 (+ 마이크 실패 시 텍스트 직접 입력 폴백)
  ── recording: 타이머 + 중지 버튼 (overlay 닫아도 백그라운드 녹음 유지)
  ── processing: 변환 중 스피너
  ── has_records: 텍스트 편집 + PrescriptionPicker + [임시저장] [환자연결] [버리기]

app/(dashboard)/patients/[patientId]/page.tsx
  └── ConsultationHistory → RelinkControls (체어 기록에만 표시)
        ── "다른 환자로 재연결" → relinkChairRecord({ consultationId, newPatientId })
        ── "미연결로 되돌리기" → unlinkChairRecord({ consultationId })
              ── patient_id = null 복원 + chair_audit_logs INSERT (patient_unlinked)

app/(dashboard)/layout.tsx
  └── export const maxDuration = 120  ← Server Action 타임아웃 (transcription용)
```

**체어 기록 저장 흐름**
```
handleStopRecording()
  → stopRecording(chairId) → Blob (MediaRecorder chunks)
  → transcribeChairAudio(formData) [Server Action]
      → transcribeAndSummarize() → Whisper + GPT 요약
  → setTranscriptionResult(chairId, summary)

handleSave()
  → saveChairRecord({ chairId, content, prescriptions }) [Server Action]
      → consultation INSERT (patient_id: null, status: 'draft', chair_id)
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
