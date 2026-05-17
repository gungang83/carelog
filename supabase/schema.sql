-- Carelog 전체 스키마 (참조용)
-- 마지막 동기화: 2026-05-10
-- 실제 마이그레이션 파일:
--   supabase/migrations/20260509000001_staff_auth_institution.sql
--   supabase/migrations/20260510000001_patient_portal.sql

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists pgcrypto;

-- ============================================================
-- 기관 구조 (다중 테넌트)
-- ============================================================

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

-- ============================================================
-- 환자
-- ============================================================
create table if not exists public.patient (
  id              bigint primary key generated always as identity,
  institution_id  uuid not null references public.institutions(id),
  name            text not null,
  chart_no        text,
  phone           text,
  resident_no     text,
  resident_no_hash text,
  created_at      timestamptz not null default now()
);

create unique index if not exists patient_resident_no_hash_uidx
  on public.patient (resident_no_hash)
  where resident_no_hash is not null;

-- ============================================================
-- 상담 기록
-- ============================================================
create table if not exists public.consultation (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id),
  patient_id      bigint not null references public.patient(id) on delete cascade,
  content         text not null default '',
  image_urls      jsonb not null default '[]'::jsonb,
  prescriptions   jsonb not null default '[]'::jsonb,
  station_name    text,
  created_at      timestamptz not null default now()
);

create index if not exists consultation_patient_id_idx on public.consultation(patient_id);

-- ============================================================
-- RLS 헬퍼 함수
-- ============================================================
create or replace function public.get_my_institution_id()
returns uuid language sql security definer stable as $$
  select institution_id
  from public.institution_members
  where user_id = auth.uid()
  limit 1;
$$;

-- ============================================================
-- RLS 정책
-- ============================================================

-- institutions
alter table public.institutions enable row level security;
drop policy if exists "member sees own institution" on public.institutions;
create policy "member sees own institution" on public.institutions
  for select using (id = public.get_my_institution_id());

-- institution_members
alter table public.institution_members enable row level security;
drop policy if exists "member sees own institution members" on public.institution_members;
create policy "member sees own institution members" on public.institution_members
  for select using (institution_id = public.get_my_institution_id());

-- institution_invitations
alter table public.institution_invitations enable row level security;
drop policy if exists "admin manages invitations" on public.institution_invitations;
create policy "admin manages invitations" on public.institution_invitations
  for all using (institution_id = public.get_my_institution_id());

-- patient
alter table public.patient enable row level security;
drop policy if exists "staff sees own institution patients" on public.patient;
create policy "staff sees own institution patients" on public.patient
  for all
  using (institution_id = public.get_my_institution_id())
  with check (institution_id = public.get_my_institution_id());

-- consultation
alter table public.consultation enable row level security;
drop policy if exists "staff sees own institution consultations" on public.consultation;
create policy "staff sees own institution consultations" on public.consultation
  for all
  using (institution_id = public.get_my_institution_id())
  with check (institution_id = public.get_my_institution_id());

-- ============================================================
-- Storage: 상담 이미지 버킷
-- ============================================================
insert into storage.buckets (id, name, public)
values ('consultation-images', 'consultation-images', true)
on conflict (id) do nothing;

drop policy if exists "carelog consult images read" on storage.objects;
create policy "carelog consult images read" on storage.objects
  for select using (bucket_id = 'consultation-images');

drop policy if exists "carelog consult images write" on storage.objects;
create policy "carelog consult images write" on storage.objects
  for insert with check (bucket_id = 'consultation-images');

drop policy if exists "carelog consult images update" on storage.objects;
create policy "carelog consult images update" on storage.objects
  for update using (bucket_id = 'consultation-images');

drop policy if exists "carelog consult images delete" on storage.objects;
create policy "carelog consult images delete" on storage.objects
  for delete using (bucket_id = 'consultation-images');

-- ============================================================
-- 환자 포털 테이블 (migration: 20260510000001_patient_portal.sql)
-- ============================================================

create table if not exists public.patient_invitations (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  patient_id     bigint not null references public.patient(id) on delete cascade,
  phone          text not null,
  token          text not null unique
    default replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
  consent_given  boolean not null default false,
  invited_by     uuid not null references auth.users(id),
  expires_at     timestamptz not null default (now() + interval '72 hours'),
  accepted_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_patient_invitations_token   on public.patient_invitations(token);
create index if not exists idx_patient_invitations_patient on public.patient_invitations(patient_id);

create table if not exists public.patient_accounts (
  id            uuid primary key default gen_random_uuid(),
  rrn_hash      text not null unique,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.patient_otps (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  code          text not null,
  expires_at    timestamptz not null default (now() + interval '5 minutes'),
  verified_at   timestamptz,
  attempt_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_patient_otps_phone on public.patient_otps(phone, expires_at);

create table if not exists public.patient_sessions (
  id                 uuid primary key default gen_random_uuid(),
  patient_account_id uuid not null references public.patient_accounts(id) on delete cascade,
  token              text not null unique
    default replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
  expires_at         timestamptz not null default (now() + interval '30 days'),
  created_at         timestamptz not null default now()
);

create index if not exists idx_patient_sessions_token on public.patient_sessions(token);

create table if not exists public.patient_account_links (
  id                 uuid primary key default gen_random_uuid(),
  patient_account_id uuid not null references public.patient_accounts(id) on delete cascade,
  patient_id         bigint not null references public.patient(id) on delete cascade,
  institution_id     uuid not null references public.institutions(id) on delete cascade,
  linked_at          timestamptz not null default now(),
  unique(patient_account_id, patient_id)
);

create index if not exists idx_pal_account on public.patient_account_links(patient_account_id);
create index if not exists idx_pal_patient on public.patient_account_links(patient_id);

alter table public.patient_invitations    enable row level security;
alter table public.patient_accounts       enable row level security;
alter table public.patient_otps           enable row level security;
alter table public.patient_sessions       enable row level security;
alter table public.patient_account_links  enable row level security;

-- Push Subscriptions (Web Push / VAPID)
create table if not exists public.push_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  institution_id uuid not null,
  endpoint       text not null,
  p256dh         text not null,
  auth           text not null,
  created_at     timestamptz not null default now(),
  unique(user_id, endpoint)
);

create index if not exists push_subscriptions_institution
  on public.push_subscriptions(institution_id);

alter table public.push_subscriptions enable row level security;

create policy "users can read own push subscriptions"
  on public.push_subscriptions for select
  using (user_id = auth.uid());

create policy "users can insert own push subscriptions"
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());

create policy "users can delete own push subscriptions"
  on public.push_subscriptions for delete
  using (user_id = auth.uid());
