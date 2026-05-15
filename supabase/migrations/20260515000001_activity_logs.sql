-- activity_logs: 기관별 상담 기록 생성 이벤트 로그
CREATE TABLE IF NOT EXISTS activity_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  event_type      text        NOT NULL,                        -- e.g. 'consultation.created'
  patient_id      uuid        REFERENCES patients(id) ON DELETE SET NULL,
  consultation_id uuid        REFERENCES consultations(id) ON DELETE SET NULL,
  metadata        jsonb,                                       -- content_preview 등 부가 정보
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_institution_created
  ON activity_logs(institution_id, created_at DESC);

-- RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "institution members can read activity_logs"
  ON activity_logs FOR SELECT
  USING (institution_id = get_my_institution_id());

-- 상담 생성 시 자동 로그 트리거
CREATE OR REPLACE FUNCTION _log_consultation_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  plain_preview text;
BEGIN
  -- HTML 태그 제거 후 앞 80자 추출
  plain_preview := left(
    regexp_replace(NEW.content, '<[^>]*>', '', 'g'),
    80
  );

  INSERT INTO activity_logs (institution_id, event_type, patient_id, consultation_id, metadata)
  VALUES (
    NEW.institution_id,
    'consultation.created',
    NEW.patient_id,
    NEW.id,
    jsonb_build_object('content_preview', plain_preview)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consultation_created_log ON consultations;
CREATE TRIGGER trg_consultation_created_log
  AFTER INSERT ON consultations
  FOR EACH ROW EXECUTE FUNCTION _log_consultation_created();
