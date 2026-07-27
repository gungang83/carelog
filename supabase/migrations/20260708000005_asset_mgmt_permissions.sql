-- spec 029 상담자료 관리 체계 (1·2·3차 통합) —
--   ① 전역 자료 분과(specialty) ② 기관 카테고리 큐레이션 ③ EO식 개인 권한 오버라이드

-- ① 전역 자료 분과 타겟 — null=전 분과 공통, 'dental'=치과 전용 (기관 자료는 미사용)
alter table public.consult_assets
  add column if not exists specialty text;

-- ② 기관 카테고리(그릇) — 기관이 구성, Library(전역+기관)에서 자료를 골라 담는다
create table if not exists public.consult_asset_categories (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,
  display_order  integer not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists idx_cac_inst on public.consult_asset_categories(institution_id, active, display_order);

create table if not exists public.consult_asset_category_items (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.consult_asset_categories(id) on delete cascade,
  asset_id      uuid not null references public.consult_assets(id) on delete cascade,
  display_order integer not null default 0,
  added_by      text,
  created_at    timestamptz not null default now(),
  unique(category_id, asset_id)
);
create index if not exists idx_caci_cat on public.consult_asset_category_items(category_id, display_order);

-- RLS: 읽기=멤버십 / 쓰기=정책 0(서버액션 service_role + 기능 권한 가드 경유)
alter table public.consult_asset_categories enable row level security;
drop policy if exists "member reads asset categories" on public.consult_asset_categories;
create policy "member reads asset categories" on public.consult_asset_categories
  for select to authenticated
  using (institution_id in (select public.my_institution_ids()));

alter table public.consult_asset_category_items enable row level security;
drop policy if exists "member reads category items" on public.consult_asset_category_items;
create policy "member reads category items" on public.consult_asset_category_items
  for select to authenticated
  using (
    category_id in (
      select id from public.consult_asset_categories
      where institution_id in (select public.my_institution_ids())
    )
  );

-- ③ 개인 권한 오버라이드 (EO permission_overrides 모델) — 판정: 개인 오버라이드 > 역할 기본값(코드)
create table if not exists public.permission_overrides (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  member_id      uuid not null references public.institution_members(id) on delete cascade,
  feature_id     text not null,               -- lib/permissions.ts FEATURES
  allowed        boolean not null,            -- true=허용 / false=차단 (행 없음=역할 기본값)
  granted_by     text,
  created_at     timestamptz not null default now(),
  unique(member_id, feature_id)
);
create index if not exists idx_po_inst on public.permission_overrides(institution_id);

-- RLS: 정책 0(전면 차단) — 조회·변경 모두 서버액션(service_role + admin 가드)만.
alter table public.permission_overrides enable row level security;
