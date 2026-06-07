-- 클리닉 멤버(참여자) 디렉터리 + 상담 참여자 스냅샷
-- 체어(chairs)와 동일한 워크스페이스 설정 패턴.
-- 이름은 추후 EO에서 이관 예정 — 현재는 워크스페이스에서 직접 등록한다.

create table if not exists public.clinic_members (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,
  role           text,                                  -- 예: 원장 / 직원 / 위생사 (선택)
  display_order  integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique(institution_id, name)
);

create index if not exists idx_clinic_members_institution
  on public.clinic_members(institution_id);

alter table public.clinic_members enable row level security;

-- 직원은 자기 기관 멤버 목록 조회 가능(히어로 참여자 선택용)
drop policy if exists "staff reads own institution clinic_members" on public.clinic_members;
create policy "staff reads own institution clinic_members" on public.clinic_members
  for select using (institution_id = public.get_my_institution_id());

-- 추가/수정/비활성화는 admin/owner만
drop policy if exists "admin manages clinic_members" on public.clinic_members;
create policy "admin manages clinic_members" on public.clinic_members
  for all
  using (
    institution_id = public.get_my_institution_id()
    and exists (
      select 1 from public.institution_members
      where user_id = auth.uid()
        and institution_id = public.get_my_institution_id()
        and role in ('admin', 'owner')
    )
  )
  with check (
    institution_id = public.get_my_institution_id()
    and exists (
      select 1 from public.institution_members
      where user_id = auth.uid()
        and institution_id = public.get_my_institution_id()
        and role in ('admin', 'owner')
    )
  );

-- 상담 기록에 참여자 스냅샷(멤버ID/이름/역할) 저장.
-- 이름이 추후 바뀌거나 EO로 이관돼도 기록 시점 값을 보존하기 위해 스냅샷으로 둔다.
alter table public.consultation
  add column if not exists participants jsonb not null default '[]'::jsonb;
