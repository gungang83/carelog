"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getAllUnlinkedRecords,
  getRecentParticipants,
  type AllUnlinkedRecord,
} from "@/app/actions/chairs";
import {
  searchConsultations,
  type SearchedConsultation,
} from "@/app/actions/consultations";
import type { Participant } from "@/lib/types/database";
import { ConsultationCard, type CardRecord } from "@/components/consultation/consultation-card";
import { getReviewFlagsFor } from "@/app/actions/review-flags";
import type { ReviewFlag } from "@/lib/review-flags";

/**
 * 홈 통합 피드 — '미연결 기록'(연결 대기, 액션 카드)과 '최근 활동'(연결 완료 로그)을
 * 하나의 시간순 스트림으로 합친다. 두 데이터는 서로 겹치지 않는다(같은 상담이
 * 미연결→연결 단계로 이동). 상단 토글로 둘 다(시간순)·하나씩 볼 수 있다.
 *
 * spec 021 — 카드 렌더는 /records와 공용 `ConsultationCard`로 통일(연결/미연결
 * 구분해 동일 액션 + 확인 꼬리표). 홈은 데이터 로딩·정렬·토글만 담당.
 */
export function HomeFeed({
  initialRecords,
  linked,
}: {
  initialRecords: AllUnlinkedRecord[];
  linked: SearchedConsultation[];
}) {
  const router = useRouter();

  const [records, setRecords] = useState<AllUnlinkedRecord[]>(initialRecords);
  const [linkedRecords, setLinkedRecords] = useState<SearchedConsultation[]>(linked);
  const [showUnlinked, setShowUnlinked] = useState(true);
  const [showActivity, setShowActivity] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [recent, setRecent] = useState<Participant[]>([]);
  const [flags, setFlags] = useState<Record<string, ReviewFlag[]>>({});

  // router.refresh()(저장·연결·실시간 알림 후)로 서버가 새 목록을 내려주면 반영.
  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);
  useEffect(() => {
    setLinkedRecords(linked);
  }, [linked]);

  // 참여자 피커 "최근 함께한 사람" 후보 — 읽기 전용·비차단.
  useEffect(() => {
    getRecentParticipants().then(setRecent).catch(() => {});
  }, []);

  // 확인 꼬리표 — 현재 목록의 상담 id 전체를 한 번에 조회.
  const reloadFlags = async (ids: string[]) => {
    if (ids.length === 0) {
      setFlags({});
      return;
    }
    const map = await getReviewFlagsFor(ids);
    setFlags(map);
  };
  useEffect(() => {
    const ids = [
      ...records.map((r) => r.id),
      ...linkedRecords.map((r) => r.id),
    ];
    reloadFlags(ids).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, linkedRecords]);

  // 연결/삭제/편집처럼 목록에 영향을 주는 변경은 양쪽 목록을 다시 받아 동기화.
  const reloadAll = async () => {
    const data = await getAllUnlinkedRecords();
    setRecords(data);
    const res = await searchConsultations({ status: "linked", limit: 50 });
    if (res.ok) setLinkedRecords(res.rows);
    router.refresh();
  };

  // ── 시간순 병합 ────────────────────────────────────────────────────────────
  type FeedItem =
    | { kind: "unlinked"; time: number; rec: AllUnlinkedRecord }
    | { kind: "linked"; time: number; rec: SearchedConsultation };

  const allItems: FeedItem[] = [
    ...(showUnlinked
      ? records.map((rec) => ({
          kind: "unlinked" as const,
          time: new Date(rec.created_at).getTime(),
          rec,
        }))
      : []),
    ...(showActivity
      ? linkedRecords.map((rec) => ({
          kind: "linked" as const,
          // 최근 작업순 — 방금 연결한 기록(linked_at=지금)이 위로 오게 max 사용
          time: Math.max(
            new Date(rec.created_at).getTime(),
            rec.linked_at ? new Date(rec.linked_at).getTime() : 0,
          ),
          rec,
        }))
      : []),
  ].sort((a, b) => b.time - a.time);

  // 기본 10개만 노출, 나머지는 '전체 보기'로 펼침.
  const COLLAPSED = 10;
  const items = expanded ? allItems : allItems.slice(0, COLLAPSED);

  if (records.length === 0 && linkedRecords.length === 0) return null;

  const toCard = (item: FeedItem): CardRecord =>
    item.kind === "unlinked"
      ? {
          id: item.rec.id,
          linked: false,
          content: item.rec.content,
          created_at: item.rec.created_at,
          chair_id: item.rec.chair_id,
          prescriptions: item.rec.prescriptions ?? null,
          participants: item.rec.participants ?? [],
          has_audio: item.rec.has_audio,
        }
      : {
          id: item.rec.id,
          linked: true,
          content: item.rec.content,
          created_at: item.rec.created_at,
          chair_id: item.rec.chair_id,
          prescriptions: item.rec.prescriptions ?? null,
          participants: item.rec.participants ?? [],
          has_audio: item.rec.has_audio,
          patient_id: item.rec.patient_id,
          patient_name: item.rec.patient_name,
        };

  return (
    <section className="flex flex-col gap-3">
      {/* 헤더 + 토글 */}
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-700">기록 · 활동</h2>
        <Link
          href="/records"
          className="text-xs font-medium text-sky-600 hover:text-sky-700"
        >
          전체보기 · 검색
        </Link>
        <div className="ml-auto flex gap-1.5">
          <FilterChip
            active={showUnlinked}
            onClick={() => setShowUnlinked((v) => !v)}
            count={records.length}
            tone="amber"
          >
            미연결
          </FilterChip>
          <FilterChip
            active={showActivity}
            onClick={() => setShowActivity((v) => !v)}
            count={linkedRecords.length}
            tone="emerald"
          >
            연결 완료
          </FilterChip>
        </div>
      </div>

      {!showUnlinked && !showActivity ? (
        <p className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-6 text-center text-sm text-slate-400">
          위 토글에서 볼 항목을 선택하세요.
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-6 text-center text-sm text-slate-400">
          표시할 항목이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={`${item.kind[0]}-${item.rec.id}`}>
              <ConsultationCard
                record={toCard(item)}
                flags={flags[item.rec.id] ?? []}
                recent={recent}
                onMutated={reloadAll}
                onFlagsChanged={() => {
                  const ids = [
                    ...records.map((r) => r.id),
                    ...linkedRecords.map((r) => r.id),
                  ];
                  reloadFlags(ids).catch(() => {});
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {allItems.length > COLLAPSED && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
        >
          {expanded ? "접기" : `전체 ${allItems.length}개 보기`}
        </button>
      )}
    </section>
  );
}

// ── 토글 칩 ──────────────────────────────────────────────────────────────────
function FilterChip({
  active,
  onClick,
  count,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  tone: "amber" | "sky" | "emerald";
  children: React.ReactNode;
}) {
  const activeCls =
    tone === "amber"
      ? "border-amber-300 bg-amber-50 text-amber-700"
      : tone === "emerald"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : "border-sky-300 bg-sky-50 text-sky-700";
  const dotCls =
    tone === "amber" ? "bg-amber-500" : tone === "emerald" ? "bg-emerald-500" : "bg-sky-500";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
        active ? activeCls : "border-slate-200 bg-white text-slate-400"
      }`}
    >
      <span
        className={`inline-block size-1.5 rounded-full ${active ? dotCls : "bg-slate-300"}`}
      />
      {children}
      <span className={active ? "" : "text-slate-300"}>{count}</span>
    </button>
  );
}
