"use client";

import { useEffect, useState } from "react";
import {
  armSound,
  isSoundArmed,
  isSoundEnabled,
  setSoundEnabled,
} from "./alert-sound";

/**
 * 알림 소리 활성화/토글 버튼 (spec 007 US2).
 * 항상 띄워두는 화면에서 한 번 "소리 켜기"를 누르면(사용자 제스처) 이후 도착마다 효과음.
 */
export function SoundArmButton() {
  const [armed, setArmed] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setArmed(isSoundArmed());
    setEnabled(isSoundEnabled());
  }, []);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => {
          armSound();
          setArmed(true);
          setEnabled(true);
        }}
        className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
        title="알림 소리를 켭니다 (한 번만 누르면 됩니다)"
      >
        🔔 소리 켜기
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        const next = !enabled;
        setSoundEnabled(next);
        setEnabled(next);
      }}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
      title={enabled ? "알림 소리 끄기" : "알림 소리 켜기"}
      aria-label={enabled ? "알림 소리 끄기" : "알림 소리 켜기"}
    >
      {enabled ? "🔔" : "🔕"}
    </button>
  );
}
