"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { searchPatients, createPatient } from "@/app/actions/patients";
import type { PatientRow } from "@/lib/types/database";
import { formatPhoneForList } from "@/lib/patient-search";
import { formatResidentNoForList } from "@/lib/rrn-core";

function patientMetaSubtitle(p: PatientRow) {
  const phoneLabel = formatPhoneForList(p.phone);
  const rrnMasked = formatResidentNoForList(p.resident_no);
  const rrnLabel = rrnMasked ? `주민번호: ${rrnMasked}` : null;
  const chartLabel =
    p.chart_no != null && String(p.chart_no).trim()
      ? `차트: ${String(p.chart_no).trim()}`
      : null;
  const parts = [phoneLabel, rrnLabel, chartLabel].filter(Boolean);
  if (!parts.length) return null;
  return `(${parts.join(" / ")})`;
}

function deriveRegisterPrefill(query: string) {
  const trimmed = query.trim();
  const digits = trimmed.replace(/\D/g, "");
  const hasNumber = /\d/.test(trimmed);
  const looksLikeName = /^[\p{L}\s]{2,}$/u.test(trimmed) && !hasNumber;

  const name = looksLikeName ? trimmed : "";
  let phone = "";
  let residentFront = "";

  if (!looksLikeName && digits.length > 0) {
    if (digits.length >= 9 && digits.length <= 11) {
      phone = digits;
    } else if (digits.length >= 6) {
      residentFront = digits.slice(0, 6);
    }
  }

  return { name, phone, residentFront };
}

export function PatientHome() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientRow[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [pendingSearch, startSearch] = useTransition();
  const [pendingRegister, startRegister] = useTransition();
  const [registerOpen, setRegisterOpen] = useState(false);
  const prefill = deriveRegisterPrefill(query);

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

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setSearched(false);
      setError(null);
      return;
    }
    const timer = window.setTimeout(() => {
      runSearch();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

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
          이름, 연락처(뒤 4자리·전체·하이픈 무관), 차트번호(포함), 주민번호
          앞자리·뒷자리 첫 숫자 등으로 검색할 수 있어요.
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
            placeholder="이름 · 전화 · 차트 · 생년월일(주민앞) 등"
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
          <button
            type="button"
            onClick={() => setRegisterOpen((v) => !v)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-white px-6 text-sm font-semibold text-sky-800 shadow-sm transition hover:bg-sky-50"
          >
            {registerOpen ? "등록 폼 닫기" : "새 환자 등록"}
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

              // bigint(id)는 URL로 전달되면 숫자 문자열이어야 합니다.
              const isValid = !!patientId && /^\d+$/.test(patientId);
              const meta = patientMetaSubtitle(p);

              return (
                <li
                  key={patientId ? String(patientId) : `${p.name}-${p.chart_no ?? "no-chart"}`}
                  className="py-3 first:pt-0 last:pb-0"
                >
                  {isValid ? (
                    <Link
                      href={`/patients/${patientId}`}
                      className="group flex min-h-[3rem] flex-col gap-1 rounded-xl px-2 py-3 transition hover:bg-sky-50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-900 group-hover:text-sky-800">
                          {p.name}
                        </span>
                        {meta ? (
                          <div className="mt-1 text-xs leading-snug text-slate-500 sm:text-sm">
                            {meta}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-slate-400">
                            연락처·주민번호·차트 없음
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-sky-600 group-hover:text-sky-700 sm:text-sm">
                        상담 기록 →
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
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-sky-200 bg-white px-5 text-sm font-semibold text-sky-800 shadow-sm hover:bg-sky-50"
          >
            새 환자 등록
          </button>
        </section>
      ) : null}

      {registerOpen ? (
        <section className="rounded-2xl border border-dashed border-sky-200 bg-white/80 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">새 환자 등록</h2>
          <p className="mt-1 text-sm text-slate-600">
            아래 정보로 새 환자를 등록할 수 있습니다.
          </p>
          <form
            key={`register-${query}`}
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
                defaultValue={prefill.name}
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
                defaultValue={prefill.phone}
                className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="resident_no_front"
                  className="text-xs font-medium text-slate-600"
                >
                  주민등록번호 앞 6자리
                </label>
                <input
                  id="resident_no_front"
                  name="resident_no_front"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="off"
                  defaultValue={prefill.residentFront}
                  placeholder="YYMMDD"
                  className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 font-mono text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
                />
              </div>
              <div>
                <label
                  htmlFor="resident_no_back"
                  className="text-xs font-medium text-slate-600"
                >
                  뒤 7자리
                </label>
                <input
                  id="resident_no_back"
                  name="resident_no_back"
                  inputMode="numeric"
                  maxLength={7}
                  autoComplete="off"
                  className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 font-mono text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
                />
              </div>
            </div>
            <p className="text-[11px] leading-snug text-slate-500">
              주민번호는 선택 사항입니다. 입력 시 서버에 저장·검색되며, 타 병원
              매칭을 위한 해시 식별자를 서버에서 계산할 수 있습니다. 운영 환경에서는
              `RESIDENT_NO_HASH_PEPPER`를 설정하세요.
            </p>
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
