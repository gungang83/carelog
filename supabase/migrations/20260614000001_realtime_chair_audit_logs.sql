-- spec 007: 실시간 체어 상담기록 알림
-- chair_audit_logs INSERT를 Supabase Realtime(postgres_changes)으로 구독하기 위해
-- supabase_realtime publication에 테이블을 추가한다.
-- 기관 격리는 기존 RLS 정책("staff reads own institution audit logs")이 강제한다.
-- (진료 본문이 든 consultation은 의도적으로 구독 대상에서 제외 — 전송선 PII/진료내용 0)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chair_audit_logs'
  ) then
    alter publication supabase_realtime add table public.chair_audit_logs;
  end if;
end $$;
