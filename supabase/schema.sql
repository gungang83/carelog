-- Carelog 전체 스키마 (참조용)
-- 마지막 동기화: 2026-05-25
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
  patient_id      bigint references public.patient(id) on delete cascade,  -- nullable: 체어 임시 기록
  content         text not null default '',
  image_urls      jsonb not null default '[]'::jsonb,
  prescriptions   jsonb not null default '[]'::jsonb,
  station_name    text,
  status          text not null default 'confirmed' check (status in ('draft', 'confirmed')),
  sms_sent_at     timestamptz,
  created_at      timestamptz not null default now(),
  -- 체어 임시 기록 필드 (migration: 20260526000001_chair_quick_record.sql)
  chair_id        uuid references public.chairs(id) on delete set null,
  linked_at       timestamptz,
  linked_by       uuid references auth.users(id),
  -- 상담 참여자 스냅샷 [{id,name,role}] (migration: 20260607000001_clinic_members.sql)
  participants    jsonb not null default '[]'::jsonb
);

create index if not exists consultation_patient_id_idx on public.consultation(patient_id);
create index if not exists idx_consultation_chair on public.consultation(chair_id) where chair_id is not null;

-- ============================================================
-- 체어 (진료 공간 단위)
-- ============================================================
create table if not exists public.chairs (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,
  display_order  integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique(institution_id, name)
);

create index if not exists idx_chairs_institution on public.chairs(institution_id);

alter table public.chairs enable row level security;
drop policy if exists "staff reads own institution chairs" on public.chairs;
create policy "staff reads own institution chairs" on public.chairs
  for select using (institution_id = public.get_my_institution_id());
drop policy if exists "admin manages chairs" on public.chairs;
create policy "admin manages chairs" on public.chairs
  for all
  using (
    institution_id = public.get_my_institution_id()
    and exists (
      select 1 from public.institution_members
      where user_id = auth.uid()
        and institution_id = public.get_my_institution_id()
        and role in ('admin', 'owner')
    )
  )
  with check (
    institution_id = public.get_my_institution_id()
    and exists (
      select 1 from public.institution_members
      where user_id = auth.uid()
        and institution_id = public.get_my_institution_id()
        and role in ('admin', 'owner')
    )
  );

-- ============================================================
-- 클리닉 멤버 (참여자 디렉터리) — 체어와 동일 패턴, 이름은 추후 EO 이관
-- ============================================================
create table if not exists public.clinic_members (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,
  role           text,
  display_order  integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique(institution_id, name)
);

create index if not exists idx_clinic_members_institution on public.clinic_members(institution_id);

alter table public.clinic_members enable row level security;
drop policy if exists "staff reads own institution clinic_members" on public.clinic_members;
create policy "staff reads own institution clinic_members" on public.clinic_members
  for select using (institution_id = public.get_my_institution_id());
drop policy if exists "admin manages clinic_members" on public.clinic_members;
create policy "admin manages clinic_members" on public.clinic_members
  for all
  using (
    institution_id = public.get_my_institution_id()
    and exists (
      select 1 from public.institution_members
      where user_id = auth.uid()
        and institution_id = public.get_my_institution_id()
        and role in ('admin', 'owner')
    )
  )
  with check (
    institution_id = public.get_my_institution_id()
    and exists (
      select 1 from public.institution_members
      where user_id = auth.uid()
        and institution_id = public.get_my_institution_id()
        and role in ('admin', 'owner')
    )
  );

-- ============================================================
-- 체어 감사 로그 (삽입 전용, 불변)
-- ============================================================
create table if not exists public.chair_audit_logs (
  id                uuid primary key default gen_random_uuid(),
  institution_id    uuid not null references public.institutions(id) on delete cascade,
  chair_id          uuid references public.chairs(id) on delete set null,
  consultation_id   bigint references public.consultation(id) on delete set null,
  event_type        text not null check (event_type in (
                      'record_created', 'record_transcribed', 'record_edited',
                      'patient_linked', 'record_deleted'
                    )),
  actor_user_id     uuid not null references auth.users(id),
  patient_id_before bigint,
  patient_id_after  bigint,
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now()
);

create index if not exists idx_cal_institution on public.chair_audit_logs(institution_id);
create index if not exists idx_cal_chair on public.chair_audit_logs(chair_id);
create index if not exists idx_cal_consultation on public.chair_audit_logs(consultation_id);

alter table public.chair_audit_logs enable row level security;
drop policy if exists "staff reads own institution audit logs" on public.chair_audit_logs;
create policy "staff reads own institution audit logs" on public.chair_audit_logs
  for select using (institution_id = public.get_my_institution_id());
drop policy if exists "staff inserts audit logs" on public.chair_audit_logs;
create policy "staff inserts audit logs" on public.chair_audit_logs
  for insert with check (
    institution_id = public.get_my_institution_id()
    and actor_user_id = auth.uid()
  );
-- UPDATE/DELETE 정책 없음 → 불변

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

-- ============================================================
-- 환자 인증 링크 (migration: 20260517000002_patient_auth_links.sql)
-- ============================================================

create table if not exists public.patient_auth_links (
  id                  uuid primary key default gen_random_uuid(),
  auth_user_id        uuid not null references auth.users(id) on delete cascade,
  patient_account_id  uuid not null references public.patient_accounts(id) on delete cascade,
  provider            text not null default 'google',
  created_at          timestamptz not null default now(),
  unique(auth_user_id),
  unique(patient_account_id, provider)
);

create index if not exists idx_pal_auth_user on public.patient_auth_links(auth_user_id);
create index if not exists idx_pal_patient_account on public.patient_auth_links(patient_account_id);

alter table public.patient_auth_links enable row level security;

create policy "patient can read own auth link"
  on public.patient_auth_links for select
  using (auth_user_id = auth.uid());

-- ============================================================
-- 활동 로그 (migration: 20260515000001_activity_logs.sql
--            + 20260601000001_activity_log_patient_sync.sql)
-- ============================================================

create table if not exists public.activity_logs (
  id              uuid        primary key default gen_random_uuid(),
  institution_id  uuid        not null,
  event_type      text        not null,
  patient_id      bigint,
  consultation_id bigint,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists activity_logs_institution_created
  on public.activity_logs(institution_id, created_at desc);

alter table public.activity_logs enable row level security;
drop policy if exists "institution members can read activity_logs" on public.activity_logs;
create policy "institution members can read activity_logs"
  on public.activity_logs for select
  using (institution_id = public.get_my_institution_id());

-- INSERT 시 자동 로그 — 단, 미연결(draft, patient_id is null)은 활동피드에서 제외
create or replace function public._log_consultation_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.patient_id is null then
    return new;
  end if;
  insert into public.activity_logs (institution_id, event_type, patient_id, consultation_id, metadata)
  values (
    new.institution_id, 'consultation.created', new.patient_id, new.id,
    jsonb_build_object('content_preview', left(regexp_replace(new.content, '<[^>]*>', '', 'g'), 80))
  );
  return new;
end;
$$;

drop trigger if exists trg_consultation_created_log on public.consultation;
create trigger trg_consultation_created_log
  after insert on public.consultation
  for each row execute function public._log_consultation_created();

-- patient_id 변경(체어 기록 연결/재연결/해제) 시 활동로그 동기화
create or replace function public._log_consultation_patient_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.patient_id is distinct from old.patient_id then
    delete from public.activity_logs where consultation_id = new.id;
    if new.patient_id is not null then
      insert into public.activity_logs (institution_id, event_type, patient_id, consultation_id, metadata, created_at)
      values (
        new.institution_id, 'consultation.created', new.patient_id, new.id,
        jsonb_build_object('content_preview', left(regexp_replace(new.content, '<[^>]*>', '', 'g'), 80)),
        now()
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_consultation_patient_changed_log on public.consultation;
create trigger trg_consultation_patient_changed_log
  after update of patient_id on public.consultation
  for each row execute function public._log_consultation_patient_changed();

-- 환자 전용 Web Push 구독 (patient_account_id 기준)
create table if not exists public.patient_push_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  patient_account_id  uuid not null references public.patient_accounts(id) on delete cascade,
  endpoint            text not null,
  p256dh              text not null,
  auth                text not null,
  created_at          timestamptz not null default now(),
  unique(patient_account_id, endpoint)
);

create index if not exists idx_pps_account on public.patient_push_subscriptions(patient_account_id);

alter table public.patient_push_subscriptions enable row level security;
-- 환자는 Server Action(admin client)을 통해서만 접근
