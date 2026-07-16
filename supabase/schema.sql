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
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null default 'dental',
  -- plan: 요금/기능 게이트 단일 출처(migration: 20260619000001_audio_archive.sql)
  -- lab_enabled: 녹음 엔진 실험실 게이트(migration: 20260624000001_engine_lab.sql)
  --   true인 워크스페이스만 상담별 엔진 picker 노출(예미안 한정). 비-lab은 'basic' 강제.
  lab_enabled boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.institution_members (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  role           text not null default 'staff',
  invited_by     uuid references auth.users(id),
  joined_at      timestamptz not null default now(),
  is_active      boolean not null default true,         -- (migration: 20260514000001_admin_panel.sql)
  -- EO SSO 작성자 귀속 (migration: 20260608000001_eo_integration.sql)
  eo_employee_id uuid,                                  -- SSO JWT employee_id(공용계정이면 null)
  display_name   text,                                  -- SSO JWT name(작성자 표시명)
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
  id              bigint primary key generated always as identity,  -- ★실제 DB는 bigint(문서 드리프트 정정 2026-06-29)
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
  participants    jsonb not null default '[]'::jsonb,
  -- 작성자 귀속 (migration: 20260608000001_eo_integration.sql) — 상담은 Carelog 내부에만 저장
  author_employee_id uuid,    -- 작성자 EO 직원 id(있으면)
  author_name        text     -- 작성자 표시명(공용계정 포함)
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
  -- EO 마스터 캐시 (migration: 20260608000001_eo_integration.sql)
  eo_employee_id uuid,                                  -- EO members[].id(upsert 키, 불변)
  email          text,
  eo_role        text,                                  -- clinic_admin | manager | staff
  position       text,
  source         text not null default 'manual' check (source in ('manual', 'eo')),
  synced_at      timestamptz
  -- 기존 unique(institution_id, name)는 EO 동명이인 대비 부분 unique로 완화(아래 인덱스)
);

create index if not exists idx_clinic_members_institution on public.clinic_members(institution_id);
-- 수동 추가분만 이름 중복 방지(EO source는 eo_employee_id로 유일성 보장)
create unique index if not exists clinic_members_manual_name_uidx
  on public.clinic_members(institution_id, name) where source = 'manual';
create unique index if not exists clinic_members_eo_employee_uidx
  on public.clinic_members(institution_id, eo_employee_id) where eo_employee_id is not null;

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

-- ───────────────────────────────────────────────────────────────────────────
-- Realtime (spec 007 — 실시간 체어 상담기록 알림)
-- chair_audit_logs INSERT를 Supabase Realtime으로 구독한다(진료본문 없는 감사로그).
-- 기관 격리는 기존 RLS("staff reads own institution audit logs")가 강제.
-- migration: 20260614000001_realtime_chair_audit_logs.sql
-- alter publication supabase_realtime add table public.chair_audit_logs;
-- ───────────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────────
-- 음성 원본 보관 (spec 009-audio-archive) — migration: 20260619000001_audio_archive.sql
-- institutions.plan(요금 등급, 기능 게이트 단일 출처):
--   alter table public.institutions add column plan text not null default 'free'
--     check (plan in ('free','standard','pro','enterprise'));
-- consultation 음성 연결(텍스트와 분리, 음성 삭제돼도 텍스트 보존):
--   alter table public.consultation
--     add column audio_path text, add column audio_uploaded_at timestamptz;
-- audio_replay_logs(Pro 이상 재청취 감사; chair_audit_logs와 분리 → realtime 오발 방지):
--   create table public.audio_replay_logs(
--     id uuid pk, institution_id uuid, consultation_id bigint(→consultation.id), user_id uuid,
--     played_at timestamptz default now()); RLS: 같은 기관 직원 select/insert.
--   주의: consultation.id 는 실제 DB에서 bigint → FK 타입 bigint.
-- 비공개 Storage 버킷 'consultation-audio'(public=false) — 서명 URL로만 접근.
-- ───────────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────────
-- 녹음 엔진 실험실 (Engine Lab) — O-1 다국어 통역 검증. migration: 20260624000001_engine_lab.sql
-- institutions.lab_enabled boolean default false  (위 institutions 정의 참조)
-- consultation.transcription_engine: 그 기록을 만든 엔진(null=레거시/수동). 평가·비교 데이터.
--   alter table public.consultation add column transcription_engine text;
-- 엔진: basic(한국어 Whisper+요약·기본) / multilingual(자동감지+번역). comparison은 실행 모드.
-- 비-lab 워크스페이스는 서버(chairs.transcribeChairAudio)에서 'basic' 강제 → 사고 차단.
-- ───────────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────────
-- 알림함 (spec 012-notification-inbox) — migration: 20260628000001_notifications.sql
-- 메시지(notifications)와 유저별 읽음(notification_reads=행 존재) 분리.
--   create table public.notifications(
--     id uuid pk default gen_random_uuid(), institution_id uuid not null → institutions,
--     created_at timestamptz default now(), title text, body text,
--     type text default 'system', link text default '/', recipients text default 'all', created_by uuid);
--   create table public.notification_reads(
--     id uuid pk, notification_id uuid → notifications on delete cascade, user_id uuid,
--     created_at, unique(notification_id, user_id));  -- 행 존재 = 읽음
-- RLS: notifications select = institution_id = get_my_institution_id()(브라우저 realtime 구독도 이 정책).
--      notification_reads select/insert/delete = user_id = auth.uid(). 적재는 service_role.
-- Realtime: alter publication supabase_realtime add table public.notifications;  (chair_audit_logs와 동일 패턴)
-- 적재 진입점: lib/notifications.ts sendNotification (chairs.saveChairRecord·consultations.saveConsultation에서 호출).
-- ───────────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────────
-- 사용량·크레딧 (spec 013-usage-credit-dashboard) — migration: 20260628000002_usage_credits.sql
-- A. menu_usage_daily   — 화면 진입 일별 집계(클릭당 row 폭증 방지, 카운트 +1)
--   create table public.menu_usage_daily(
--     id uuid pk, institution_id uuid not null → institutions, user_email text not null,
--     menu_id text not null, day date not null, role_snap text, count int default 0,
--     updated_at, unique(institution_id, user_email, menu_id, day));
--   func increment_menu_usage(p_inst,p_email,p_menu,p_day,p_role)  -- UPSERT +1, SECURITY DEFINER
-- B. institution_credits — 기관 크레딧 잔액(시뮬레이션, 음수 허용)
--   create table public.institution_credits(institution_id uuid pk → institutions, balance int default 0, updated_at);
-- C. credit_log         — 차감/충전 원장(누가·얼마·어떤 기능)
--   create table public.credit_log(
--     id uuid pk, institution_id uuid not null → institutions, delta int not null,
--     feature text not null, ref_id text, balance_after int not null, memo text,
--     created_by text, created_at);  -- delta<0=차감, >0=충전(grant)
--   func deduct_credit(...)  -- ★비차단: 잔액 부족해도 차감·기록(음수 허용), 차감 후 잔액 반환
--   func grant_credit(...)   -- 충전 + grant 로그
-- RLS: 세 테이블 enable + 정책 0개 → 클라(anon/authenticated) 전면 차단, service_role만 접근.
--   기관 격리는 조회 쿼리 institution_id 필터. (EO는 RLS disable였으나 Carelog는 정책0으로 더 강하게 잠금)
-- 배선: app/actions/transcribe.ts recordUsage(비차단) → deduct_credit. 메뉴는 RouteTracker→/api/menu-usage/track.
-- 단가(lib/credits.ts): quick1/basic2/detailed3/dental3/multilingual3/comparison5/chunk_segment1/summarize_chunk2.
-- ───────────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────────
-- 일일 사용 리포트 (spec 014-daily-usage-report) — migration: 20260628000003_daily_report.sql
-- credit_log 확장: tokens_in·tokens_out integer default 0 (Claude 응답 usage 실토큰).
-- deduct_credit: 6-arg → 8-arg(p_tokens_in/out default 0) 재생성. 여전히 비차단(음수 허용).
-- usage_reports — 일별 리포트 스냅샷(jsonb), 멱등 발행:
--   create table public.usage_reports(
--     id uuid pk, report_date date not null, scope text default 'all',  -- 'all' | institution_id
--     payload jsonb not null, created_at, unique(report_date, scope));
-- RLS: usage_reports enable + 정책 0개(service_role만). 사용량 테이블과 동일.
-- 발행: /api/cron/daily-usage-report (매일 08:00 KST = 0 23 * * * UTC, CRON_SECRET/슈퍼어드민).
--   lib/usage/daily-report.ts buildDailyReport(KST 0~24시: menu_usage_daily day + credit_log 경계).
--   전달: 알림함(recipients=슈퍼어드민 email) + sendPushToUser(본인 기기). 열람: /admin/usage/report/[date].
-- ───────────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────────
-- 확인 꼬리표 (spec 021-review-flags) — migration: 20260705000001_review_flags.sql
-- 상담 카드에 '확인 필요' 태그. 담당이 차트 이관 전 확인할 항목(환자·참여자·장소·내용) 추적.
--   create table public.consultation_review_flags(
--     id uuid pk, institution_id uuid→institutions cascade,
--     consultation_id bigint→consultation cascade,   -- consultation.id는 bigint
--     type text not null,        -- patient|participants|location|content|other (코드 config 확장)
--     note text, status text default 'open',          -- open | resolved
--     created_by text, created_at, resolved_by text, resolved_at);
--   index: (consultation_id), (institution_id, status).
-- RLS: 멤버십 기반 — institution_id in (select public.my_institution_ids()) using/with check.
-- 배선: app/actions/review-flags.ts(조회 일괄·추가·완료·삭제). UI components/consultation/review-flags.tsx.
--   타입 lib/review-flags.ts REVIEW_FLAG_TYPES. 공용 카드 components/consultation/consultation-card.tsx 하단.
-- ───────────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────────
-- 공지·업데이트 (spec 022-announcements) — migration: 20260705000002_announcements.sql
-- 중앙(슈퍼어드민)이 전 기관에 내보내는 전역 공지. 알림함(notifications, 기관별)과 달리
--   institution_id 없음 → 한 번 발행하면 모든 워크스페이스 공통. 홈 헤더 아래 티커로 흐름.
--   create table public.announcements(
--     id uuid pk, title text not null, body text, link text,
--     level text default 'update',   -- update | notice | info (표시 톤)
--     active bool default true, pinned bool default false,
--     starts_at timestamptz, ends_at timestamptz,  -- 노출기간(선택)
--     created_by text, created_at);
--   index: (active, created_at desc).
-- RLS: 직원(authenticated) read = active and (starts_at null|≤now) and (ends_at null|≥now).
--   발행/수정은 정책 없음 → 클라 쓰기 차단, 슈퍼어드민 서버액션이 service_role(admin 클라)로 우회.
-- 배선: app/actions/announcements.ts(getActiveAnnouncements + CRUD). UI announcement-ticker.tsx,
--   /announcements(전체보기), /admin/announcements(발행). 타입 lib/announcements.ts.
-- ───────────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────────
-- 업데이트 피드 (spec 023-update-feed) — migration: 20260705000003_update_feed.sql
-- 슈퍼어드민(대표)만 보는 업데이트 내역함. 피드 자체는 레포 코드(lib/update-feed.ts)에
--   세션 마무리마다 append → 배포와 함께 쌓임. DB에는 각 엔트리의 결정 상태만 기록.
--   create table public.update_feed_decisions(
--     entry_id text pk,              -- lib/update-feed.ts 엔트리 id
--     status text not null,          -- published | dismissed
--     announcement_id uuid→announcements set null,  -- 발행 시 연결된 공지
--     decided_at timestamptz default now());
-- RLS: enable + 정책 0개(authenticated deny-all) — 서버액션(service_role + isSuperAdmin)만.
-- 배선: app/actions/update-feed.ts(getUpdateFeed·publishUpdateAnnouncement·dismiss·clear).
--   UI /admin/updates + components/admin/update-feed-manager.tsx(선택→문구 조합→발행/보류).
-- ───────────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────────
-- 상담 이미지 라이브러리 (spec 025-consult-assets) — migration: 20260708000001_consult_assets.sql
-- 기관이 미리 등록해 두고 상담 중 에디터 픽커('📚 자료')로 삽입하는 설명 자료.
--   create table public.consult_assets(
--     id uuid pk, institution_id uuid→institutions cascade (null=전역 Carelog 제공, v1은 항상 기관),
--     title text not null, category text default 'general',  -- lib/consult-assets.ts config 확장형
--     image_url text not null,   -- 'consult-assets' 공개 버킷(webp 압축), 업로드는 서버액션 service_role
--     caption text, display_order int, active bool, created_by text, created_at);
--   index: (institution_id, active, category, display_order).
-- RLS: read = 자기 기관 멤버십 + 활성 전역 / write = owner·admin 멤버십(전역은 service_role만).
-- 삭제 시 스토리지 원본은 보존(이미 상담 기록 본문에 삽입된 이미지 URL이 깨지지 않게).
-- storage.buckets: 'consult-assets' public read.
-- 배선: app/actions/consult-assets.ts, /settings 상담 자료 섹션, components/consult-assets/asset-picker.tsx,
--   rich-text-editor.tsx(픽커·전체화면·이미지 정렬 data-align).
-- ───────────────────────────────────────────────────────────────────────────
