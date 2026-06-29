-- spec 014 일일 사용 리포트
--   A. credit_log에 실토큰(입력/출력) 컬럼 추가 — Claude 응답 usage 캡처(크레딧과 별개로 실측)
--   B. deduct_credit에 토큰 파라미터 추가(기존 6-arg → 8-arg, 기본값 0)
--   C. usage_reports — 일별 리포트 스냅샷(jsonb) 영속화(과거 열람·이력·멱등 재실행)

-- ─── A. 실토큰 컬럼 ─────────────────────────────────────────────────────────
alter table public.credit_log add column if not exists tokens_in  integer not null default 0;
alter table public.credit_log add column if not exists tokens_out integer not null default 0;

-- ─── B. deduct_credit 토큰 지원(시그니처 변경 → drop 후 재생성) ──────────────
drop function if exists public.deduct_credit(uuid, integer, text, text, text, text);
create or replace function public.deduct_credit(
  p_institution_id uuid, p_amount integer, p_feature text, p_ref_id text, p_by text, p_memo text,
  p_tokens_in integer default 0, p_tokens_out integer default 0
) returns integer language plpgsql as $$
declare cur integer;
begin
  insert into public.institution_credits (institution_id, balance) values (p_institution_id, 0)
    on conflict (institution_id) do nothing;
  update public.institution_credits
    set balance = balance - p_amount, updated_at = now()
    where institution_id = p_institution_id
    returning balance into cur;
  insert into public.credit_log
    (institution_id, delta, feature, ref_id, balance_after, created_by, memo, tokens_in, tokens_out)
    values (p_institution_id, -p_amount, p_feature, p_ref_id, cur, p_by, p_memo, p_tokens_in, p_tokens_out);
  return cur;
end $$;

-- ─── C. 리포트 스냅샷 ───────────────────────────────────────────────────────
create table if not exists public.usage_reports (
  id          uuid primary key default gen_random_uuid(),
  report_date date not null,                 -- 대상 일자(KST)
  scope       text not null default 'all',   -- 'all'(전체·슈퍼어드민) | institution_id(운영자)
  payload     jsonb not null,                -- 집계 결과 스냅샷
  created_at  timestamptz not null default now(),
  unique (report_date, scope)
);
create index if not exists idx_usage_reports_date on public.usage_reports (report_date desc);

-- RLS: enable + 정책 0개 → 클라 전면 차단, service_role만 접근(사용량 테이블과 동일).
alter table public.usage_reports enable row level security;
