"use client";

// spec 035 — 치식도(FDI) 선택 UI. 종이 기공지의 상하악 8~1|1~8 그리드를 FDI 표기로.

import { FDI_UPPER, FDI_LOWER } from "@/lib/lab-orders";

export function ToothChart({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (t: string) =>
    onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t].sort());

  const row = (teeth: string[], key: string) => (
    <div key={key} className="flex flex-wrap justify-center gap-1">
      {teeth.map((t, i) => (
        <span key={t} className="flex items-center">
          {i === 8 && <span className="mx-1 w-px self-stretch bg-slate-300" aria-hidden />}
          <button
            type="button"
            onClick={() => toggle(t)}
            className={`h-8 w-8 rounded-md border text-xs font-semibold transition ${
              selected.includes(t)
                ? "border-indigo-500 bg-indigo-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t}
          </button>
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      {row(FDI_UPPER, "upper")}
      {row(FDI_LOWER, "lower")}
      <p className="text-center text-xs text-slate-500">
        {selected.length > 0 ? (
          <>
            선택: <b className="text-indigo-700">{selected.join(", ")}</b>
          </>
        ) : (
          "해당 치아를 눌러 선택하세요 (FDI 표기)"
        )}
      </p>
    </div>
  );
}
