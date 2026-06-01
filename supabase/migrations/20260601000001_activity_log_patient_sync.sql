-- 활동 피드(activity_logs) ↔ 체어 기록 환자 연결 동기화
--
-- 문제: 기존 _log_consultation_created 트리거는 consultation INSERT 시점에만
--      activity_logs를 기록한다. 체어 즉시 기록은 patient_id=NULL(draft)로 먼저
--      insert되므로 활동로그에 patient_id=NULL로 박히고, 이후 환자 연결(UPDATE)은
--      트리거가 없어 갱신되지 않는다 → 최근 활동에서 "알 수 없는 환자" + 클릭 불가.
--
-- 해결:
--  1) INSERT 트리거: patient_id가 있을 때만 기록(미연결 draft는 활동피드 제외).
--  2) UPDATE 트리거: patient_id 변경(연결/재연결/해제) 시 활동로그 동기화.
--  3) 기존에 잘못 쌓인 patient_id=NULL 로그 정리.

-- ── 1) INSERT 트리거 함수: 미연결(draft)은 건너뜀 ───────────────────────────────
CREATE OR REPLACE FUNCTION public._log_consultation_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.patient_id IS NULL THEN
    RETURN NEW;  -- 미연결 체어 draft는 최근 활동에 넣지 않음
  END IF;
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

-- ── 2) UPDATE 트리거 함수: 환자 연결/재연결/해제 시 동기화 ─────────────────────
CREATE OR REPLACE FUNCTION public._log_consultation_patient_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
    -- 이 상담의 기존 활동로그 제거 (중복/구버전 방지)
    DELETE FROM public.activity_logs WHERE consultation_id = NEW.id;
    -- 연결된 상태가 되면 새 로그 기록 (방금 연결 → 최근 활동 상단에 노출)
    IF NEW.patient_id IS NOT NULL THEN
      INSERT INTO public.activity_logs (institution_id, event_type, patient_id, consultation_id, metadata, created_at)
      VALUES (
        NEW.institution_id,
        'consultation.created',
        NEW.patient_id,
        NEW.id,
        jsonb_build_object(
          'content_preview',
          left(regexp_replace(NEW.content, '<[^>]*>', '', 'g'), 80)
        ),
        now()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consultation_patient_changed_log ON public.consultation;
CREATE TRIGGER trg_consultation_patient_changed_log
  AFTER UPDATE OF patient_id ON public.consultation
  FOR EACH ROW EXECUTE FUNCTION public._log_consultation_patient_changed();

-- ── 3) 기존 잘못된 로그 정리 (미연결 draft가 남긴 patient_id=NULL 로그) ────────
DELETE FROM public.activity_logs WHERE patient_id IS NULL;

-- ── 4) (선택) 기존 체어 평문 기록 줄바꿈 보존: 평문(no HTML) → <p>+<br> 변환 ──
UPDATE public.consultation
SET content = '<p>' || replace(replace(content, chr(13), ''), chr(10), '<br>') || '</p>'
WHERE chair_id IS NOT NULL
  AND content <> ''
  AND content NOT LIKE '%<%';
