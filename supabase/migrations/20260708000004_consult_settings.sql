-- spec 027 상담 세션 안전망 — 기관별 설정(jsonb 1컬럼, 소테이블 불필요).
--   { idle_minutes: 10, grace_minutes: 5, voice_detect: true } — lib/consult-settings.ts가 기본값 병합.

alter table public.institutions
  add column if not exists consult_settings jsonb not null default '{}'::jsonb;
