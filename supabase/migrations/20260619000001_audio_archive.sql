-- 음성 원본 보관 (spec 009-audio-archive)
-- institutions.plan(요금제 게이트) · consultation.audio_* · audio_replay_logs · 비공개 버킷

-- 1) 기관 등급(요금제) — 기능 게이트 단일 출처
alter table public.institutions
  add column if not exists plan text not null default 'free';
do $$ begin
  alter table public.institutions
    add constraint institutions_plan_check
    check (plan in ('free','standard','pro','enterprise'));
exception when duplicate_object then null; end $$;

-- 2) 상담에 음성 원본 연결(텍스트와 분리, 음성 삭제돼도 텍스트 보존)
alter table public.consultation
  add column if not exists audio_path text,
  add column if not exists audio_uploaded_at timestamptz;

-- 3) 음성 재청취 감사(Pro 이상) — chair_audit_logs와 분리(realtime publication 오발 방지)
create table if not exists public.audio_replay_logs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  consultation_id uuid not null references public.consultation(id) on delete cascade,
  user_id uuid not null,
  played_at timestamptz not null default now()
);
create index if not exists idx_audio_replay_logs_institution
  on public.audio_replay_logs(institution_id, played_at desc);

alter table public.audio_replay_logs enable row level security;
do $$ begin
  create policy "audio_replay same institution read"
    on public.audio_replay_logs for select
    using (institution_id = public.get_my_institution_id());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "audio_replay same institution insert"
    on public.audio_replay_logs for insert
    with check (institution_id = public.get_my_institution_id());
exception when duplicate_object then null; end $$;

-- 4) 비공개 Storage 버킷 'consultation-audio' (public=false)
--    업로드/삭제/서명URL 발급은 Server Action(service role) 경유가 기본.
insert into storage.buckets (id, name, public)
values ('consultation-audio', 'consultation-audio', false)
on conflict (id) do nothing;
-- 추가 Storage RLS 정책은 운영에서 조정(서버 service role 접근이 기본이라 필수 아님).
