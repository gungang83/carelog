-- 플랫폼(케어로그 전체) 설정 — 슈퍼어드민이 화면에서 바꾸는 값. 첫 키: 'sms_default_sender' {phone}
--   서버(service_role)만 읽고 쓴다: RLS 켜고 정책 없음.
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
comment on table public.platform_settings is '케어로그 전체 설정(슈퍼어드민) — sms_default_sender 등. service_role 전용';
