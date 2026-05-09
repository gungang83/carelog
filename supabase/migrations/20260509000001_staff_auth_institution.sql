-- Migration 001: Staff Auth & Institution Structure
-- 2026-05-09

-- [Step 0] 필요 확장 활성화
create extension if not exists pgcrypto;

-- [Step 1] 신규 테이블 생성
create table if not exists public.institutions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text not null default 'dental',
  created_at timestamptz not null default now()
);

create table if not exists public.institution_members (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  role           text not null default 'staff',
  invited_by     uuid references auth.users(id),
  joined_at      timestamptz not null default now(),
  unique(institution_id, user_id)
);
create index if not exists idx_inst_members_user on public.institution_members(user_id);
create index if not exists idx_inst_members_inst on public.institution_members(institution_id);

create table if not exists public.institution_invitations (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  email          text not null,
  role           text not null default 'staff',
  token          text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  invited_by     uuid not null references auth.users(id),
  expires_at     timestamptz not null default (now() + interval '24 hours'),
  accepted_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_inst_invitations_token on public.institution_invitations(token);

-- [Step 2] 기존 테이블에 institution_id 컬럼 추가
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

-- [Step 5] NOT NULL 제약 추가
alter table public.patient
  alter column institution_id set not null;
alter table public.consultation
  alter column institution_id set not null;

-- [Step 6] RLS 헬퍼 함수 + 정책 교체
create or replace function public.get_my_institution_id()
returns uuid language sql security definer stable as $$
  select institution_id
  from public.institution_members
  where user_id = auth.uid()
  limit 1;
$$;

drop policy if exists "carelog patient all" on public.patient;
create policy "staff sees own institution patients" on public.patient
  for all
  using (institution_id = public.get_my_institution_id())
  with check (institution_id = public.get_my_institution_id());

drop policy if exists "carelog consultation all" on public.consultation;
create policy "staff sees own institution consultations" on public.consultation
  for all
  using (institution_id = public.get_my_institution_id())
  with check (institution_id = public.get_my_institution_id());

alter table public.institutions enable row level security;
drop policy if exists "member sees own institution" on public.institutions;
create policy "member sees own institution" on public.institutions
  for select using (id = public.get_my_institution_id());

alter table public.institution_members enable row level security;
drop policy if exists "member sees own institution members" on public.institution_members;
create policy "member sees own institution members" on public.institution_members
  for select using (institution_id = public.get_my_institution_id());

alter table public.institution_invitations enable row level security;
drop policy if exists "admin manages invitations" on public.institution_invitations;
create policy "admin manages invitations" on public.institution_invitations
  for all using (institution_id = public.get_my_institution_id());
