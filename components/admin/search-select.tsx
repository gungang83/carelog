"use client";

import { useEffect, useRef, useState } from "react";

// spec 015 — 검색형 드롭다운. 기관/사용자가 많아져도 입력으로 필터링해 선택.
export interface SelectOption {
  value: string;
  label: string;
  sub?: string; // 보조 설명(예: 소속 기관)
}

export function SearchSelect({
  value,
  onChange,
  options,
  allLabel,
  placeholder = "검색…",
  width = "min-w-[12rem]",
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  allLabel: string;
  placeholder?: string;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selected = options.find((o) => o.value === value);
  const label = value ? selected?.label ?? value : allLabel;

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? options.filter((o) => o.label.toLowerCase().includes(needle) || (o.sub ?? "").toLowerCase().includes(needle))
    : options;

  return (
    <div ref={ref} className={`relative ${width}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
      >
        <span className="truncate">{label}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0 text-slate-400">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-sky-300"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1 text-sm">
            <Item active={!value} onClick={() => { onChange(""); setOpen(false); setQ(""); }}>{allLabel}</Item>
            {filtered.map((o) => (
              <Item
                key={o.value}
                active={o.value === value}
                onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
              >
                <span className="truncate">{o.label}</span>
                {o.sub && <span className="ml-2 truncate text-xs text-slate-400">{o.sub}</span>}
              </Item>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-center text-xs text-slate-400">결과 없음</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Item({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center px-3 py-1.5 text-left transition hover:bg-slate-50 ${
          active ? "bg-sky-50 font-medium text-sky-700" : "text-slate-700"
        }`}
      >
        {children}
      </button>
    </li>
  );
}
