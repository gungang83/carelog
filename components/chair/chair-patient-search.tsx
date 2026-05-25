"use client";

import { useState, useTransition } from "react";
import { linkChairRecordToPatient } from "@/app/actions/chairs";

type PatientResult = { id: number; name: string; chart_no: string | null; phone: string | null };

interface ChairPatientSearchProps {
  consultationId: string;
  onLinked: () => void;
  onCancel: () => void;
}

export function ChairPatientSearch({
  consultationId,
  onLinked,
  onCancel,
}: ChairPatientSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientResult[]>([]);
  const [searching, startSearch] = useTransition();
  const [linking, startLink] = useTransition();
  const [error, setError] = useState("");

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.trim().length < 1) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      const res = await searchPatients(value.trim());
      setResults(res);
    });
  };

  const handleLink = (patient: PatientResult) => {
    setError("");
    startLink(async () => {
      const result = await linkChairRecordToPatient({
        consultationId,
        patientId: patient.id,
      });
      if (result.ok) {
        onLinked();
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          aria-label="뒤로"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <span className="text-sm font-medium text-slate-700">환자 검색</span>
      </div>
      <input
        type="text"
        placeholder="이름 또는 차트번호 입력…"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
        autoFocus
      />
      {searching && (
        <p className="text-xs text-slate-500">검색 중…</p>
      )}
      {results.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => handleLink(p)}
                disabled={linking}
                className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition hover:bg-sky-50 disabled:opacity-50"
              >
                <span className="font-medium text-slate-800">{p.name}</span>
                <span className="text-xs text-slate-500">
                  {p.chart_no ? `차트 ${p.chart_no}` : "차트번호 없음"}
                  {p.phone ? ` · ${p.phone}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!searching && query.length > 0 && results.length === 0 && (
        <p className="text-xs text-slate-500">검색 결과가 없습니다.</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {linking && <p className="text-xs text-sky-600">연결 중…</p>}
    </div>
  );
}

// ─── 내부 검색 액션 (inline — 1개 호출 사이트) ───────────────────────────────
async function searchPatients(query: string): Promise<PatientResult[]> {
  const { searchPatientsForChair } = await import("@/app/actions/chairs");
  return searchPatientsForChair(query);
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
    </svg>
  );
}
