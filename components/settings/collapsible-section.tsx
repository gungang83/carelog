"use client";

import { useState, type ReactNode } from "react";

// 설정 접이식 섹션 (세션 66 — EO spec-054 설정 IA 벤치마킹).
// 제목+부제만 보이는 한 줄로 접혀 있어 설정이 많아져도 목록을 한눈에 스캔할 수 있다.
export function CollapsibleSection({
  title,
  subtitle,
  emoji,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  emoji?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
      >
        {emoji && <span className="shrink-0 text-base">{emoji}</span>}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-800">{title}</span>
          {subtitle && <span className="mt-0.5 block text-xs text-slate-400">{subtitle}</span>}
        </span>
        <svg
          className={`size-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="space-y-4 border-t border-slate-100 bg-slate-50/40 px-4 py-4">{children}</div>}
    </section>
  );
}

// 그룹 구분 헤더 — 컨테이너가 아닌 시각 구분용(EO SettingsGroupHeader 패턴).
export function SettingsGroupHeader({
  emoji,
  title,
  desc,
}: {
  emoji: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="px-1 pb-1 pt-5 first:pt-0">
      <div className="flex items-center gap-2">
        <span className="text-sm">{emoji}</span>
        <h2 className="text-sm font-bold text-slate-700">{title}</h2>
      </div>
      {desc && <p className="mt-0.5 pl-6 text-xs text-slate-400">{desc}</p>}
    </div>
  );
}
