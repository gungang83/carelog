"use client";

import { useChairContext, type ChairStatus } from "@/components/chair/chair-provider";

export function ChairButtons() {
  const { chairs, openOverlay, getChairStatus, unlinkedCounts } = useChairContext();

  if (chairs.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {chairs.map((chair) => {
        const status = getChairStatus(chair.id);
        const count = unlinkedCounts[chair.id] ?? 0;
        return (
          <ChairButton
            key={chair.id}
            name={chair.name}
            status={status}
            unlinkedCount={count}
            onClick={() => openOverlay(chair.id)}
          />
        );
      })}
    </div>
  );
}

function ChairButton({
  name,
  status,
  unlinkedCount,
  onClick,
}: {
  name: string;
  status: ChairStatus;
  unlinkedCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`체어 ${name} — ${statusLabel(status)}`}
      className={buttonClass(status)}
    >
      <span className="relative flex items-center gap-1">
        {status === "recording" && (
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-red-500" />
        )}
        {status === "processing" && (
          <span className="inline-block size-3 animate-spin rounded-full border border-sky-400 border-t-transparent" />
        )}
        <span className="text-xs font-semibold leading-none">{name}</span>
        {(status === "has_records" || unlinkedCount > 0) && (
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
            {unlinkedCount > 9 ? "9+" : unlinkedCount || "!"}
          </span>
        )}
      </span>
    </button>
  );
}

function statusLabel(status: ChairStatus): string {
  switch (status) {
    case "idle":       return "대기";
    case "recording":  return "녹음 중";
    case "processing": return "변환 중";
    case "has_records": return "미연결 기록";
  }
}

function buttonClass(status: ChairStatus): string {
  const base =
    "relative flex items-center justify-center rounded-xl border px-2 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40";
  switch (status) {
    case "idle":
      return `${base} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`;
    case "recording":
      return `${base} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`;
    case "processing":
      return `${base} border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100`;
    case "has_records":
      return `${base} border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`;
  }
}
