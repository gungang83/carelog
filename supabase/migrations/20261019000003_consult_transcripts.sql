-- spec 034 보강 — 전사 원문 보관 (평가 정확도의 전제)
--   지금까지 파이프라인(음성→전사 원문→요약)에서 원문 텍스트는 요약 후 폐기됐다.
--   평가는 요약 기반으로는 대부분 '판정불가' → 원문을 함께 보관한다(대표 확정 2026-10-20).
--   민감도 높음(대화 전문) → RLS enable + 정책 0: service_role 서버 액션만 접근, 클라 직접 조회 불가.

create table if not exists public.consultation_transcripts (
  consultation_id bigint primary key references public.consultation(id) on delete cascade,
  transcript      text not null,  -- 전사 원문(오타 포함 — 평가 프롬프트에서 감안)
  engine          text,           -- 원문을 만든 엔진(basic/quick/chunk/...)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.consultation_transcripts enable row level security;

-- 평가 결과에 판정 근거 소스 표시: transcript(원문 기반) | summary(요약 기반)
alter table public.eval_runs add column if not exists basis text;

-- 서버 전사 job의 원문 저장 방식: replace(같은 음성 재전사 — 재요약·원문확보) | append(이어서 상담 — 새 녹음)
alter table public.transcription_jobs add column if not exists transcript_mode text;
