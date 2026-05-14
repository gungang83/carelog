-- 어드민 패널: institution_members에 is_active 컬럼 추가
-- 직원 접근 권한 활성화/비활성화 제어

ALTER TABLE institution_members
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- 기존 데이터는 모두 활성 상태로 초기화 (DEFAULT true)
-- 비활성화된 멤버는 해당 기관 데이터에 접근 불가 (Server Action 레벨 체크)
