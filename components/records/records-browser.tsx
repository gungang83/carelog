"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  searchConsultations,
  type SearchedConsultation,
  type SearchConsultationsFilters,
} from "@/app/actions/consultations";
import { CopyAllButton } from "@/components/copy-all-button";

/**
 * 상담 기록 전체 열람·검색·필터 (spec 011 US1·US3).
 * 연결·미연결 상담을 함께 검색하고, 날짜별 그룹 + 접이식 카드로 본다.
 * 펼친 카드는 전체복사(덴트웹용), 연결완료는 환자 상세에서 편집 접근.
 */
type StatusFilter = "all" | "linked" | "unlinked";
const PAGE = 30;

export function RecordsBrowser({
  initialRows,
  initialHasMore,
  chairs,
}: {
  initialRows: SearchedConsultation[];
  initialHasMore: boolean;
  chairs: { id: string; name: string }[];
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [chairId, setChairId] = useState<string>("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [rows, setRows] = useState<SearchedConsultation[]>(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const chairName = (id: string | null) =>
    (id && chairs.find((c) => c.id === id)?.name) || (id ? "체어" : "");

  const baseFilters = useCallback(
    (offset: number): SearchConsultationsFilters => ({
      q: q.trim() || undefined,
      status,
      chairId: chairId || undefined,
      sort,
      limit: PAGE,
      offset,
    }),
    [q, status, chairId, sort],
  );

  // 필터/검색 변경 시 재조회(디바운스). 첫 마운트는 초기 데이터 사용.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await searchConsultations(baseFilters(0));
      if (res.ok) {
        setRows(res.rows);
        setHasMore(res.hasMore);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [baseFilters]);

  const loadMore = async () => {
    setLoading(true);
    const res = await searchConsultations(baseFilters(rows.length));
    if (res.ok) {
      setRows((prev) => [...prev, ...res.rows]);
      setHasMore(res.hasMore);
    }
    setLoading(false);
  };

  // 날짜별 그룹
  const groups: { date: string; items: SearchedConsultation[] }[] = [];
  for (const r of rows) {
    const d = formatDate(r.created_at);
    const last = groups[groups.length - 1];
    if (last && last.date === d) last.items.push(r);
    else groups.push({ date: d, items: [r] });
  }

  return (
    <div className="space-y-4">
      {/* 검색·필터 바 */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="상담 내용 키워드 검색 (예: 임플란트, 크라운)"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "전체"],
              ["linked", "연결"],
              ["unlinked", "미연결"],
            ] as [StatusFilter, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setStatus(v)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                status === v
                  ? "border-sky-600 bg-sky-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
          <select
            value={chairId}
            onChange={(e) => setChairId(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
          >
            <option value="">모든 체어</option>
            {chairs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
            className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            {sort === "newest" ? "최신순 ↓" : "오래된순 ↑"}
          </button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          해당 조건의 상담 기록이 없어요.
        </p>
      ) : (
        groups.map((g) => (
          <div key={g.date} className="space-y-2">
            <h3 className="px-1 text-xs font-semibold text-slate-400">{g.date}</h3>
            <ul className="space-y-2">
              {g.items.map((r) => {
                const open = expandedId === r.id;
                const linked = !!r.patient_id;
                return (
                  <li
                    key={r.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : r.id)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <span
                        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          linked
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {linked ? "연결" : "미연결"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                          {linked && (
                            <span className="font-semibold text-slate-700">
                              {r.patient_name ?? "환자"}
                            </span>
                          )}
                          {chairName(r.chair_id) && <span>{chairName(r.chair_id)}</span>}
                          <span>{formatTime(r.created_at)}</span>
                        </span>
                        {!open && (
                          <span className="mt-0.5 block truncate text-sm text-slate-600">
                            {stripHtml(r.content) || "(내용 없음)"}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 shrink-0 text-xs text-slate-400">
                        {open ? "▲" : "▼"}
                      </span>
                    </button>

                    {open && (
                      <div className="border-t border-slate-100 px-4 py-3">
                        <div
                          className="prose prose-sm max-w-none text-slate-800 [&_img]:rounded-lg"
                          dangerouslySetInnerHTML={{ __html: r.content }}
                        />
                        {r.prescriptions && r.prescriptions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {r.prescriptions.map((p) => (
                              <span
                                key={p}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <CopyAllButton
                            html={r.content}
                            label="전체 복사"
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-900"
                          />
                          {linked && (
                            <Link
                              href={`/patients/${r.patient_id}`}
                              className="inline-flex min-h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              환자 상세에서 편집
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "불러오는 중…" : "더 보기"}
        </button>
      )}
    </div>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(
    d.getDate(),
  ).padStart(2, "0")}.`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${m}`;
}
