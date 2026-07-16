-- spec 025 상담 이미지 라이브러리 — 기관이 미리 등록해 두고 상담 중 에디터 픽커로
--   꺼내 쓰는 설명 자료(임플란트 단계 그림·치식도·장치 사진 등).
--   institution_id nullable = 전역(Carelog 제공) 확장용 — v1은 항상 기관값, 전역 발행 UI는 후속.
--   업로드는 서버액션(service_role)이 수행 → storage 정책 불필요, 버킷은 public read만.

create table if not exists public.consult_assets (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade,  -- null = 전역(후속)
  title          text not null,
  category       text not null default 'general',   -- lib/consult-assets.ts config (확장형)
  image_url      text not null,                      -- consult-assets 버킷 public URL(webp 압축)
  caption        text,                               -- 삽입 시 딸려가는 설명 문구(선택)
  display_order  integer not null default 0,
  active         boolean not null default true,
  created_by     text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_consult_assets_inst
  on public.consult_assets(institution_id, active, category, display_order);

alter table public.consult_assets enable row level security;

-- 읽기: 자기 기관 자산(멤버십) + 활성 전역 자산(후속 대비)
drop policy if exists "member reads consult_assets" on public.consult_assets;
create policy "member reads consult_assets" on public.consult_assets
  for select
  to authenticated
  using (
    (institution_id is null and active)
    or institution_id in (select public.my_institution_ids())
  );

-- 쓰기: 자기 기관 자산을 owner/admin만. 전역(null)은 정책 없음 → service_role만.
drop policy if exists "admin manages consult_assets" on public.consult_assets;
create policy "admin manages consult_assets" on public.consult_assets
  for all
  to authenticated
  using (
    institution_id in (select public.my_institution_ids())
    and exists (
      select 1 from public.institution_members m
      where m.user_id = auth.uid()
        and m.institution_id = consult_assets.institution_id
        and m.role in ('owner', 'admin')
        and m.is_active
    )
  )
  with check (
    institution_id in (select public.my_institution_ids())
    and exists (
      select 1 from public.institution_members m
      where m.user_id = auth.uid()
        and m.institution_id = consult_assets.institution_id
        and m.role in ('owner', 'admin')
        and m.is_active
    )
  );

-- 공개 Storage 버킷 'consult-assets' (public read). 업로드/삭제는 서버액션(service_role) 전용.
insert into storage.buckets (id, name, public)
values ('consult-assets', 'consult-assets', true)
on conflict (id) do nothing;
