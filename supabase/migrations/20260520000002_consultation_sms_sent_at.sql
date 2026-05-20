-- 상담 SMS 발송 시각 추적
ALTER TABLE consultation
  ADD COLUMN IF NOT EXISTS sms_sent_at timestamptz;
