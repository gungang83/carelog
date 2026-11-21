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
 * 항상 띄워두는 화면에서 한 번 "소리 켜기"를 누르면(사용자 제스처) 이후 체어 기록 도착마다 효과음.
 * 헤더의 새로고침 버튼과 같은 크기의 스피커 아이콘 — 폰 폭에서 글자가 세로로 쪼개지지 않게(글자는 넓은 화면만).
 * 알림 종(🔔)과 헷갈리지 않게 스피커 모양을 쓴다.
 */
export function SoundArmButton() {
  const [armed, setArmed] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setArmed(isSoundArmed());
    setEnabled(isSoundEnabled());
  }, []);

  const on = armed && enabled;
  const label = !armed ? "알림 소리 켜기 (한 번만 누르면 됩니다)" : enabled ? "알림 소리 끄기" : "알림 소리 켜기";

  return (
    <button
      type="button"
      onClick={() => {
        if (!armed) {
          armSound();
          setArmed(true);
          setEnabled(true);
          return;
        }
        const next = !enabled;
        setSoundEnabled(next);
        setEnabled(next);
      }}
      title={label}
      aria-label={label}
      className={[
        "relative inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 shadow-sm transition",
        armed
          ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
      ].join(" ")}
    >
      <svg className="size-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3.5 7.5h2.5l4-3.5v12l-4-3.5H3.5z" fill="currentColor" fillOpacity={0.15} />
        {on ? (
          <>
            <path d="M13 7.5a3.5 3.5 0 0 1 0 5" />
            <path d="M15.2 5.5a6.5 6.5 0 0 1 0 9" />
          </>
        ) : (
          <path d="M13.5 8l4 4m0-4l-4 4" />
        )}
      </svg>
      {!armed && <span className="hidden text-xs font-semibold sm:inline">소리 켜기</span>}
      {!armed && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-500 sm:hidden" aria-hidden />}
    </button>
  );
}
