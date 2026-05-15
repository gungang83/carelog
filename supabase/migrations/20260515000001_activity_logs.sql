-- activity_logs: 기관별 상담 기록 생성 이벤트 로그
-- patient.id, consultation.id 는 bigint (integer PK)
DROP TABLE IF EXISTS public.activity_logs;

CREATE TABLE public.activity_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid        NOT NULL,
  event_type      text        NOT NULL,
  patient_id      bigint,
  consultation_id bigint,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_institution_created
  ON public.activity_logs(institution_id, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institution members can read activity_logs" ON public.activity_logs;
CREATE POLICY "institution members can read activity_logs"
  ON public.activity_logs FOR SELECT
  USING (institution_id = get_my_institution_id());

-- 상담 생성 자동 로그 트리거 함수
CREATE OR REPLACE FUNCTION public._log_consultation_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_logs (institution_id, event_type, patient_id, consultation_id, metadata)
  VALUES (
    NEW.institution_id,
    'consultation.created',
    NEW.patient_id,
    NEW.id,
    jsonb_build_object(
      'content_preview',
      left(regexp_replace(NEW.content, '<[^>]*>', '', 'g'), 80)
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consultation_created_log ON public.consultation;
CREATE TRIGGER trg_consultation_created_log
  AFTER INSERT ON public.consultation
  FOR EACH ROW EXECUTE FUNCTION public._log_consultation_created();

-- 기존 상담 데이터 소급 적용
INSERT INTO public.activity_logs (institution_id, event_type, patient_id, consultation_id, metadata, created_at)
SELECT
  c.institution_id,
  'consultation.created',
  c.patient_id,
  c.id,
  jsonb_build_object(
    'content_preview',
    left(regexp_replace(c.content, '<[^>]*>', '', 'g'), 80)
  ),
  c.created_at
FROM public.consultation c
ON CONFLICT DO NOTHING;
