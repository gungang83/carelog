"use client";

import { useState, useTransition } from "react";
import { useChairContext } from "@/components/chair/chair-provider";
import { getOrCreateChairByName } from "@/app/actions/chairs";

export function QuickRecordTrigger() {
  const { chairs, openOverlay, unlinkedCounts } = useChairContext();
  const [picking, setPicking] = useState(false);
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const totalUnlinked = Object.values(unlinkedCounts).reduce((s, n) => s + n, 0);

  const handlePickChair = (chairId: string) => {
    setPicking(false);
    setCustomName("");
    setError("");
    openOverlay(chairId);
  };

  const handleCustomSubmit = () => {
    if (!customName.trim()) return;
    setError("");
    startTransition(async () => {
      const result = await getOrCreateChairByName(customName.trim());
      if (result.ok) {
        setPicking(false);
        setCustomName("");
        openOverlay(result.chairId);
      } else {
        setError(result.message);
      }
    });
  };

  if (picking) {
    return (
      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">어느 위치에서 기록하시나요?</p>
          <button
            type="button"
            onClick={() => { setPicking(false); setError(""); }}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="취소"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* 등록된 위치 */}
        {chairs.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {chairs.map((chair) => {
              const count = unlinkedCounts[chair.id] ?? 0;
              return (
                <button
                  key={chair.id}
                  type="button"
                  onClick={() => handlePickChair(chair.id)}
                  className="relative flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                >
                  {chair.name}
                  {count > 0 && (
                    <span className="inline-flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 직접 입력 */}
        <div className="border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs text-slate-500">직접 입력</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="위치 이름 (예: 1번 체어, 원장실)"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCustomSubmit(); }}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
              autoFocus={chairs.length === 0}
            />
            <button
              type="button"
              onClick={handleCustomSubmit}
              disabled={isPending || !customName.trim()}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
            >
              {isPending ? "…" : "선택"}
            </button>
          </div>
          {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-sky-600 px-6 py-4 text-sm font-semibold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-700 active:scale-[0.98]"
      >
        <MicIcon className="size-5 shrink-0" />
        빠른 기록 시작
      </button>
      {totalUnlinked > 0 && (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-700 transition hover:bg-amber-100 sm:shrink-0"
        >
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
            {totalUnlinked > 9 ? "9+" : totalUnlinked}
          </span>
          미연결 기록 확인
        </button>
      )}
    </div>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V4Z" />
      <path fillRule="evenodd" d="M5.5 10.5a.75.75 0 0 0-1.5 0 6 6 0 0 0 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.046A6 6 0 0 0 15.5 10.5a.75.75 0 0 0-1.5 0 4.5 4.5 0 0 1-9 0Z" clipRule="evenodd" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}
