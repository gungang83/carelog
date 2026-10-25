"use client";

// 환자 페이지의 상담 기록 — 홈과 같은 공용 카드(ConsultationCard)·같은 상담보드로 만든다.
//   [🎙 이 환자 상담 시작] → 상담보드(홈과 동일) → 저장하면 이 환자에게 바로 연결 → 홈·여기 모두 같은 카드로 보인다.
//   환자 페이지에서만 필요한 액션(환자에게 전송·연결 변경)과 이전 방식 기록(이미지 첨부·임시저장)은 카드 아래 추가 줄로.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useChairContext } from "@/components/chair/chair-provider";
import { ConsultationCard, type CardRecord } from "@/components/consultation/consultation-card";
import {
  ConsultationHistory,
  RelinkControls,
  type ConsultationHistoryItem,
} from "@/components/consultation-history";
import { getSharesForConsultations, type ShareStatus } from "@/app/actions/patient-shares";
import { getRecentParticipants } from "@/app/actions/chairs";
import { getReviewFlagsFor } from "@/app/actions/review-flags";
import type { SearchedConsultation } from "@/app/actions/consultations";
import { optimizeStorageUrl } from "@/lib/image/optimize";
import type { Participant } from "@/lib/types/database";
import type { ReviewFlag } from "@/lib/review-flags";

function plain(html: string): string {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function PatientConsultations({
  patientId,
  patientName,
  rows,
  legacy,
  hasMore,
}: {
  patientId: string;
  patientName: string;
  /** 이 환자 상담(홈 카드와 같은 모양) */
  rows: SearchedConsultation[];
  /** 이전 방식 데이터(이미지 첨부·임시저장) */
  legacy: ConsultationHistoryItem[];
  hasMore: boolean;
}) {
  const router = useRouter();
  const { openBoardWithPrefill } = useChairContext();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<Participant[]>([]);
  const [flags, setFlags] = useState<Record<string, ReviewFlag[]>>({});
  const [highlight, setHighlight] = useState<string | null>(null);
  const [shares, setShares] = useState<Record<string, ShareStatus[]>>({});

  const drafts = legacy.filter((c) => c.status === "draft");
  const imagesById = useMemo(
    () => Object.fromEntries(legacy.filter((c) => c.image_urls?.length).map((c) => [c.id, c.image_urls ?? []])),
    [legacy],
  );
  const cards = rows.filter((r) => r.status !== "draft");

  useEffect(() => {
    getRecentParticipants().then(setRecent).catch(() => {});
  }, []);

  const reloadFlags = () => {
    const ids = cards.map((r) => r.id);
    if (ids.length === 0) return;
    getReviewFlagsFor(ids).then(setFlags).catch(() => {});
    getSharesForConsultations(ids).then(setShares).catch(() => {});
  };
  useEffect(reloadFlags, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // 알림·검색 결과에서 #consultation-<id>로 들어오면 그 카드로 스크롤(이전 동작 유지)
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#consultation-")) return;
    const id = hash.slice("#consultation-".length);
    const t = setTimeout(() => {
      setHighlight(id);
      document.getElementById(`consultation-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    return () => clearTimeout(t);
  }, []);

  const q = query.trim().toLowerCase();
  const shown = q ? cards.filter((r) => plain(r.content).toLowerCase().includes(q)) : cards;

  const toCard = (r: SearchedConsultation): CardRecord => ({
    id: r.id,
    linked: true,
    content: r.content,
    created_at: r.created_at,
    chair_id: r.chair_id,
    prescriptions: r.prescriptions ?? null,
    participants: r.participants ?? [],
    has_audio: r.has_audio,
    patient_id: r.patient_id,
    patient_name: r.patient_name ?? patientName,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-sky-600">상담 기록</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {patientName} <span className="text-sm font-medium text-slate-400">{cards.length}건</span>
          </h2>
        </div>
        {/* 홈과 같은 상담보드로 — 저장하면 이 환자에게 바로 연결 */}
        <button
          type="button"
          onClick={() => openBoardWithPrefill({ patient: { id: patientId, name: patientName } })}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          🎙 이 환자 상담 시작
        </button>
      </div>

      {cards.length > 0 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이 환자 상담 내용 검색"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
      )}

      {cards.length === 0 ? (
        <p className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-6 text-center text-sm text-slate-400">
          아직 상담 기록이 없습니다. [🎙 이 환자 상담 시작]으로 첫 상담을 기록하세요.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-slate-500">검색 결과가 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((r) => {
            const images = imagesById[r.id] ?? [];
            return (
              <li
                key={r.id}
                id={`consultation-${r.id}`}
                className={`rounded-2xl transition ${highlight === r.id ? "ring-2 ring-sky-400 ring-offset-2" : ""}`}
              >
                <ConsultationCard
                  record={toCard(r)}
                  flags={flags[r.id] ?? []}
                  recent={recent}
                  inPatientPage
                  onMutated={() => router.refresh()}
                  onFlagsChanged={reloadFlags}
                  extra={
                    <div className="mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2">
                      {/* 이전 방식 기록의 이미지 첨부 */}
                      {images.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {images.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" title="원본 크게 보기">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={optimizeStorageUrl(url, { width: 200 })}
                                alt=""
                                loading="lazy"
                                className="size-16 rounded-lg border border-slate-200 object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      <ShareStatusLine items={shares[r.id] ?? []} />
                      {r.chair_id && <RelinkControls item={{ id: r.id }} patientId={patientId} />}
                    </div>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && <p className="text-center text-xs text-slate-400">최근 100건까지 보입니다 — 이전 기록은 [전체보기 · 검색]에서 찾아 주세요.</p>}

      {/* 이전 방식(환자 페이지 직접 작성)의 임시저장 — 확정·삭제는 기존 도구로 */}
      {drafts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
          <p className="text-xs font-semibold text-amber-700">임시저장된 이전 방식 기록 {drafts.length}건</p>
          <ConsultationHistory consultations={drafts} patientId={patientId} />
        </div>
      )}
    </div>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** 보낸 상담 안내와 환자 확인 여부(spec 038) */
function ShareStatusLine({ items }: { items: ShareStatus[] }) {
  if (items.length === 0) return <p className="text-xs text-slate-400">아직 보낸 상담 안내가 없어요 — [📩 환자에게 보내기]</p>;
  return (
    <ul className="flex flex-col gap-0.5 text-xs">
      {items.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500">📩 {fmt(s.sent_at)} 보냄</span>
          {s.first_viewed_at ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
              ✓ 환자가 확인했어요 ({fmt(s.first_viewed_at)}{s.view_count > 1 ? ` · ${s.view_count}회` : ""})
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">아직 안 열어 봤어요</span>
          )}
        </li>
      ))}
    </ul>
  );
}
