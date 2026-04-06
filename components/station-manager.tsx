"use client";

import { useEffect, useId, useState } from "react";
import {
  CARELOG_STATION_STORAGE_KEY,
  STATION_PRESETS,
} from "@/lib/station-storage";

const PRESET_SET = new Set<string>(STATION_PRESETS);

export function StationManager() {
  const labelId = useId();
  const [station, setStation] = useState<string>(STATION_PRESETS[0]);
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
        {!PRESET_SET.has(station) ? (
          <option value={station}>{station}</option>
        ) : null}
        {STATION_PRESETS.map((name) => (
          <option key={name} value={name}>
            {name}
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
