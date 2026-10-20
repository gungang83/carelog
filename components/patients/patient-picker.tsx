"use client";

// 공용 환자 픽커 — 즉시 검색(이름·차트번호) + 새 환자 등록(이름만 필수).
// 상담카드 환자 연결(ChairPatientSearch)과 기공지(spec 035)가 같은 형식을 공유한다(대표 지시 2026-10-20).
// 고른/등록한 환자를 onPick으로 돌려줄 뿐, 연결 등 후속 동작은 호출측 책임.

import { useState, useTransition } from "react";
import { searchPatientsForChair } from "@/app/actions/chairs";
import { createPatientQuick, type QuickPatient } from "@/app/actions/patients";

export type PickedPatient = QuickPatient;

export function PatientPicker({
  onPick,
  onCancel,
  busy = false,
  busyLabel,
}: {
  onPick: (patient: PickedPatient) => void;
  /** 뒤로/닫기 — 없으면 뒤로 버튼 숨김 */
  onCancel?: () => void;
  /** 호출측 후속 동작(연결 등) 진행 중 — 목록 클릭 잠금 */
  busy?: boolean;
  busyLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedPatient[]>([]);
  const [searching, startSearch] = useTransition();
  const [creating, startCreate] = useTransition();
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"search" | "create">("search");

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
      const res = await searchPatientsForChair(value.trim());
      setResults(res as PickedPatient[]);
    });
  };

  const handleCreate = () => {
    setError("");
    startCreate(async () => {
      const result = await createPatientQuick({
        name: newName,
        chartNo: newChartNo || undefined,
        phone: newPhone || undefined,
      });
      if (result.ok) onPick(result.patient);
      else setError(result.message);
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
          disabled={creating || busy || !newName.trim()}
          className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
        >
          {creating || busy ? (busyLabel ?? "등록 중…") : "등록 후 선택"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="뒤로"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
        )}
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
      {/* 신규 환자 등록은 항상 접근 가능 */}
      <button
        type="button"
        onClick={() => {
          setNewName(query.trim());
          setMode("create");
        }}
        className="flex items-center gap-1.5 self-start rounded-lg px-1 py-0.5 text-xs font-medium text-sky-700 hover:text-sky-800"
      >
        <PlusIcon className="size-3.5" />새 환자 등록
      </button>
      {searching && <p className="text-xs text-slate-500">검색 중…</p>}
      {results.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                disabled={busy}
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
            onClick={() => {
              setNewName(query);
              setMode("create");
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
          >
            <PlusIcon className="size-4" />
            &ldquo;{query}&rdquo; 로 새 환자 등록
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {busy && <p className="text-xs text-sky-600">{busyLabel ?? "처리 중…"}</p>}
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
        clipRule="evenodd"
      />
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
