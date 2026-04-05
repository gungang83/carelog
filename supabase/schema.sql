-- Carelog 앱과 맞추기 위한 예시 스키마입니다.
-- 이미 patient / consultation 테이블이 있다면, 컬럼 이름만 아래와 같거나 코드를 수정하세요.

-- 환자
create table if not exists public.patient (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chart_no text,
  phone text,
  created_at timestamptz not null default now()
);

-- 상담
create table if not exists public.consultation (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient (id) on delete cascade,
  content text not null default '',
  image_urls jsonb not null default '[]'::jsonb,
  prescriptions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists consultation_patient_id_idx on public.consultation (patient_id);

-- 개발용 RLS (운영에서는 로그인·역할에 맞게 정책을 좁히세요)
alter table public.patient enable row level security;
alter table public.consultation enable row level security;

drop policy if exists "carelog patient all" on public.patient;
create policy "carelog patient all" on public.patient
  for all using (true) with check (true);

drop policy if exists "carelog consultation all" on public.consultation;
create policy "carelog consultation all" on public.consultation
  for all using (true) with check (true);

-- Storage: 이미지 버킷 (Public)
insert into storage.buckets (id, name, public)
values ('consultation-images', 'consultation-images', true)
on conflict (id) do nothing;

drop policy if exists "carelog consult images read" on storage.objects;
create policy "carelog consult images read" on storage.objects
  for select using (bucket_id = 'consultation-images');

drop policy if exists "carelog consult images write" on storage.objects;
create policy "carelog consult images write" on storage.objects
  for insert with check (bucket_id = 'consultation-images');

drop policy if exists "carelog consult images update" on storage.objects;
create policy "carelog consult images update" on storage.objects
  for update using (bucket_id = 'consultation-images');

drop policy if exists "carelog consult images delete" on storage.objects;
create policy "carelog consult images delete" on storage.objects
  for delete using (bucket_id = 'consultation-images');
