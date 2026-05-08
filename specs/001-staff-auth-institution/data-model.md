# Data Model: 직원 로그인 및 의료기관 계정 구조

**Phase 1 산출물** | 작성일: 2026-05-08

---

## 신규 테이블

### `institutions` — 의료기관 워크스페이스

```sql
create table public.institutions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null default 'dental',
  -- 향후: 'hospital' | 'clinic' | 'dental' 등 확장
  created_at  timestamptz not null default now()
);
```

### `institution_members` — 직원 소속

```sql
create table public.institution_members (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'staff',
  -- 'owner' | 'admin' | 'staff'
  invited_by      uuid references auth.users(id),
  joined_at       timestamptz not null default now(),
  unique(institution_id, user_id)
);

create index on public.institution_members (user_id);
create index on public.institution_members (institution_id);
```

**역할 정의**:
| role | 권한 |
|---|---|
| `owner` | 기관 전체 관리, 직원 초대/삭제, 기관 설정 |
| `admin` | 직원 초대, 환자 전체 접근 |
| `staff` | 환자/상담 기록 CRUD |

### `institution_invitations` — 직원 초대 토큰

```sql
create table public.institution_invitations (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  email           text not null,
  role            text not null default 'staff',
  token           text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by      uuid not null references auth.users(id),
  expires_at      timestamptz not null default (now() + interval '24 hours'),
  accepted_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index on public.institution_invitations (token);
```

---

## 기존 테이블 변경

### `patient` — institution_id 추가

```sql
alter table public.patient
  add column if not exists institution_id uuid references public.institutions(id);
```

### `consultation` — institution_id 추가

```sql
alter table public.consultation
  add column if not exists institution_id uuid references public.institutions(id);
```

---

## RLS 헬퍼 함수 및 정책

```sql
-- 현재 로그인한 사용자의 institution_id 반환
create or replace function public.get_my_institution_id()
returns uuid language sql security definer stable as $$
  select institution_id
  from public.institution_members
  where user_id = auth.uid()
  limit 1;
$$;

-- patient: 기관 격리
drop policy if exists "carelog patient all" on public.patient;
create policy "staff sees own institution patients" on public.patient
  for all
  using (institution_id = public.get_my_institution_id())
  with check (institution_id = public.get_my_institution_id());

-- consultation: 기관 격리
drop policy if exists "carelog consultation all" on public.consultation;
create policy "staff sees own institution consultations" on public.consultation
  for all
  using (institution_id = public.get_my_institution_id())
  with check (institution_id = public.get_my_institution_id());

-- institutions: 소속 기관만 조회
alter table public.institutions enable row level security;
create policy "member sees own institution" on public.institutions
  for select using (id = public.get_my_institution_id());

-- institution_members: 같은 기관 멤버 조회
alter table public.institution_members enable row level security;
create policy "member sees own institution members" on public.institution_members
  for select using (institution_id = public.get_my_institution_id());

-- institution_invitations: owner/admin만 관리
alter table public.institution_invitations enable row level security;
create policy "admin manages invitations" on public.institution_invitations
  for all using (institution_id = public.get_my_institution_id());
```

---

## 마이그레이션 SQL (순서 중요)

```sql
-- ============================================================
-- MIGRATION 001: Staff Auth & Institution Structure
-- 실행 전: Supabase 대시보드에서 DB 백업 권장
-- ============================================================

-- [Step 1] 신규 테이블 생성
create table if not exists public.institutions ( ... );  -- 위 DDL 참고
create table if not exists public.institution_members ( ... );
create table if not exists public.institution_invitations ( ... );

-- [Step 2] 기존 테이블 컬럼 추가
alter table public.patient
  add column if not exists institution_id uuid references public.institutions(id);
alter table public.consultation
  add column if not exists institution_id uuid references public.institutions(id);

-- [Step 3] 시드 기관 생성 (기존 데이터 귀속용, 고정 UUID)
insert into public.institutions (id, name, type)
values ('a0000000-0000-0000-0000-000000000001', '기본 의료기관', 'dental')
on conflict (id) do nothing;

-- [Step 4] 기존 레코드 시드 기관에 귀속
update public.patient
  set institution_id = 'a0000000-0000-0000-0000-000000000001'
  where institution_id is null;

update public.consultation
  set institution_id = 'a0000000-0000-0000-0000-000000000001'
  where institution_id is null;

-- [Step 5] NOT NULL 제약 추가 (데이터 정합성 확인 후 실행)
alter table public.patient
  alter column institution_id set not null;
alter table public.consultation
  alter column institution_id set not null;

-- [Step 6] RLS 함수 및 정책 교체 (위 RLS 섹션 참고)
```

---

## TypeScript 타입 추가 (lib/types/database.ts)

```ts
export type InstitutionRow = {
  id: string;
  name: string;
  type: string;
  created_at: string;
};

export type InstitutionMemberRow = {
  id: string;
  institution_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'staff';
  invited_by: string | null;
  joined_at: string;
};

export type InstitutionInvitationRow = {
  id: string;
  institution_id: string;
  email: string;
  role: 'owner' | 'admin' | 'staff';
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

// 기존 타입 확장
export type PatientRow = {
  id: string;
  institution_id: string;  // 추가
  name: string;
  chart_no: string | null;
  phone: string | null;
  resident_no: string | null;
  created_at: string;
};
```

---

## 엔티티 관계도

```
auth.users (Supabase 관리)
    │
    ├──[1:N]── institution_members ──[N:1]── institutions
    │              └── role                      │
    │                                            │
    ├──[1:N]── institution_invitations ──────────┘
    │
    └── (via institution_members)
         ├── patients      (institution_id FK)
         └── consultations (institution_id FK)
```
