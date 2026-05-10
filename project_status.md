# Carelog 프로젝트 상태

**최종 업데이트**: 2026-05-10 (세션 2)
**현재 버전**: main 브랜치

---

## 구현 완료 기능

| 기능 | 상태 | 비고 |
|---|---|---|
| 환자 등록 | ✅ 완료 | 이름, 차트번호, 전화번호, 주민번호 |
| 환자 수정 | ✅ 완료 | 수정 모달, 주민번호 포함 |
| 통합 검색 | ✅ 완료 | 이름 / 전화번호 / 차트번호 / 주민번호 앞자리 |
| 상담 기록 작성 | ✅ 완료 | 텍스트, 이미지, 처방 메모 |
| 상담 이력 조회 | ✅ 완료 | 환자 상세 페이지 |
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
| 빌드 검증 | npm run build ✅ 통과 |
| 문서 현행화 | architecture.md, database.md, schema.sql, project_status.md 업데이트 |

---

## 2026-05-10 세션 1 작업 내용

| 작업 | 결과 |
|---|---|
| BOM 인코딩 오류 수정 | `SUPABASE_SERVICE_ROLE_KEY` BOM(U+FEFF) 제거 — charCodeAt(0) 체크 |
| Vercel env var 재설정 | printf로 BOM 없이 production/development 환경변수 재추가 |
| /auth/callback 라우트 추가 | PKCE 이메일 인증 코드 교환 → 자동 로그인 |
| Supabase Site URL 수정 | localhost:3000 → carelog-tau.vercel.app (Management API) |
| 이메일 인증 수동 처리 | SQL로 email_confirmed_at 직접 설정 |
| 기존 데이터 기관 귀속 | patient 1건, consultation 8건 → 예미안치과로 UPDATE |
| 전체 동작 검증 | 로그인 + 환자 검색 정상 확인 |
| 문서 현행화 | architecture.md, database.md, schema.sql, tasks.md 전면 업데이트 |

---

## 알려진 이슈 / 남은 작업

| 이슈 | 심각도 | 상태 |
|---|---|---|
| Solapi 실제 API 키 미설정 | 높음 | ⏳ .env.local과 Vercel에 실제 키 입력 필요 |
| DB 마이그레이션 미실행 | 높음 | ⏳ Supabase SQL Editor에서 20260510000001_patient_portal.sql 실행 필요 |
| 직원 초대 UI 미구현 | 중간 | ⏳ T030~T033 (설정 페이지 + invite 폼) |
| NEXT_PUBLIC_SITE_URL 환경변수 미설정 | 낮음 | Vercel에 https://carelog-tau.vercel.app 추가 권장 |

---

## 다음 우선순위

### 즉시 필요 (환자 포털 활성화)
1. Supabase SQL Editor에서 `supabase/migrations/20260510000001_patient_portal.sql` 실행
2. Solapi 계정 생성 + 발신번호 등록 후 `.env.local` 및 Vercel에 키 입력

### 이후
3. 직원 초대 UI (T030~T033)

---

## 중장기 로드맵

| Phase | 내용 | 상태 |
|---|---|---|
| Phase 1 | 직원 로그인 + 기관 계정 + RLS | ✅ 완료 |
| Phase 2 (spec 002) | 환자 포털 — SMS 초대 + OTP 가입 + 상담 조회 | ✅ 코드 완료, DB 마이그레이션 대기 |
| Phase 3 | 콘텐츠 블록 모델 + 오디오 + Audit log | 미착수 |
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
| DB 마이그레이션 | 20260509000001_staff_auth_institution.sql 적용 완료 |
