/**
 * 마지막으로 기록한 체어를 기기별로 기억(원탭/보드 기본 선택용).
 * localStorage 미지원/차단 환경에서도 안전하게 무시한다.
 * 사용처: consult-hero, consultation-board.
 */
const LAST_CHAIR_KEY = "carelog:lastChairId";

export function getLastChairId(): string | null {
  try {
    return localStorage.getItem(LAST_CHAIR_KEY);
  } catch {
    return null;
  }
}

export function setLastChairId(chairId: string): void {
  try {
    localStorage.setItem(LAST_CHAIR_KEY, chairId);
  } catch {
    // 무시
  }
}
