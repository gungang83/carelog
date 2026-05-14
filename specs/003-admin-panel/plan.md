# Implementation Plan: Carelog 어드민 패널

**Branch**: `main` | **Date**: 2026-05-14 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/003-admin-panel/spec.md`

## Summary

복수 기관 소속 직원이 헤더 드롭다운으로 활성 기관을 전환하고, 기관 관리자가 `/settings`에서 직원 권한을 관리하며, 슈퍼 어드민(`mobys0416@gmail.com`)이 `/admin`에서 전체 기관을 통합 관리한다.

핵심 기술 결정:
- 활성 기관: HTTP-only 쿠키 (`carelog_active_institution`) — 서버/클라이언트 모두 접근 가능
- 직원 접근 제어: `institution_members.is_active` 컬럼 추가 (DB 마이그레이션)
- 슈퍼 어드민: `SUPER_ADMIN_EMAIL` 환경변수로 식별

## Technical Context

**Language/Version**: TypeScript (strict) / Next.js 16.2.2 App Router  
**Primary Dependencies**: Supabase SSR, Tailwind CSS v4, React Server Components  
**Storage**: Supabase PostgreSQL — `institution_members` 테이블에 `is_active` 컬럼 추가  
**Target Platform**: Vercel Edge/Serverless  
**Project Type**: Web application (풀스택, Server Actions 패턴)  
**Performance Goals**: 기관 전환 3초 이내 완료  
**Constraints**: Server Actions only for mutations; HttpOnly cookie for active institution  
**Scale/Scope**: 소규모 치과 (기관당 10명 내외 직원)

## Constitution Check

- [x] **I. Patient Privacy First** — 어드민 패널은 환자 데이터를 직접 다루지 않음. `resident_no` 비접촉. ✅
- [x] **II. Server-Side Data Authority** — 모든 권한 변경(is_active 토글, 기관명 수정, 쿠키 설정)은 Server Actions 경유. 클라이언트 직접 DB 쓰기 없음. ✅
- [x] **III. Clinical Reliability** — 모든 Server Action `{ ok, message }` 반환. `revalidatePath` 호출. DB 마이그레이션 파일 포함. ✅
- [x] **IV. Simplicity Over Abstraction** — `is_active` 단일 컬럼으로 권한 제어. 신규 유틸은 2개 이상 호출처 있는 경우만 추출. ✅
- [x] **V. Spec-Driven Development** — `specs/003-admin-panel/spec.md` 존재 및 승인. ✅
- [x] **VI. Documentation as Living Artifact** — 완료 시 `project_status.md`, `docs/architecture.md`, `docs/database.md`, `supabase/schema.sql` 업데이트 예정. ✅

## Project Structure

### Documentation (this feature)

```text
specs/003-admin-panel/
├── plan.md              ✅ 이 파일
├── research.md          ✅
├── data-model.md        ✅
├── quickstart.md        ✅
├── contracts/
│   └── server-actions.md  ✅
└── tasks.md             (다음: /speckit-tasks)
```

### Source Code

```text
app/
├── (dashboard)/
│   ├── layout.tsx           # 수정: 복수 기관 로드 + 활성 기관 쿠키 읽기
│   ├── settings/
│   │   └── page.tsx         # 신규: 직원 관리 + 기관 정보 설정 (owner/admin 전용)
│   └── admin/
│       └── page.tsx         # 신규: 슈퍼 어드민 전용 전체 기관 관리
├── actions/
│   └── admin.ts             # 신규: 어드민 Server Actions 전체

components/
├── layout/
│   ├── header.tsx           # 수정: 기관 전환 드롭다운 + 설정/관리자 링크 추가
│   └── institution-switcher.tsx  # 신규: 복수 기관 드롭다운 클라이언트 컴포넌트
├── settings/
│   ├── staff-list.tsx       # 신규: 직원 목록 + is_active 토글 UI
│   ├── staff-invite-form.tsx  # 신규: 직원 초대 폼 (기존 inviteStaff 액션 활용)
│   └── institution-form.tsx   # 신규: 기관명 수정 폼
└── admin/
    ├── institution-table.tsx  # 신규: 슈퍼 어드민 기관 목록 테이블
    └── institution-staff-panel.tsx  # 신규: 슈퍼 어드민 기관별 직원 관리

lib/
├── auth/
│   └── institution.ts       # 수정: getMyInstitutionId() 쿠키 우선 + getMyInstitutions() 추가
└── admin.ts                 # 신규: isSuperAdmin() 유틸

supabase/
└── migrations/
    └── 20260514000001_admin_panel.sql  # 신규: is_active 컬럼 추가
```

## Key Implementation Details

### 1. 활성 기관 쿠키 흐름

```
사용자가 드롭다운에서 기관 선택
  → InstitutionSwitcher (클라이언트)
  → switchInstitution(institutionId) [Server Action]
    → admin client: institution_members 검증 (사용자가 해당 기관 멤버 & is_active=true)
    → cookies().set('carelog_active_institution', institutionId, { httpOnly: true, maxAge: 30*24*60*60 })
  → router.refresh() (클라이언트)
  → DashboardLayout 리렌더 → getMyInstitutionId() 쿠키에서 읽음 → 새 기관 데이터 로드
```

### 2. getMyInstitutionId() 수정

```typescript
// 수정 전: institution_members에서 maybeSingle() → 첫 기관
// 수정 후: 쿠키 확인 → 유효한 멤버십이면 반환 → 없으면 첫 기관 반환
export const getMyInstitutionId = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies();
  const activeCookie = cookieStore.get('carelog_active_institution')?.value;

  // 쿠키 값이 있으면 실제 멤버인지 확인
  if (activeCookie) {
    // DB 검증 후 반환
  }
  // 없으면 기존 로직 (첫 기관)
});
```

### 3. is_active 검증 위치

- **미들웨어**: 변경 없음 (인증 여부만 체크)
- **DashboardLayout**: 활성 기관 데이터 로드 시 `is_active=true` 멤버만 해당 기관 접근 가능하도록 체크
- **Server Actions**: `getMyInstitutionId()` 반환 전 `is_active` 검증 포함
- **RLS**: 기존 `get_my_institution_id()` DB 함수는 유지 (보조 레이어)

### 4. 슈퍼 어드민 가드

```typescript
// lib/admin.ts
export function isSuperAdmin(email: string | undefined | null): boolean {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'mobys0416@gmail.com';
  return email === superAdminEmail;
}
```

모든 슈퍼 어드민 Server Action 시작 시:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!isSuperAdmin(user?.email)) {
  return { ok: false, message: '접근 권한이 없습니다.' };
}
```

## Complexity Tracking

모든 Constitution Check 통과 — 복잡성 정당화 필요 없음.
