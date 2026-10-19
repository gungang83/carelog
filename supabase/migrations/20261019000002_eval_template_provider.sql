-- spec 034 보강 — 평가 템플릿 제공 주체(provider) 3층 구분
--   provider NULL = 케어로그 기본 제공 · '기획공장' 등 = 컨설팅 파트너 제공
--   배포 범위는 기존 institution_id 그대로: NULL = 전 기관 공통 / 지정 = 해당 워크스페이스 전용
--   → (전역·케어로그) (전역·파트너) (기관·파트너) (기관 전용) 조합 모두 표현 가능
alter table public.eval_templates add column if not exists provider text;
