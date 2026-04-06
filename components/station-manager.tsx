"use client";

import { useEffect, useId, useState } from "react";
import {
  CARELOG_STATION_STORAGE_KEY,
  STATION_OPTIONS,
} from "@/lib/station-storage";

const OPTION_SET = new Set<string>(STATION_OPTIONS.map((o) => o.value));

export function StationManager() {
  const labelId = useId();
  const [station, setStation] = useState<string>(STATION_OPTIONS[0]?.value ?? "");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CARELOG_STATION_STORAGE_KEY);
      if (saved && saved.trim()) {
        setStation(saved.trim());
      }
    } catch {
      /* private mode 등 */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CARELOG_STATION_STORAGE_KEY, station);
    } catch {
      /* ignore */
    }
  }, [station, hydrated]);

  return (
    <div className="flex min-w-0 flex-1 flex-col items-stretch gap-1 sm:max-w-xs sm:flex-none sm:items-end">
      <label
        id={labelId}
        htmlFor={`${labelId}-station`}
        className="text-[11px] font-semibold uppercase tracking-wide text-sky-700"
      >
        현재 위치
      </label>
      <select
        id={`${labelId}-station`}
        aria-labelledby={labelId}
        value={station}
        onChange={(e) => setStation(e.target.value)}
        className="min-h-12 w-full min-w-0 rounded-xl border border-sky-200 bg-white px-4 py-3 text-base font-medium text-slate-900 shadow-sm outline-none ring-sky-400/25 focus:border-sky-500 focus:ring-2 sm:min-w-[200px] sm:text-sm"
      >
        {!OPTION_SET.has(station) ? (
          <option value={station}>{station}</option>
        ) : null}
        {STATION_OPTIONS.map((option) => (
          <option key={option.value || "unset"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {!hydrated ? (
        <span className="sr-only" aria-live="polite">
          위치 설정 불러오는 중
        </span>
      ) : null}
    </div>
  );
}
