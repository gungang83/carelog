-- spec 041 — AI 엔진 고르기: 작업별 모델 순서(설정) + 호출별 사용량.
-- RLS enable + 정책 0: 서버(service_role)만 접근.

create table if not exists public.ai_settings (
  key         text primary key,                 -- 'routes' = 작업별 모델 순서
  value       jsonb not null default '{}'::jsonb,
  updated_by  text,
  updated_at  timestamptz not null default now()
);
alter table public.ai_settings enable row level security;

create table if not exists public.ai_usage (
  id              bigserial primary key,
  at              timestamptz not null default now(),
  task            text not null,                -- summary | translate | patient_draft | consult_eval | chart_parse
  provider        text not null,                -- anthropic | openai
  model           text not null,                -- 응답 기준 실제 모델명
  ok              boolean not null default true,
  error           text not null default '',
  tokens_in       integer not null default 0,
  tokens_out      integer not null default 0,
  cost_usd        numeric(12,6) not null default 0,  -- 토큰 × 단가(lib/ai/catalog) 추정
  latency_ms      integer not null default 0,
  institution_id  uuid references public.institutions(id) on delete set null,
  user_email      text
);
create index if not exists idx_ai_usage_at on public.ai_usage (at desc);
create index if not exists idx_ai_usage_inst on public.ai_usage (institution_id, at desc);
alter table public.ai_usage enable row level security;
