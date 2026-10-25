-- spec 038 — 환자 포털 인증(주민번호 미수집) + 환자용 상담 안내(patient_shares)
-- 대표 확정 2026-10-25: ⓐ 생년월일·주민번호 받지 않음(링크 + 등록 번호 인증번호) · ⓒ 포털 = 연결된 기록 전부 + 보낸 안내
--                      · ⓓ 안내 링크 30일 · ⓔ 기존 주민번호 계정은 다음 로그인 때 휴대폰 계정으로 전환

-- ① 환자 계정 키: 주민번호 해시 → 인증된 휴대폰 번호
alter table public.patient_accounts alter column rrn_hash drop not null;
alter table public.patient_accounts add column if not exists phone text;
create unique index if not exists patient_accounts_phone_uidx
  on public.patient_accounts (phone) where phone is not null;

-- ② 초대 링크: 30일·유효기간 내 반복 열기(accepted_at = 최초 인증 시각, 더는 막지 않음) · 안내 한 건과 연결
alter table public.patient_invitations alter column expires_at set default (now() + interval '30 days');

-- ③ 환자용 상담 안내 — 직원 기록과 별도의 환자용 문서(직원 기록은 그대로)
create table if not exists public.patient_shares (
  id               uuid primary key default gen_random_uuid(),
  institution_id   uuid not null references public.institutions(id) on delete cascade,
  patient_id       bigint not null references public.patient(id) on delete cascade,
  consultation_id  bigint references public.consultation(id) on delete set null,
  title            text not null default '',
  content          text not null default '',            -- 환자용 본문(HTML, sanitize 후 저장)
  prescriptions    jsonb not null default '[]'::jsonb,
  created_by       uuid references auth.users(id),
  author_name      text,
  sent_at          timestamptz,
  first_viewed_at  timestamptz,
  last_viewed_at   timestamptz,
  view_count       integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists idx_patient_shares_patient on public.patient_shares (patient_id, created_at desc);
create index if not exists idx_patient_shares_consultation on public.patient_shares (consultation_id);
alter table public.patient_shares enable row level security;  -- 정책 0: 서버(service_role)만 접근

alter table public.patient_invitations add column if not exists share_id uuid
  references public.patient_shares(id) on delete set null;
