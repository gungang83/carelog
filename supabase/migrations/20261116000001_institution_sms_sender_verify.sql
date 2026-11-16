-- 워크스페이스(병원)별 문자 발신번호 고르기 — 테스트 문자가 실제로 나간 번호만 쓴다.
--   sms_sender_phone: 20261025000002에서 만든 칸(미실행이었다면 여기서 함께 만든다)
--   sms_sender_verified_at: 그 번호로 테스트 문자가 나간 시각 — 이 값이 있을 때만 발신번호로 쓴다
alter table public.institutions add column if not exists sms_sender_phone text;
alter table public.institutions add column if not exists sms_sender_verified_at timestamptz;
comment on column public.institutions.sms_sender_phone is '환자 문자 발신번호(솔라피 등록 번호, 숫자만) — 없거나 미확인이면 기본 발신번호';
comment on column public.institutions.sms_sender_verified_at is '발신번호 테스트 문자 성공 시각(설정 화면에서 확인) — null이면 기본 발신번호';
