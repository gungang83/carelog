-- spec 034 — 상담 품질 평가 (체크리스트 대조) · 🧪 테스트중
--   eval_templates: 평가 체크리스트(전역=institution_id NULL 가능 — 파트너 템플릿 대비)
--   eval_runs: 상담 1건 평가 결과(AI 자동 + 사람 수동 병합, 점수=실험 필드)
--   eval_grants: 열람·평가 권한 개방 대비(당사자·기획공장) — v1은 슈퍼어드민 전용이라 비어 있음
--   RLS: 전부 enable + 정책 0 (service_role만 — 슈퍼어드민 서버 액션 경유)

create table if not exists public.eval_templates (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade, -- NULL = 전역/파트너 제공
  name           text not null,
  -- items: [{ id, label, guide, type: 'auto'|'manual', weight }]
  --   auto = AI가 전사/본문에서 판정 · manual = 사람이 녹음 듣고 판정(어조·경청 등)
  --   weight = 배점(실험 — 시뮬레이션으로 정교화, null 허용)
  items          jsonb not null default '[]',
  active         boolean not null default true,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.eval_runs (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  consultation_id bigint not null references public.consultation(id) on delete cascade,
  template_id     uuid references public.eval_templates(id) on delete set null,
  status          text not null default 'done', -- done | error
  -- ai_result/manual_result: [{ item_id, verdict: 'met'|'partial'|'unmet'|'na', evidence, comment }]
  ai_result       jsonb,
  manual_result   jsonb,
  score           numeric,       -- 실험값(자동 항목 가중 합) — 표시 시 '실험' 라벨 필수
  summary         text,          -- AI 총평·개선 제안
  error           text,
  model           text,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_eval_runs_consult on public.eval_runs (consultation_id, created_at desc);
create index if not exists idx_eval_runs_inst on public.eval_runs (institution_id, created_at desc);

create table if not exists public.eval_grants (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  grantee_email  text not null,           -- 상담자 당사자 또는 기획공장 평가자
  can_view       boolean not null default true,
  can_evaluate   boolean not null default false, -- 수동 평가 입력 권한
  note           text,
  created_at     timestamptz not null default now(),
  unique (institution_id, grantee_email)
);

alter table public.eval_templates enable row level security;
alter table public.eval_runs      enable row level security;
alter table public.eval_grants    enable row level security;
-- 정책 0 — service_role(서버 액션)만 접근. 권한 개방 시 grants 기반 정책 추가 예정.
