-- spec 038 — 병원(워크스페이스)별 문자 발신번호. 솔라피에 사전 등록(발신번호 인증)된 번호만 쓸 수 있다.
--   비어 있으면 기본 발신번호(환경변수 SOLAPI_SENDER_PHONE)로 보낸다.
alter table public.institutions add column if not exists sms_sender_phone text;
comment on column public.institutions.sms_sender_phone is '환자 문자 발신번호(솔라피 등록 번호, 숫자만) — 없으면 기본 발신번호';
