# Server Action Contracts: 어드민 패널

---

## `switchInstitution(institutionId: string)`

**파일**: `app/actions/admin.ts`  
**호출자**: `components/layout/institution-switcher.tsx`

```typescript
// Input
institutionId: string  // 전환할 기관의 UUID

// Output
{ ok: true } | { ok: false; message: string }

// Side effects
// - carelog_active_institution 쿠키 설정 (30일)
// - 사용자가 해당 기관의 멤버인지 & is_active=true인지 검증 후 설정
```

---

## `getMyInstitutions()`

**파일**: `lib/auth/institution.ts` (기존 파일 확장)  
**호출자**: `app/(dashboard)/layout.tsx`

```typescript
// Output
{
  institutions: Array<{
    institution: InstitutionRow;
    role: "owner" | "admin" | "staff";
    is_active: boolean;
  }>;
  activeInstitutionId: string | null;
}
```

---

## `getStaffList()`

**파일**: `app/actions/admin.ts`  
**호출자**: `app/(dashboard)/settings/page.tsx`

```typescript
// Output
{ ok: true; members: StaffMemberView[] } | { ok: false; message: string }

type StaffMemberView = {
  id: string;           // institution_members.id
  user_id: string;
  email: string;        // auth.users.email (admin client으로 조회)
  role: "owner" | "admin" | "staff";
  is_active: boolean;
  joined_at: string;
}

// Auth: 현재 사용자가 해당 기관의 owner 또는 admin이어야 함
```

---

## `setStaffActive(memberId: string, isActive: boolean)`

**파일**: `app/actions/admin.ts`  
**호출자**: `components/settings/staff-list.tsx`

```typescript
// Input
memberId: string   // institution_members.id
isActive: boolean  // 새 활성 상태

// Output
{ ok: true } | { ok: false; message: string }

// Validation
// - 현재 사용자가 해당 기관의 owner 또는 admin이어야 함
// - 슈퍼 어드민 이메일 계정은 비활성화 불가
// - 기관 마지막 owner를 비활성화 시도 시 거부
// - 자기 자신을 비활성화 시도 시 거부

// Side effects
// - revalidatePath('/settings')
```

---

## `updateInstitutionName(name: string)`

**파일**: `app/actions/admin.ts`  
**호출자**: `components/settings/institution-form.tsx`

```typescript
// Input
name: string  // 새 기관명 (trim 후 1자 이상)

// Output
{ ok: true } | { ok: false; message: string }

// Auth: 현재 사용자가 해당 기관의 owner이어야 함
// Side effects: revalidatePath('/')  revalidatePath('/settings')
```

---

## `getAllInstitutions()` (슈퍼 어드민 전용)

**파일**: `app/actions/admin.ts`  
**호출자**: `app/(dashboard)/admin/page.tsx`

```typescript
// Output
{ ok: true; institutions: AdminInstitutionView[] } | { ok: false; message: string }

type AdminInstitutionView = {
  id: string;
  name: string;
  type: string;
  created_at: string;
  member_count: number;
  active_member_count: number;
}

// Auth: SUPER_ADMIN_EMAIL 환경변수와 현재 사용자 이메일 일치 여부 확인
```

---

## `getInstitutionStaff(institutionId: string)` (슈퍼 어드민 전용)

**파일**: `app/actions/admin.ts`  
**호출자**: `app/(dashboard)/admin/page.tsx`

```typescript
// Input
institutionId: string

// Output
{ ok: true; members: StaffMemberView[] } | { ok: false; message: string }

// Auth: SUPER_ADMIN_EMAIL 검증
```

---

## `setStaffActiveAsAdmin(memberId: string, isActive: boolean)` (슈퍼 어드민 전용)

**파일**: `app/actions/admin.ts`

```typescript
// Input / Output: setStaffActive와 동일
// Auth: SUPER_ADMIN_EMAIL 검증 (기관 소속 여부 불필요)
```
