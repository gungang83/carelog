"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  searchConsultations,
  type SearchedConsultation,
  type SearchConsultationsFilters,
} from "@/app/actions/consultations";
import { getRecentParticipants } from "@/app/actions/chairs";
import { getReviewFlagsFor } from "@/app/actions/review-flags";
import type { ReviewFlag } from "@/lib/review-flags";
import type { Participant } from "@/lib/types/database";
import { ConsultationCard, type CardRecord } from "@/components/consultation/consultation-card";

/**
 * 상담 기록 전체 열람·검색·필터 (spec 011 US1·US3 + spec 021).
 * 연결·미연결 상담을 함께 검색하고, 날짜별 그룹으로 본다.
 * 카드 처리(전체복사·음성듣기·편집·삭제·환자연결·확인 꼬리표)는 홈과 동일한
 * 공용 `ConsultationCard`로 통일 — 연결/미연결에 따라 액션이 갈린다.
 * '확인 필요만' 필터로 열린 꼬리표가 달린 기록만 추릴 수 있다.
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
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [rows, setRows] = useState<SearchedConsultation[]>(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<Participant[]>([]);
  const [flags, setFlags] = useState<Record<string, ReviewFlag[]>>({});

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

  // 참여자 피커 "최근 함께한 사람" 후보 — 읽기 전용·비차단.
  useEffect(() => {
    getRecentParticipants().then(setRecent).catch(() => {});
  }, []);

  // 확인 꼬리표 — 현재 목록의 상담 id 전체를 한 번에 조회.
  const reloadFlags = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setFlags({});
      return;
    }
    const map = await getReviewFlagsFor(ids);
    setFlags(map);
  }, []);
  useEffect(() => {
    reloadFlags(rows.map((r) => r.id)).catch(() => {});
  }, [rows, reloadFlags]);

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

  // 변경(편집·삭제·연결·꼬리표) 후 현재 필터로 목록 재조회.
  const reloadRows = async () => {
    const res = await searchConsultations(baseFilters(0));
    if (res.ok) {
      setRows(res.rows);
      setHasMore(res.hasMore);
    }
  };

  const hasOpenFlag = (id: string) => (flags[id] ?? []).some((f) => f.status === "open");

  // '확인 필요만' 토글 시 열린 꼬리표가 달린 기록만.
  const visibleRows = flaggedOnly ? rows.filter((r) => hasOpenFlag(r.id)) : rows;

  const toCard = (r: SearchedConsultation): CardRecord => {
    const linked = !!r.patient_id;
    return {
      id: r.id,
      linked,
      content: r.content,
      created_at: r.created_at,
      chair_id: r.chair_id,
      prescriptions: r.prescriptions ?? null,
      participants: r.participants ?? [],
      has_audio: r.has_audio,
      patient_id: r.patient_id,
      patient_name: r.patient_name,
    };
  };

  // 날짜별 그룹
  const groups: { date: string; items: SearchedConsultation[] }[] = [];
  for (const r of visibleRows) {
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
          <button
            type="button"
            onClick={() => setFlaggedOnly((v) => !v)}
            aria-pressed={flaggedOnly}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              flaggedOnly
                ? "border-amber-400 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            🏷️ 확인 필요만
          </button>
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
      ) : visibleRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          {flaggedOnly
            ? "확인 필요 꼬리표가 달린 기록이 없어요."
            : "해당 조건의 상담 기록이 없어요."}
        </p>
      ) : (
        groups.map((g) => (
          <div key={g.date} className="space-y-2">
            <h3 className="px-1 text-xs font-semibold text-slate-400">{g.date}</h3>
            <ul className="space-y-3">
              {g.items.map((r) => (
                <li key={r.id}>
                  <ConsultationCard
                    record={toCard(r)}
                    flags={flags[r.id] ?? []}
                    recent={recent}
                    onMutated={reloadRows}
                    onFlagsChanged={() => reloadFlags(rows.map((x) => x.id)).catch(() => {})}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {hasMore && !flaggedOnly && (
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(
    d.getDate(),
  ).padStart(2, "0")}.`;
}
