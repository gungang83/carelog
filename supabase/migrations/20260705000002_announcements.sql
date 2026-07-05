-- spec 022 공지·업데이트(announcements) — 중앙(Carelog/EO 슈퍼어드민)이 전 기관에 내보내는 전역 공지.
--   홈 헤더 아래 한 줄 티커로 흐르고, '전체보기'로 목록을 본다. 알림함(notifications, 기관별)과 달리
--   전역(institution_id 없음) — 한 번 발행하면 모든 워크스페이스가 같은 공지를 본다.
--   발행/수정은 service_role(슈퍼어드민 서버액션)만. 직원(authenticated)은 활성·노출기간 내 공지 읽기.

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,                       -- 티커 한 줄 문구
  body        text,                                -- 상세(전체보기에서 노출, 선택)
  link        text,                                -- 클릭 시 이동(선택)
  level       text not null default 'update',      -- update | notice | info (표시 톤)
  active      boolean not null default true,
  pinned      boolean not null default false,      -- 상단 고정(중요 공지)
  starts_at   timestamptz,                         -- 노출 시작(선택, null=즉시)
  ends_at     timestamptz,                         -- 노출 종료(선택, null=무기한)
  created_by  text,                                -- 발행자 표시명
  created_at  timestamptz not null default now()
);
create index if not exists idx_announcements_active_created
  on public.announcements(active, created_at desc);

alter table public.announcements enable row level security;

-- 직원(로그인 사용자)은 활성 + 노출기간 내 공지를 읽는다. 발행/수정은 service_role(RLS 우회)만.
drop policy if exists "staff reads active announcements" on public.announcements;
create policy "staff reads active announcements" on public.announcements
  for select
  to authenticated
  using (
    active
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  );
