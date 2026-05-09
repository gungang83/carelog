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
│   └── invite/[token]/page.tsx    # 직원 초대 수락
├── (dashboard)/                   # 인증 필요 라우트 그룹
│   ├── layout.tsx                 # 미인증 시 /login 리다이렉트 + 기관명 헤더
│   ├── page.tsx                   # 홈 (환자 검색 + 등록)
│   ├── patients/
│   │   └── [patientId]/page.tsx  # 환자 상세 + 상담 이력
│   └── view/
│       └── [consultationId]/page.tsx  # 상담 기록 상세
├── auth/
│   └── callback/route.ts          # 이메일 인증 후 PKCE 코드 교환 → 세션 생성
├── actions/
│   ├── auth.ts                    # signUp, signIn, signOut
│   ├── institutions.ts            # getMyInstitution, inviteStaff, acceptInvitation
│   ├── patients.ts                # 환자 CRUD, 검색 (institution_id 필터)
│   └── consultations.ts           # 상담 기록 CRUD (institution_id 필터)
├── globals.css
└── layout.tsx                     # HTML/body/fonts 쉘만 포함

components/
├── auth/
│   ├── login-form.tsx             # 이메일+비밀번호 로그인 폼
│   └── signup-form.tsx            # 이메일+비밀번호+기관명 가입 폼
├── layout/
│   └── header.tsx                 # 기관명 + StationManager + 로그아웃
├── patient-home.tsx               # 검색 UI + 새 환자 등록 버튼
├── patient-form.tsx               # 새 환자 등록 폼
├── patient-edit-form.tsx          # 환자 정보 수정 모달
├── consultation-form.tsx          # 상담 기록 작성 폼
├── consultation-history.tsx       # 상담 이력 목록
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
├── auth/
│   └── institution.ts             # getMyInstitutionId(), getMyInstitution() React.cache
├── types/
│   └── database.ts                # PatientRow, ConsultationRow, InstitutionRow 등 타입
├── patient-search.ts              # ilike 쿼리 유틸 (escapeIlike, fragments)
├── rrn-core.ts                    # 주민번호 파싱·정규화·검색 패턴
├── rrn-hash.ts                    # 주민번호 SHA-256 해시 (중복 방지용)
├── station-storage.ts             # 로컬스토리지 체어 번호 관리
└── utils.ts                       # 공통 유틸

proxy.ts                           # Next.js 16 미들웨어 진입점 (middleware.ts 대체)
supabase/
├── migrations/
│   └── 20260509000001_staff_auth_institution.sql  # 기관 구조 + RLS 마이그레이션
└── schema.sql                     # 전체 스키마 (참조용)
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
  → 이미지 선택 → Supabase Storage 직접 업로드 (consultation-images 버킷)
  → saveConsultation(formData) [Server Action]
    → getMyInstitutionId() → institution_id 포함 INSERT
    → image_urls, content, prescriptions, station_name 저장
    → revalidatePath('/patients/[id]')
```

### 주민번호 처리
```
입력 (앞 6자리 + 뒤 7자리)
  → mergeResidentNoParts() → rrn-core.ts
  → normalizeFullResidentNo() → "XXXXXX-XXXXXXX" 형식
  → hashResidentNoForMatching() → SHA-256 해시 (resident_no_hash 컬럼)
  → DB 저장: resident_no (원본), resident_no_hash (중복방지 unique index)
  → UI 표시: maskResidentNo() → "880101-1******"
```

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
