-- spec 028 치료 항목 사전 — 견적 빌더의 기관 프리셋(항목명·참고 단가).
--   견적 자체는 DB에 저장하지 않는다(본문 [치료비 견적] 평문 블록이 기록 — 데이터화는 후속 스펙).

create table if not exists public.treatment_items (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,
  price          integer not null default 0,   -- 참고 단가(원) — 빌더에서 건별 수정
  display_order  integer not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists idx_treatment_items_inst
  on public.treatment_items(institution_id, active, display_order);

alter table public.treatment_items enable row level security;

-- 읽기: 자기 기관 멤버(빌더는 모든 직원이 사용)
drop policy if exists "member reads treatment_items" on public.treatment_items;
create policy "member reads treatment_items" on public.treatment_items
  for select
  to authenticated
  using (institution_id in (select public.my_institution_ids()));

-- 쓰기: owner/admin
drop policy if exists "admin manages treatment_items" on public.treatment_items;
create policy "admin manages treatment_items" on public.treatment_items
  for all
  to authenticated
  using (
    institution_id in (select public.my_institution_ids())
    and exists (
      select 1 from public.institution_members m
      where m.user_id = auth.uid()
        and m.institution_id = treatment_items.institution_id
        and m.role in ('owner', 'admin')
        and m.is_active
    )
  )
  with check (
    institution_id in (select public.my_institution_ids())
    and exists (
      select 1 from public.institution_members m
      where m.user_id = auth.uid()
        and m.institution_id = treatment_items.institution_id
        and m.role in ('owner', 'admin')
        and m.is_active
    )
  );
