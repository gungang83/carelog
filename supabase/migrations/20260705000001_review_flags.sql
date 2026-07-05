-- spec 021 확인 꼬리표(review flags) — 상담 카드에 '확인 필요' 항목을 달고 완료/삭제.
--   담당이 정리 내용을 차트에 옮기기 전 확인해야 할 항목(환자·참여자·장소·내용 등)을 추적.
--   type는 코드 config로 확장(REVIEW_FLAG_TYPES). 멤버십 기반 RLS(소속 기관 한정).

create table if not exists public.consultation_review_flags (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid   not null references public.institutions(id) on delete cascade,
  consultation_id bigint not null references public.consultation(id) on delete cascade,
  type            text   not null,                    -- patient|participants|location|content|other
  note            text,
  status          text   not null default 'open',     -- open | resolved
  created_by      text,
  created_at      timestamptz not null default now(),
  resolved_by     text,
  resolved_at     timestamptz
);
create index if not exists idx_review_flags_consultation on public.consultation_review_flags(consultation_id);
create index if not exists idx_review_flags_inst_status  on public.consultation_review_flags(institution_id, status);

alter table public.consultation_review_flags enable row level security;

-- 멤버십 기반(소속 기관 멤버 읽기/쓰기). my_institution_ids()는 20260629000003에서 생성됨.
drop policy if exists "member manages review flags" on public.consultation_review_flags;
create policy "member manages review flags" on public.consultation_review_flags
  for all
  using (institution_id in (select public.my_institution_ids()))
  with check (institution_id in (select public.my_institution_ids()));
