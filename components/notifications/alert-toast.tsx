"use client";

/** 실시간 체어 알림 토스트 (spec 007 US1). 환자정보·진료내용은 표시하지 않는다. */
export type ToastItem = { id: string; chairName: string };

export function AlertToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onDismiss(t.id)}
          className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-sky-200 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg shadow-sky-200/50 backdrop-blur"
        >
          <span className="text-lg" aria-hidden>
            🔔
          </span>
          <span>{t.chairName} · 상담 기록 도착</span>
        </button>
      ))}
    </div>
  );
}
