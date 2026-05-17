# Carelog 프로젝트 상태

**최종 업데이트**: 2026-05-17 (세션 7)
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

---

## 다음 우선순위

1. **Google OAuth 외부 설정** — Google Cloud Console + Supabase Dashboard 설정 (아래 설명 참조)
2. **Solapi 계정 생성** + 발신번호 등록 후 `.env.local` 및 Vercel에 API 키 입력
3. **spec 002 quickstart 7개 시나리오** 수동 검증 (환자 포털 전체 흐름)
4. **어드민 패널 수동 검증** — `/settings`, `/admin` 페이지 실제 동작 확인

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
| Phase 4 | AI 기능 (오디오 전사, 상담 요약) | 미착수 |

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
