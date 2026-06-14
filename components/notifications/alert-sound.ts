/**
 * 알림 효과음 (spec 007 US2).
 * 브라우저 자동재생 정책상 소리는 사용자 제스처로 1회 "활성화(arm)"해야 한다.
 * 활성화·on/off 상태는 화면 단위로 localStorage에 보관(스키마 변경 없음 — 헌법 IV).
 * 활성화 전에는 무음(시각 알림만).
 */
export const SOUND_ARMED_KEY = "carelog.alert.soundArmed";
export const SOUND_ENABLED_KEY = "carelog.alert.soundEnabled";
const SOUND_SRC = "/sounds/alert.wav";

let audioEl: HTMLAudioElement | null = null;
function getAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio(SOUND_SRC);
    audioEl.preload = "auto";
  }
  return audioEl;
}

export function isSoundArmed(): boolean {
  try {
    return localStorage.getItem(SOUND_ARMED_KEY) === "1";
  } catch {
    return false;
  }
}

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_ENABLED_KEY) !== "0"; // 기본 on (단, armed 전엔 무음)
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, on ? "1" : "0");
  } catch {
    /* noop */
  }
}

/** 사용자 제스처(버튼 클릭) 안에서 호출 — 자동재생 잠금 해제 + armed 기록. */
export function armSound(): void {
  try {
    localStorage.setItem(SOUND_ARMED_KEY, "1");
    if (localStorage.getItem(SOUND_ENABLED_KEY) === null) {
      localStorage.setItem(SOUND_ENABLED_KEY, "1");
    }
    void getAudio()
      .play()
      .catch(() => {});
  } catch {
    /* noop */
  }
}

/** armed && enabled일 때만 알림음 재생. */
export function playAlertSound(): void {
  if (!isSoundArmed() || !isSoundEnabled()) return;
  try {
    const a = getAudio();
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {
    /* noop */
  }
}
