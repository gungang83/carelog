-- spec 040 — 구강 지표 기록(잇몸 기록·치주 차트부터). 측정 한 번 = 한 행(회차).
-- data = 지표 등록부 기준 기록 {v, thirdMolars, entries:[{m,t,s,p,f,v,at,src,review,utt}]} · summary = 저장 시 계산 요약.
-- RLS enable + 정책 0: 서버(service_role)만 접근 — 기관 멤버십 가드는 서버 액션.

create table if not exists public.oral_exams (
  id               uuid primary key default gen_random_uuid(),
  institution_id   uuid not null references public.institutions(id) on delete cascade,
  patient_id       bigint not null references public.patient(id) on delete cascade,
  consultation_id  bigint references public.consultation(id) on delete set null,
  kind             text not null default 'perio',              -- 이후 'brush'(치간칫솔) 등
  status           text not null default 'draft' check (status in ('draft', 'done')),
  data             jsonb not null default '{}'::jsonb,
  summary          jsonb not null default '{}'::jsonb,
  recorded_by      text,
  recorded_at      timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_oral_exams_patient on public.oral_exams (patient_id, recorded_at desc);
create index if not exists idx_oral_exams_inst on public.oral_exams (institution_id, recorded_at desc);
alter table public.oral_exams enable row level security;
