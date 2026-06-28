-- spec 012 알림함 — notifications(broadcast 본문) + notification_reads(유저별 읽음=행 존재)
-- 기관 격리(RLS) + realtime publication. 서버(service_role)는 RLS 우회로 적재.

create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  created_at     timestamptz not null default now(),
  title          text not null,
  body           text,
  type           text not null default 'system',   -- consultation_saved | consultation_linked | system | announcement ...
  link           text not null default '/',
  recipients     text not null default 'all',       -- 'all' | 'admins' | 이메일
  created_by     uuid
);
create index if not exists idx_notifications_inst_created
  on public.notifications(institution_id, created_at desc);

create table if not exists public.notification_reads (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id         uuid not null,
  created_at      timestamptz not null default now(),
  unique(notification_id, user_id)
);
create index if not exists idx_notification_reads_user on public.notification_reads(user_id);

alter table public.notifications      enable row level security;
alter table public.notification_reads enable row level security;

-- notifications: 같은 기관 멤버 읽기(브라우저 realtime 구독도 이 정책을 따른다). 적재는 service_role.
drop policy if exists "staff reads own institution notifications" on public.notifications;
create policy "staff reads own institution notifications" on public.notifications
  for select using (institution_id = public.get_my_institution_id());

-- notification_reads: 본인 것만 읽기/쓰기/삭제(읽음 상태는 사용자별 독립).
drop policy if exists "user reads own notification_reads" on public.notification_reads;
create policy "user reads own notification_reads" on public.notification_reads
  for select using (user_id = auth.uid());
drop policy if exists "user inserts own notification_reads" on public.notification_reads;
create policy "user inserts own notification_reads" on public.notification_reads
  for insert with check (user_id = auth.uid());
drop policy if exists "user deletes own notification_reads" on public.notification_reads;
create policy "user deletes own notification_reads" on public.notification_reads
  for delete using (user_id = auth.uid());

-- Realtime: 새 알림 INSERT를 브라우저가 institution_id 필터로 구독(chair_audit_logs와 동일 패턴).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
