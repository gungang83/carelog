-- spec 035 v2 — 대표 피드백(2026-10-20) 반영
--   ①세트 의뢰: 기공지 여러 장(기공물 여러 개)을 한 번에 — 장마다 lab_orders 1행, set_id로 묶음
--   ②의뢰일(order_date, 기본 오늘) — payload에도 포함
--   ③사후 수정·첨부 추가: revision + edit_log(누가·언제·수정 시점의 전송/포탈 상태 — 접수·제작 후 수정 식별)
alter table public.lab_orders add column if not exists set_id   uuid;
alter table public.lab_orders add column if not exists revision integer not null default 1;
-- edit_log: [{ at, by, status_before, portal_status_before }]
alter table public.lab_orders add column if not exists edit_log jsonb not null default '[]';
create index if not exists idx_lab_orders_set on public.lab_orders (set_id) where set_id is not null;
