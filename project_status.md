# Carelog 프로젝트 상태

**최종 업데이트**: 2026-05-10  
**현재 버전**: main 브랜치 (commit: 5625982)

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

---

## 2026-05-10 세션 작업 내용

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
| 직원 초대 UI 미구현 | 중간 | ⏳ T030~T033 (설정 페이지 + invite 폼) |
| NEXT_PUBLIC_SITE_URL 환경변수 미설정 | 낮음 | 코드에 하드코딩 대체 중, Vercel에 추가 권장 |

---

## 다음 세션: Phase 4 US2 (직원 초대 UI)

### T030: `components/auth/invite-form.tsx`
- 토큰 파라미터 읽기 + 비밀번호 설정 폼
- `acceptInvitation` Server Action 연결

### T031: `app/(auth)/invite/[token]/page.tsx`
- 토큰 유효성 사전 확인 (만료/사용 여부)
- InviteForm 렌더

### T032: `components/institution/invite-staff-form.tsx`
- 직원 이메일 + 역할 선택 폼
- `inviteStaff` Server Action 연결

### T033: `app/(dashboard)/settings/page.tsx`
- 직원 초대 폼
- 현재 멤버 목록 표시

---

## 중장기 로드맵

| Phase | 내용 | 상태 |
|---|---|---|
| Phase 1 | 직원 로그인 + 기관 계정 + RLS | ✅ 완료 |
| Phase 2 | 콘텐츠 블록 모델 + 오디오 + Audit log | 미착수 |
| Phase 3 | 환자 포털 (cross-institution 열람, 검증) | 미착수 |
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
