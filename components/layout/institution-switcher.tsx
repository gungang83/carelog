"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { switchInstitution } from "@/app/actions/admin";
import type { InstitutionWithRole } from "@/lib/auth/institution";

interface InstitutionSwitcherProps {
  institutions: InstitutionWithRole[];
  activeInstitutionId: string;
}

export function InstitutionSwitcher({
  institutions,
  activeInstitutionId,
}: InstitutionSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = institutions.find((i) => i.institution.id === activeInstitutionId);
  const activeInst = active?.institution;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSwitch(institutionId: string) {
    if (institutionId === activeInstitutionId || loading) return;
    setLoading(true);
    setOpen(false);
    const result = await switchInstitution(institutionId);
    if (result.ok) {
      router.refresh();
    }
    setLoading(false);
  }

  if (institutions.length <= 1) {
    return (
      <div className="min-w-0 text-left">
        <div className="truncate text-sm font-semibold text-slate-900 sm:text-base">
          Carelog
        </div>
        <div className="truncate text-xs text-slate-500">
          {activeInst?.name ?? "Carelog"}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative min-w-0 text-left">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="group min-w-0 rounded-lg px-1 py-0.5 text-left outline-none ring-sky-400/30 focus-visible:ring-2 disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="truncate text-sm font-semibold text-slate-900 sm:text-base">
          Carelog
        </div>
        <div className="flex items-center gap-1 truncate text-xs text-slate-500">
          <span className="truncate">{activeInst?.name ?? "기관 선택"}</span>
          <svg
            className={`shrink-0 size-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-sky-100 bg-white py-1 shadow-lg shadow-sky-100/40"
        >
          {institutions
            .filter((i) => i.is_active)
            .map((i) => {
              const isActive = i.institution.id === activeInstitutionId;
              return (
                <button
                  key={i.institution.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSwitch(i.institution.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-sky-50 ${
                    isActive ? "font-semibold text-sky-700" : "text-slate-700"
                  }`}
                >
                  {isActive && (
                    <svg className="size-3 shrink-0 text-sky-500" viewBox="0 0 12 12" fill="currentColor">
                      <path fillRule="evenodd" d="M10.22 3.22a.75.75 0 0 1 0 1.06L5.06 9.44a.75.75 0 0 1-1.06 0L1.78 7.22a.75.75 0 1 1 1.06-1.06l1.69 1.69 4.63-4.63a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className={isActive ? "" : "pl-5"}>{i.institution.name}</span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
