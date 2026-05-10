-- Migration: patient_portal
-- Creates 5 tables for the patient portal feature

-- 1. patient_invitations: SMS invite records from staff to patients
create table public.patient_invitations (
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

create index idx_patient_invitations_token   on public.patient_invitations(token);
create index idx_patient_invitations_patient on public.patient_invitations(patient_id);

-- 2. patient_accounts: Patient portal accounts (RRN-hash based, separate from Supabase Auth)
create table public.patient_accounts (
  id            uuid primary key default gen_random_uuid(),
  rrn_hash      text not null unique,  -- SHA-256(normalized RRN), permanent identifier
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- 3. patient_otps: Phone OTP verification codes
create table public.patient_otps (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  code          text not null,           -- 6-digit numeric code
  expires_at    timestamptz not null default (now() + interval '5 minutes'),
  verified_at   timestamptz,
  attempt_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create index idx_patient_otps_phone on public.patient_otps(phone, expires_at);

-- 4. patient_sessions: Session tokens for logged-in patients
create table public.patient_sessions (
  id                 uuid primary key default gen_random_uuid(),
  patient_account_id uuid not null references public.patient_accounts(id) on delete cascade,
  token              text not null unique
    default replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
  expires_at         timestamptz not null default (now() + interval '30 days'),
  created_at         timestamptz not null default now()
);

create index idx_patient_sessions_token on public.patient_sessions(token);

-- 5. patient_account_links: M:N link between patient_accounts and per-institution patient records
create table public.patient_account_links (
  id                 uuid primary key default gen_random_uuid(),
  patient_account_id uuid not null references public.patient_accounts(id) on delete cascade,
  patient_id         bigint not null references public.patient(id) on delete cascade,
  institution_id     uuid not null references public.institutions(id) on delete cascade,
  linked_at          timestamptz not null default now(),
  unique(patient_account_id, patient_id)
);

create index idx_pal_account on public.patient_account_links(patient_account_id);
create index idx_pal_patient on public.patient_account_links(patient_id);

-- RLS: All patient portal tables accessible only via Service Role Admin Client
-- No policies = anon/authenticated keys are blocked
alter table public.patient_invitations    enable row level security;
alter table public.patient_accounts       enable row level security;
alter table public.patient_otps           enable row level security;
alter table public.patient_sessions       enable row level security;
alter table public.patient_account_links  enable row level security;
