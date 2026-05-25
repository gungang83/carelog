"use client";

import { useState, useTransition } from "react";
import { linkChairRecordToPatient, createPatientAndLink } from "@/app/actions/chairs";

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
  const [mode, setMode] = useState<"search" | "create">("search");

  // 새 환자 등록 폼 상태
  const [newName, setNewName] = useState("");
  const [newChartNo, setNewChartNo] = useState("");
  const [newPhone, setNewPhone] = useState("");

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

  const handleCreate = () => {
    setError("");
    startLink(async () => {
      const result = await createPatientAndLink({
        consultationId,
        name: newName,
        chartNo: newChartNo || undefined,
        phone: newPhone || undefined,
      });
      if (result.ok) {
        onLinked();
      } else {
        setError(result.message);
      }
    });
  };

  if (mode === "create") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("search")}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="뒤로"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <span className="text-sm font-medium text-slate-700">새 환자 등록</span>
        </div>
        <p className="text-xs text-slate-500">
          이름만 입력해도 등록됩니다. 차트번호·연락처는 나중에 환자 프로필에서 추가할 수 있습니다.
        </p>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="이름 *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
            autoFocus
          />
          <input
            type="text"
            placeholder="차트번호 (선택)"
            value={newChartNo}
            onChange={(e) => setNewChartNo(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
          />
          <input
            type="tel"
            placeholder="연락처 (선택)"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="button"
          onClick={handleCreate}
          disabled={linking || !newName.trim()}
          className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
        >
          {linking ? "등록 중…" : "등록 후 연결"}
        </button>
      </div>
    );
  }

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
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">검색 결과가 없습니다.</p>
          <button
            type="button"
            onClick={() => { setNewName(query); setMode("create"); }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
          >
            <PlusIcon className="size-4" />
            &ldquo;{query}&rdquo; 로 새 환자 등록
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {linking && <p className="text-xs text-sky-600">연결 중…</p>}
    </div>
  );
}

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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
    </svg>
  );
}
