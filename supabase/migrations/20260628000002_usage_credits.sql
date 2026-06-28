-- spec 013 사용량·크레딧 대시보드(슈퍼어드민)
--   A. menu_usage_daily   — 화면(메뉴) 진입 일별 집계(클릭마다 row 안 쌓고 카운트 +1)
--   B. institution_credits — 기관별 크레딧 잔액(시뮬레이션)
--   C. credit_log         — AI 기능 차감/충전 원장(누가·얼마·어떤 기능)
--
-- 접근 모델: 세 테이블 모두 service_role(서버) 전용.
--   RLS를 켜되 정책을 두지 않는다 → 클라이언트(anon/authenticated)는 전면 차단,
--   service_role(admin client)·SECURITY DEFINER 함수만 RLS를 우회해 접근.
--   (EO는 RLS disable였으나 Carelog는 격리 우선 — 정책 0개로 더 강하게 잠근다.)
--   기관 격리는 조회 쿼리의 institution_id 필터로 보장.

-- ─── A. 메뉴(화면) 사용량 일별 집계 ─────────────────────────────────────────
create table if not exists public.menu_usage_daily (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_email     text not null,             -- 개인 단위(직원 식별). 슈퍼어드민만 열람.
  menu_id        text not null,             -- menu-config MENU_ITEMS.id ∪ 라우트 섹션 폴백
  day            date not null,             -- 진입 발생일(KST 기준)
  role_snap      text,                      -- 진입 시점 역할 스냅샷(owner/admin/staff)
  count          integer not null default 0,
  updated_at     timestamptz not null default now(),
  unique (institution_id, user_email, menu_id, day)
);
create index if not exists idx_menu_usage_inst_day  on public.menu_usage_daily (institution_id, day);
create index if not exists idx_menu_usage_inst_menu on public.menu_usage_daily (institution_id, menu_id, day);

-- 원자적 increment(레이스 안전). track API가 진입당 1회 호출.
create or replace function public.increment_menu_usage(
  p_inst uuid, p_email text, p_menu text, p_day date, p_role text
) returns void language plpgsql security definer as $$
begin
  insert into public.menu_usage_daily (institution_id, user_email, menu_id, day, role_snap, count)
  values (p_inst, p_email, p_menu, p_day, p_role, 1)
  on conflict (institution_id, user_email, menu_id, day)
  do update set count = menu_usage_daily.count + 1,
               role_snap = excluded.role_snap,
               updated_at = now();
end;
$$;

-- ─── B. 기관 크레딧 잔액(시뮬레이션) ────────────────────────────────────────
create table if not exists public.institution_credits (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  balance        integer not null default 0,
  updated_at     timestamptz not null default now()
);

-- ─── C. 크레딧 차감/충전 원장 ──────────────────────────────────────────────
create table if not exists public.credit_log (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  delta          integer not null,          -- 음수=차감, 양수=충전
  feature        text    not null,          -- transcribe_basic | transcribe_quick | ... | grant
  ref_id         text,                      -- 상담 id 등 참조(선택)
  balance_after  integer not null,
  memo           text,
  created_by     text,                      -- 사용자 이메일(누가)
  created_at     timestamptz not null default now()
);
create index if not exists idx_credit_log_inst on public.credit_log (institution_id, created_at desc);
create index if not exists idx_credit_log_feature on public.credit_log (feature, created_at desc);

-- 차감 — ★차단 안 함(임상 안정성): 잔액이 부족해도 차감을 기록(잔액 음수 허용).
--   상담 전사 hot path에서 호출되므로 절대 실패로 흐름을 막지 않는다(로그/관측 목적).
create or replace function public.deduct_credit(
  p_institution_id uuid, p_amount integer, p_feature text, p_ref_id text, p_by text, p_memo text
) returns integer language plpgsql as $$
declare cur integer;
begin
  insert into public.institution_credits (institution_id, balance) values (p_institution_id, 0)
    on conflict (institution_id) do nothing;
  update public.institution_credits
    set balance = balance - p_amount, updated_at = now()
    where institution_id = p_institution_id
    returning balance into cur;
  insert into public.credit_log (institution_id, delta, feature, ref_id, balance_after, created_by, memo)
    values (p_institution_id, -p_amount, p_feature, p_ref_id, cur, p_by, p_memo);
  return cur;
end $$;

-- 충전(시뮬레이션) — 슈퍼어드민 부여
create or replace function public.grant_credit(
  p_institution_id uuid, p_amount integer, p_by text, p_memo text
) returns integer language plpgsql as $$
declare cur integer;
begin
  insert into public.institution_credits (institution_id, balance) values (p_institution_id, p_amount)
    on conflict (institution_id) do update set balance = institution_credits.balance + p_amount, updated_at = now();
  select balance into cur from public.institution_credits where institution_id = p_institution_id;
  insert into public.credit_log (institution_id, delta, feature, ref_id, balance_after, created_by, memo)
    values (p_institution_id, p_amount, 'grant', null, cur, p_by, coalesce(p_memo, '슈퍼어드민 부여(시뮬)'));
  return cur;
end $$;

-- RLS: 켜되 정책 0개 → 클라이언트 전면 차단, service_role만 우회 접근.
alter table public.menu_usage_daily   enable row level security;
alter table public.institution_credits enable row level security;
alter table public.credit_log         enable row level security;
