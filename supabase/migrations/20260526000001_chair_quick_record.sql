-- Migration 006: Chair Quick Record
-- 2026-05-25
-- chairs 테이블, chair_audit_logs 테이블 신규 생성
-- consultation 테이블: patient_id nullable, chair_id/linked_at/linked_by 컬럼 추가

-- ============================================================
-- Step 1: chairs 테이블 생성
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

-- 직원: 읽기 전용
drop policy if exists "staff reads own institution chairs" on public.chairs;
create policy "staff reads own institution chairs" on public.chairs
  for select using (institution_id = public.get_my_institution_id());

-- admin/owner: 쓰기 가능
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
-- Step 2: chair_audit_logs 테이블 생성 (삽입 전용, 불변)
-- ============================================================
create table if not exists public.chair_audit_logs (
  id                uuid primary key default gen_random_uuid(),
  institution_id    uuid not null references public.institutions(id) on delete cascade,
  chair_id          uuid references public.chairs(id) on delete set null,
  consultation_id   bigint references public.consultation(id) on delete set null,
  event_type        text not null check (event_type in (
                      'record_created',
                      'record_transcribed',
                      'record_edited',
                      'patient_linked',
                      'record_deleted'
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

-- 읽기: 소속 기관 직원
drop policy if exists "staff reads own institution audit logs" on public.chair_audit_logs;
create policy "staff reads own institution audit logs" on public.chair_audit_logs
  for select using (institution_id = public.get_my_institution_id());

-- 삽입: 소속 기관 직원 (actor_user_id는 반드시 본인)
drop policy if exists "staff inserts audit logs" on public.chair_audit_logs;
create policy "staff inserts audit logs" on public.chair_audit_logs
  for insert with check (
    institution_id = public.get_my_institution_id()
    and actor_user_id = auth.uid()
  );

-- UPDATE/DELETE 정책 없음 → 불변

-- ============================================================
-- Step 3: consultation 테이블 변경
-- ============================================================

-- patient_id NOT NULL 제약 해제
alter table public.consultation
  alter column patient_id drop not null;

-- chair_id 컬럼 추가
alter table public.consultation
  add column if not exists chair_id uuid references public.chairs(id) on delete set null;

-- 환자 연결 감사 필드
alter table public.consultation
  add column if not exists linked_at timestamptz;

alter table public.consultation
  add column if not exists linked_by uuid references auth.users(id);

create index if not exists idx_consultation_chair on public.consultation(chair_id)
  where chair_id is not null;

-- ============================================================
-- Step 4: 기존 기관에 기본 체어 A/B/C 시드
-- ============================================================
insert into public.chairs (institution_id, name, display_order)
select id, 'A', 0 from public.institutions
on conflict (institution_id, name) do nothing;

insert into public.chairs (institution_id, name, display_order)
select id, 'B', 1 from public.institutions
on conflict (institution_id, name) do nothing;

insert into public.chairs (institution_id, name, display_order)
select id, 'C', 2 from public.institutions
on conflict (institution_id, name) do nothing;
