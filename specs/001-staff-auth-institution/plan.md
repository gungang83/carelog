# Implementation Plan: 직원 로그인 및 의료기관 계정 구조

**Branch**: `main` | **Date**: 2026-05-08 | **Spec**: [spec.md](spec.md)  
**Input**: `specs/001-staff-auth-institution/spec.md`

---

## Summary

Carelog에 Supabase Auth 기반 직원 로그인을 도입하고, 의료기관을 독립 워크스페이스로 관리하는 멀티테넌트 구조를 구축한다. 기존 환자·상담 데이터는 시드 기관에 귀속 마이그레이션하며, RLS 정책으로 기관 간 데이터를 완전 격리한다.

---

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20  
**Primary Dependencies**: Next.js 16.2.2 (App Router), @supabase/ssr 0.10.0, React 19  
**Storage**: Supabase PostgreSQL (기존) + auth.users (Supabase 관리)  
**Testing**: 수동 시나리오 테스트 (빌드 성공 + 구현 후 검증 시나리오 기준)  
**Target Platform**: Vercel Serverless + Edge (middleware)  
**Project Type**: Web application (Next.js fullstack)  
**Performance Goals**: 로그인 → 대시보드 진입 2초 이하  
**Constraints**: Service Role Key 서버 전용, 클라이언트 미노출. 기존 URL 경로 변경 없음  
**Scale/Scope**: 초기 기관당 1~10명 직원, 데이터 격리 100% 요구

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Patient Privacy First** — staff 인증 기능, resident_no 미접촉. 이메일/비밀번호는 Supabase Auth 관리. ✅
- [x] **II. Server-Side Data Authority** — signUp/signIn/invite/accept 모두 Server Actions. Service Role Key 서버 전용. ✅
- [x] **III. Clinical Reliability** — 모든 신규 액션 `{ ok, message }` 패턴. 마이그레이션 SQL 포함. revalidatePath 적용. ✅
- [x] **IV. Simplicity Over Abstraction** — `getMyInstitutionId()` (auth.ts, institutions.ts, patients.ts, consultations.ts 등 다수 콜사이트). ✅
- [x] **V. Spec-Driven Development** — `specs/001-staff-auth-institution/spec.md` 완료. ✅
- [x] **VI. Documentation as Living Artifact** — docs/database.md, docs/architecture.md, supabase/schema.sql 업데이트 예정. ✅

---

## Project Structure

### Documentation (this feature)

```text
specs/001-staff-auth-institution/
├── plan.md              ✅ This file
├── spec.md              ✅ Feature specification
├── research.md          ✅ Phase 0 결정 사항
├── data-model.md        ✅ DB 스키마, 마이그레이션 SQL, TypeScript 타입
├── quickstart.md        ✅ 구현 순서 가이드
├── contracts/
│   └── server-actions.md ✅ Server Action 인터페이스 정의
└── tasks.md             ⏳ /speckit-tasks 산출물 (미생성)
```

### Source Code 변경 레이아웃

```text
app/
├── middleware.ts                    ← NEW: 세션 갱신 미들웨어
├── (auth)/                          ← NEW: 공개 라우트 그룹
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── invite/[token]/page.tsx
├── (dashboard)/                     ← NEW: 인증 필요 라우트 그룹
│   ├── layout.tsx                   ← NEW: 인증 체크 + 기관명 헤더
│   ├── page.tsx                     ← MOVE: app/page.tsx
│   ├── patients/                    ← MOVE: app/patients/
│   └── view/                        ← MOVE: app/view/
└── actions/
    ├── auth.ts                      ← NEW
    ├── institutions.ts              ← NEW
    ├── patients.ts                  ← MODIFY: institution_id 필터 추가
    └── consultations.ts             ← MODIFY: institution_id 필터 추가

lib/
├── supabase/
│   └── middleware.ts                ← NEW: updateSession 헬퍼
└── auth/
    └── institution.ts               ← NEW: getMyInstitutionId cache

components/
├── auth/
│   ├── login-form.tsx               ← NEW
│   ├── signup-form.tsx              ← NEW
│   └── invite-form.tsx              ← NEW
└── layout/
    └── header.tsx                   ← NEW: 기관명 + 로그아웃

supabase/
├── schema.sql                       ← MODIFY: 신규 테이블 + 변경 컬럼
└── migrations/
    └── 001_staff_auth_institution.sql ← NEW
```

---

## 구현 단계 요약

| 단계 | 내용 | 위험도 |
|---|---|---|
| 1. DB 마이그레이션 | Supabase SQL Editor에서 실행 | 높음 (기존 데이터 관련) |
| 2. 미들웨어 + 라우트 | app/middleware.ts + Route Groups | 중간 (기존 경로 이동) |
| 3. lib 유틸 | updateSession, getMyInstitutionId | 낮음 |
| 4. Server Actions | auth.ts, institutions.ts | 중간 |
| 5. 기존 Actions 수정 | patients.ts, consultations.ts | 중간 |
| 6. UI 컴포넌트 | login/signup/invite/header | 낮음 |
| 7. 검증 | 시나리오 테스트 5개 | — |

상세 태스크는 `/speckit-tasks` 산출물(`tasks.md`) 참고.

---

## Complexity Tracking

| 항목 | 이유 | 단순화 불가 이유 |
|---|---|---|
| Service Role Key 도입 | 직원 초대 이메일 발송에 Admin API 필요 | anon key로 inviteUserByEmail 불가 |
| Route Groups 도입 | 인증 레이아웃 분리 필요 | 기존 layout.tsx에 인증 로직 혼재 시 Server Component 제약 충돌 |
