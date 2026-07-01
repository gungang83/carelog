-- spec 020 서버 비동기 전사 — 전사 작업 큐.
--   '상담 종료 및 저장' 시 음성만 Storage에 올리고 여기에 job을 등록 → 브라우저는 즉시 종료.
--   서버 cron 워커가 pending job을 집어 전사·요약 후 상담 레코드(consultation)를 채운다.
--   service_role(서버) 전용 — RLS 켜고 정책 0개(클라 차단, 서버만 접근).

create table if not exists public.transcription_jobs (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  consultation_id uuid not null references public.consultation(id) on delete cascade, -- 채울 대상(플레이스홀더)
  engine          text not null default 'basic',
  prefix_html     text,                       -- 사용자가 직접 입력해둔 본문(전사 앞에 보존)
  status          text not null default 'pending',  -- pending | processing | done | error
  attempts        integer not null default 0,
  error           text,
  created_by      text,                       -- 작성자 이메일
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_transcription_jobs_status on public.transcription_jobs (status, created_at);

alter table public.transcription_jobs enable row level security;
