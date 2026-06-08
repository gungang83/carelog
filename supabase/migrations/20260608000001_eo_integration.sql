-- 카드 235 — EO↔Carelog 연동 (게이트웨이 마스터 ① + SSO 보정 ② + 작성자 귀속 ③)
-- 계약: EO spec-016 / 카드#226 (테오). EO = 직원·클리닉 마스터(SSOT), Carelog는 받아 캐시.
-- 민감정보(주민/계좌/급여/연락처)는 게이트웨이로 절대 들어오지 않는다.

-- ============================================================
-- ① 마스터 캐시 — clinic_members 재활용 (신규 테이블 X)
--    EO members[]를 eo_employee_id 키로 upsert. source로 수동/EO 구분.
-- ============================================================
alter table public.clinic_members
  add column if not exists eo_employee_id uuid,          -- EO members[].id (불변 식별자, upsert 키)
  add column if not exists email          text,
  add column if not exists eo_role        text,          -- clinic_admin | manager | staff
  add column if not exists position       text,          -- EO position (치과위생사 등)
  add column if not exists source         text not null default 'manual',  -- 'manual' | 'eo'
  add column if not exists synced_at      timestamptz;   -- 마지막 EO 동기화 시각

-- source 값 무결성
alter table public.clinic_members
  drop constraint if exists clinic_members_source_check;
alter table public.clinic_members
  add constraint clinic_members_source_check check (source in ('manual', 'eo'));

-- 기존 전역 unique(institution_id, name) 제약 완화:
--   EO source는 동명이인이 있을 수 있고 eo_employee_id로 유일성이 보장됨.
--   수동 입력분만 이름 중복을 막는다(부분 unique).
alter table public.clinic_members
  drop constraint if exists clinic_members_institution_id_name_key;

create unique index if not exists clinic_members_manual_name_uidx
  on public.clinic_members(institution_id, name)
  where source = 'manual';

-- EO 멤버 유일성: (기관, EO 직원 id) — upsert 키
create unique index if not exists clinic_members_eo_employee_uidx
  on public.clinic_members(institution_id, eo_employee_id)
  where eo_employee_id is not null;

-- ============================================================
-- ② SSO 보정 — institution_members에 작성자 귀속 토대 컬럼 추가
-- ============================================================
alter table public.institution_members
  add column if not exists eo_employee_id uuid,   -- SSO JWT employee_id (없으면 null = 공용계정)
  add column if not exists display_name   text;   -- SSO JWT name (작성자 표시명)

-- ============================================================
-- ③ 작성자 귀속 — consultation 작성자 스냅샷
--    상담은 Carelog 내부에만 저장. EO로 나가지 않는다(계약 §4 의료데이터 격리).
-- ============================================================
alter table public.consultation
  add column if not exists author_employee_id uuid,  -- 작성자 EO 직원 id(있으면)
  add column if not exists author_name        text;  -- 작성자 표시명(공용계정 포함)
