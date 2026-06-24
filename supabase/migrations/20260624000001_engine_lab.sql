-- ============================================================
-- 녹음 엔진 실험실 (Engine Lab) — O-1 다국어 통역 검증
-- 출처: specs/000-backlog/o1-multilingual-interpret-feasibility.md
--
-- 설계:
--  - institutions.lab_enabled = true 인 워크스페이스에서만 상담별 '엔진 picker' 노출.
--  - 비-lab 워크스페이스는 서버에서 'basic'(기존 기본모델) 강제 → 사고 차단.
--  - consultation.transcription_engine = 그 기록이 어떤 엔진으로 전사됐는지(평가·비교 데이터).
--  - 운영 주체(다온)가 단일 워크스페이스(예미안)만 실험 가동.
-- ============================================================

-- lab_enabled: 실험실 노출 게이트(institutions.plan과 분리 — plan은 요금/기능, lab은 검증 채널)
alter table public.institutions
  add column if not exists lab_enabled boolean not null default false;

-- transcription_engine: 어떤 엔진으로 생성된 상담 기록인지(null=레거시/수동 작성)
alter table public.consultation
  add column if not exists transcription_engine text;

-- 예미안 치과 실험실 활성화(이름 매칭 — 실험은 예미안 워크스페이스 한정)
update public.institutions set lab_enabled = true where name ilike '%예미안%';
