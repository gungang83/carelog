-- consultation 테이블에 status 컬럼 추가 (draft | confirmed)
ALTER TABLE consultation
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('draft', 'confirmed'));

-- 기존 레코드는 모두 confirmed
UPDATE consultation SET status = 'confirmed' WHERE status IS NULL;
