# Carelog 프로젝트 상태

**최종 업데이트**: 2026-05-09  
**현재 버전**: main 브랜치 기준 (commit: 9e8d1ff)

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
| 기관 등록 (signUp) | ✅ 완료 | 기관명 + 이메일 + 비밀번호로 신규 기관 생성 |
| 다기관 격리 구조 | ✅ 완료 | institution_id 필터 + RLS 준비 완료 |
| 로그인/로그아웃 | ✅ 완료 | `/login`, `/signup` 페이지 |
| 직원 초대 | ✅ 완료 | inviteStaff, acceptInvitation Server Action |
| 디자인 시스템 문서 | ✅ 완료 | docs/design.md (Sticky/Claude Design 연동용) |

---

## 2026-05-09 세션 작업 내용

| 작업 | 결과 |
|---|---|
| spec 001 tasks.md 생성 | 44개 태스크 × 6 Phase 생성 완료 |
| docs/design.md 작성 | 컬러팔레트, 컴포넌트 패턴, AI 도구 연동 노트 |
| spec 001 Phase 1~3 구현 | 코드 전체 구현 + 빌드 통과 + push 완료 |
| Route Groups 분리 | `(auth)/`, `(dashboard)/` 완전 분리 |
| Next.js 16 proxy 마이그레이션 | `middleware.ts` → `proxy.ts` (Next.js 16 요구사항) |
| lib/auth/institution.ts | `getMyInstitutionId()` React.cache 유틸 |
| lib/supabase/admin.ts | Service Role 클라이언트 (signUp, inviteStaff용) |
| patients.ts + consultations.ts 수정 | institution_id 필터 + INSERT에 포함 |

---

## 알려진 이슈 / 남은 작업

| 이슈 | 심각도 | 상태 |
|---|---|---|
| **DB 마이그레이션 미실행** | 🔴 높음 | ⏳ Supabase SQL Editor에서 data-model.md Step 1~6 실행 필요 |
| **SUPABASE_SERVICE_ROLE_KEY 미설정** | 🔴 높음 | ⏳ Vercel 대시보드 + `.env.local`에 추가 필요 (signUp 필수) |
| 기존 데이터 기관 귀속 | 중간 | DB 마이그레이션 Step 3~5 완료 후 자동 해결 |
| 기존 원장 계정 seed 기관 멤버 등록 | 중간 | 마이그레이션 후 Supabase에서 수동 INSERT |
| `.env.example` 파일 없음 | 낮음 | docs/development.md 참고로 대체 중 |

---

## 즉시 다음 세션: DB 마이그레이션 실행

### 1단계: SUPABASE_SERVICE_ROLE_KEY 추가

1. Supabase 대시보드 → Project Settings → API → service_role 키 복사
2. Vercel 대시보드 → Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY` 추가
3. `vercel env pull` 실행 → `.env.local` 자동 갱신

### 2단계: DB 마이그레이션 실행

Supabase SQL Editor에서 `specs/001-staff-auth-institution/data-model.md` Step 1~6 순서대로 실행:

- Step 1: `institutions`, `institution_members`, `institution_invitations` 테이블 생성
- Step 2: `patient`, `consultation` 테이블에 `institution_id` 컬럼 추가
- Step 3: 시드 기관 INSERT (`a0000000-0000-0000-0000-000000000001`)
- Step 4: 기존 데이터 시드 기관 귀속 UPDATE
- Step 5: `institution_id` NOT NULL 제약 추가
- Step 6: RLS 함수(`get_my_institution_id()`) + 정책 교체

### 3단계: 기존 원장 계정을 시드 기관에 연결

```sql
-- 원장의 auth.users.id를 Supabase에서 확인 후 실행
INSERT INTO institution_members (institution_id, user_id, role)
VALUES ('a0000000-0000-0000-0000-000000000001', '<원장_USER_ID>', 'owner')
ON CONFLICT DO NOTHING;
```

### 4단계: 검증

- `/signup` → 새 기관명 + 이메일 + 비밀번호로 가입 → 대시보드 진입 확인
- 기존 원장 계정으로 `/login` → 환자 목록 정상 표시 확인

---

## 중장기 로드맵

| Phase | 내용 | 스펙 |
|---|---|---|
| Phase 1 | 직원 로그인 + 기관 계정 + RLS 전환 | ✅ 구현 완료 (DB 마이그레이션 대기) |
| Phase 2 | 콘텐츠 블록 모델 + 오디오 + Audit log | 미착수 |
| Phase 3 | 환자 포털 (cross-institution 열람, 검증) | 미착수 |
| Phase 4 | AI 기능 (오디오 전사, 상담 요약) | 미착수 |

---

## 개발 원칙

모든 기능 개발은 Spec-Driven Development:
`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`

Constitution: `.specify/memory/constitution.md` (v1.1.0)
