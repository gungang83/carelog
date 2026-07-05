-- spec 023 업데이트 피드 — 슈퍼어드민 전용 결정 상태.
--   피드 자체(업데이트 내역)는 레포 코드(lib/update-feed.ts)에 쌓이고,
--   이 테이블은 각 엔트리에 대한 대표의 결정(발행됨/보류)만 기록한다.
--   접근: 정책 없음(authenticated deny-all) — 서버액션(service_role + isSuperAdmin 가드)만 read/write.
--   → 일반 직원에게는 존재 자체가 보이지 않는다.

create table if not exists public.update_feed_decisions (
  entry_id        text primary key,               -- lib/update-feed.ts 엔트리 id
  status          text not null,                  -- published | dismissed
  announcement_id uuid references public.announcements(id) on delete set null,
  decided_at      timestamptz not null default now()
);

alter table public.update_feed_decisions enable row level security;
-- 의도적으로 정책 없음: RLS on + no policy = authenticated 전면 차단, service_role만 우회.
