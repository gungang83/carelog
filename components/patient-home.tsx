"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { searchPatients, createPatient } from "@/app/actions/patients";
import type { PatientRow } from "@/lib/types/database";

export function PatientHome() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientRow[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [pendingSearch, startSearch] = useTransition();
  const [pendingRegister, startRegister] = useTransition();

  const runSearch = useCallback(() => {
    setError(null);
    setRegisterMessage(null);
    startSearch(async () => {
      const res = await searchPatients(query);
      if (!res.ok) {
        setResults(null);
        setSearched(true);
        setError(res.message);
        return;
      }
      setResults(res.patients);
      setSearched(true);
    });
  }, [query]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm shadow-sky-100/80">
        <label
          htmlFor="patient-search"
          className="text-sm font-medium text-slate-600"
        >
          환자 검색
        </label>
        <p className="mt-1 text-xs text-slate-500">
          이름 또는 연락처로 검색하세요.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="patient-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
            placeholder="예: 홍길동, 010..."
            className="min-h-11 flex-1 rounded-xl border border-sky-200 bg-sky-50/50 px-4 text-slate-900 outline-none ring-sky-400/40 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2"
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={pendingSearch}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-700 disabled:opacity-60"
          >
            {pendingSearch ? "검색 중..." : "검색"}
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {searched && results && results.length > 0 ? (
        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">
            검색 결과 ({results.length})
          </h2>
          <ul className="mt-4 divide-y divide-sky-100">
            {results.map((p) => {
              const anyP = p as any;
              const rawId =
                anyP?.id ?? anyP?.patient_id ?? anyP?.patientId ?? anyP?.uuid;
              const patientIdRaw =
                rawId == null
                  ? null
                  : typeof rawId === "string"
                    ? rawId
                    : String(rawId);
              const patientId =
                patientIdRaw == null ? null : patientIdRaw.trim();

              // 디버깅: 실제로 환자 ID가 Link로 전달되는지 확인
              // eslint-disable-next-line no-console
              console.log("[patient-home] search result row:", {
                name: p.name,
                rawId,
                patientId,
                row: p,
              });

              // bigint(id)는 URL로 전달되면 숫자 문자열이어야 합니다.
              const isValid = !!patientId && /^\d+$/.test(patientId);

              return (
                <li
                  key={patientId ? String(patientId) : `${p.name}-${p.chart_no ?? "no-chart"}`}
                  className="py-3 first:pt-0 last:pb-0"
                >
                  {isValid ? (
                    <Link
                      href={`/patients/${patientId}`}
                      className="group flex flex-col gap-0.5 rounded-lg px-2 py-2 transition hover:bg-sky-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium text-slate-900 group-hover:text-sky-800">
                        {p.name}
                      </span>
                      <span className="text-sm text-slate-500">
                        {p.chart_no ? `차트번호 ${p.chart_no}` : "차트번호 없음"}
                        {p.phone ? ` · ${p.phone}` : ""}
                      </span>
                    </Link>
                  ) : (
                    <div className="rounded-lg px-2 py-2">
                      <div className="text-sm font-semibold text-slate-900">
                        {p.name}
                      </div>
                      <div className="mt-0.5 text-xs text-red-600">
                        환자 ID를 확인할 수 없습니다.
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {searched && results && results.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-sky-200 bg-white/80 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">
            검색 결과가 없습니다
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            아래 정보로 새 환자를 등록할 수 있습니다.
          </p>
          <form
            className="mt-5 grid gap-4"
            action={(fd) => {
              setRegisterMessage(null);
              startRegister(async () => {
                const res = await createPatient(fd);
                if (!res.ok) {
                  setRegisterMessage(res.message);
                  return;
                }
                setRegisterMessage("등록되었습니다. 상담 기록으로 이동합니다.");
                router.push(`/patients/${res.patient.id}`);
              });
            }}
          >
            <div>
              <label
                htmlFor="name"
                className="text-xs font-medium text-slate-600"
              >
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={query}
                className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
              />
            </div>
            <div>
              <label
                htmlFor="chart_no"
                className="text-xs font-medium text-slate-600"
              >
                차트 번호
              </label>
              <input
                id="chart_no"
                name="chart_no"
                type="text"
                inputMode="numeric"
                placeholder="예: 12-34"
                className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="text-xs font-medium text-slate-600"
              >
                연락처
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
              />
            </div>
            <button
              type="submit"
              disabled={pendingRegister}
              className="min-h-11 rounded-xl bg-sky-600 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
            >
              {pendingRegister ? "등록 중..." : "새 환자 등록"}
            </button>
            {registerMessage ? (
              <p
                className={`text-sm ${registerMessage.startsWith("등록") ? "text-emerald-600" : "text-red-600"}`}
              >
                {registerMessage}
              </p>
            ) : null}
          </form>
        </section>
      ) : null}
    </div>
  );
}
