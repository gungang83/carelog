"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChairContext } from "@/components/chair/chair-provider";
import { CopyAllButton } from "@/components/copy-all-button";
import {
  getAllUnlinkedRecords,
  deleteChairRecord,
  updateChairRecordContent,
  type AllUnlinkedRecord,
} from "@/app/actions/chairs";
import type { ActivityLogEntry } from "@/app/actions/activity";
import { ChairPatientSearch } from "@/components/chair/chair-patient-search";
import { AudioReplayButton } from "@/components/chair/audio-replay-button";
import { PrescriptionPicker } from "@/components/chair/prescription-picker";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/rich-text-editor";

/**
 * 홈 통합 피드 — '미연결 기록'(연결 대기, 액션 카드)과 '최근 활동'(연결 완료 로그)을
 * 하나의 시간순 스트림으로 합친다. 두 데이터는 서로 겹치지 않는다(같은 상담이
 * 미연결→연결 단계로 이동). 상단 토글로 둘 다(시간순)·하나씩 볼 수 있다.
 */
export function HomeFeed({
  initialRecords,
  logs,
}: {
  initialRecords: AllUnlinkedRecord[];
  logs: ActivityLogEntry[];
}) {
  const { chairs, openOverlay, refreshUnlinkedCount } = useChairContext();
  const router = useRouter();

  const [records, setRecords] = useState<AllUnlinkedRecord[]>(initialRecords);
  const [showUnlinked, setShowUnlinked] = useState(true);
  const [showActivity, setShowActivity] = useState(true);
  const [expandedActivity, setExpandedActivity] = useState(false);

  // 카드 편집/연결/삭제 상태(한 번에 하나만)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editPrescriptions, setEditPrescriptions] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const editorRef = useRef<RichTextEditorHandle>(null);

  // router.refresh()(저장·연결·실시간 알림 후)로 서버가 새 목록을 내려주면 반영.
  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  const reload = async () => {
    const data = await getAllUnlinkedRecords();
    setRecords(data);
  };

  // 연결/삭제처럼 '활동' 쪽에도 영향을 주는 변경은 서버 재검증으로 양쪽을 동기화.
  const reloadAll = async () => {
    await reload();
    router.refresh();
  };

  const chairName = (chairId: string) =>
    chairs.find((c) => c.id === chairId)?.name ?? "알 수 없음";

  const startEdit = (rec: AllUnlinkedRecord) => {
    setEditingId(rec.id);
    setEditContent(rec.content);
    setEditPrescriptions(rec.prescriptions ?? []);
    setMsg("");
    setLinkingId(null);
    setDeleteConfirmId(null);
  };

  const handleSaveEdit = (rec: AllUnlinkedRecord) => {
    setMsg("");
    startTransition(async () => {
      const result = await updateChairRecordContent({
        consultationId: rec.id,
        content: editContent,
        prescriptions: editPrescriptions,
      });
      if (result.ok) {
        await reload();
        setEditingId(null);
      } else {
        setMsg(result.message);
      }
    });
  };

  const handleSaveAndLink = (rec: AllUnlinkedRecord) => {
    setMsg("");
    startTransition(async () => {
      const result = await updateChairRecordContent({
        consultationId: rec.id,
        content: editContent,
        prescriptions: editPrescriptions,
      });
      if (result.ok) {
        await reload();
        setEditingId(null);
        setLinkingId(rec.id);
      } else {
        setMsg(result.message);
      }
    });
  };

  const handleDelete = (id: string, chairId: string) => {
    setDeleteConfirmId(null);
    startTransition(async () => {
      await deleteChairRecord({ consultationId: id });
      await refreshUnlinkedCount(chairId);
      await reload();
    });
  };

  const handleLinked = async (chairId: string) => {
    await refreshUnlinkedCount(chairId);
    setLinkingId(null);
    // 연결되면 미연결 목록에서 빠지고 '활동'에 나타나므로 양쪽 동기화.
    await reloadAll();
  };

  // ── 시간순 병합 ────────────────────────────────────────────────────────────
  type FeedItem =
    | { kind: "unlinked"; time: number; rec: AllUnlinkedRecord }
    | { kind: "activity"; time: number; log: ActivityLogEntry };

  const activityVisible = expandedActivity ? logs : logs.slice(0, 5);
  const items: FeedItem[] = [
    ...(showUnlinked
      ? records.map((rec) => ({
          kind: "unlinked" as const,
          time: new Date(rec.created_at).getTime(),
          rec,
        }))
      : []),
    ...(showActivity
      ? activityVisible.map((log) => ({
          kind: "activity" as const,
          time: new Date(log.created_at).getTime(),
          log,
        }))
      : []),
  ].sort((a, b) => b.time - a.time);

  if (records.length === 0 && logs.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      {/* 헤더 + 토글 */}
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-700">기록 · 활동</h2>
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
            count={logs.length}
            tone="sky"
          >
            활동
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
          {items.map((item) =>
            item.kind === "activity" ? (
              <li key={`a-${item.log.id}`}>
                <ActivityRow log={item.log} />
              </li>
            ) : (
              <li
                key={`u-${item.rec.id}`}
                className="rounded-2xl border border-slate-100 border-l-4 border-l-amber-400 bg-amber-50/30 p-4 shadow-sm"
              >
                {renderUnlinkedCard(item.rec)}
              </li>
            ),
          )}
        </ul>
      )}

      {showActivity && logs.length > 5 && (
        <button
          onClick={() => setExpandedActivity((e) => !e)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
        >
          {expandedActivity ? "활동 접기" : `활동 전체 ${logs.length}개 보기`}
        </button>
      )}
    </section>
  );

  // ── 미연결 카드 렌더 ───────────────────────────────────────────────────────
  function renderUnlinkedCard(rec: AllUnlinkedRecord) {
    const isEditing = editingId === rec.id;
    const isLinking = linkingId === rec.id;
    const isDeleteConfirm = deleteConfirmId === rec.id;
    const preview = stripHtml(rec.content).slice(0, 120);
    const charCount = stripHtml(rec.content).length;

    return (
      <>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <StatusPill tone="amber">미연결</StatusPill>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <span className="flex size-5 items-center justify-center rounded-lg bg-sky-600 text-[9px] font-bold text-white">
              {chairName(rec.chair_id).slice(0, 2)}
            </span>
            {chairName(rec.chair_id)}
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-slate-400">
            <span>{formatDate(rec.created_at)}</span>
            <span className="text-slate-300">·</span>
            <span>{charCount}자</span>
          </span>
        </div>

        {isEditing ? (
          <div className="flex flex-col gap-3">
            <RichTextEditor
              ref={editorRef}
              value={editContent}
              onChange={setEditContent}
              placeholder="상담 내용을 수정하세요…"
            />
            <PrescriptionPicker value={editPrescriptions} onChange={setEditPrescriptions} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSaveEdit(rec)}
                disabled={isPending}
                className="inline-flex min-h-9 items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {isPending ? "저장 중…" : "저장"}
              </button>
              <button
                type="button"
                onClick={() => handleSaveAndLink(rec)}
                disabled={isPending}
                className="inline-flex min-h-9 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
              >
                저장 후 환자 연결
              </button>
              <CopyAllButton
                html={editContent}
                label="전체 복사"
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white transition hover:bg-slate-900"
              />
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setMsg("");
                }}
                disabled={isPending}
                className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                취소
              </button>
            </div>
            {msg && <p className="text-xs text-red-500">{msg}</p>}
          </div>
        ) : isLinking ? (
          <ChairPatientSearch
            consultationId={rec.id}
            onLinked={() => handleLinked(rec.chair_id)}
            onCancel={() => setLinkingId(null)}
          />
        ) : (
          <>
            <p className="mb-3 text-sm leading-relaxed text-slate-700">
              {preview || "내용 없음"}
              {charCount > 120 && <span className="text-slate-400">…</span>}
            </p>

            {(rec.prescriptions ?? []).length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {(rec.prescriptions ?? []).map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}

            {isDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">삭제하시겠습니까?</span>
                <button
                  type="button"
                  onClick={() => handleDelete(rec.id, rec.chair_id)}
                  disabled={isPending}
                  className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                >
                  삭제
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <CopyAllButton
                  html={rec.content}
                  label="전체 복사"
                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-3 text-xs font-semibold text-white transition hover:bg-slate-900"
                />
                {rec.has_audio && <AudioReplayButton consultationId={rec.id} />}
                <button
                  type="button"
                  onClick={() => setLinkingId(rec.id)}
                  className="inline-flex min-h-8 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  환자 연결
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(rec)}
                  className="inline-flex min-h-8 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  편집
                </button>
                <button
                  type="button"
                  onClick={() => openOverlay(rec.chair_id)}
                  className="inline-flex min-h-8 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  새 녹음
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(rec.id)}
                  disabled={isPending}
                  className="inline-flex min-h-8 items-center justify-center rounded-xl border border-red-100 bg-white px-3 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-40"
                >
                  삭제
                </button>
              </div>
            )}
          </>
        )}
      </>
    );
  }
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
  tone: "amber" | "sky";
  children: React.ReactNode;
}) {
  const activeCls =
    tone === "amber"
      ? "border-amber-300 bg-amber-50 text-amber-700"
      : "border-sky-300 bg-sky-50 text-sky-700";
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
        className={`inline-block size-1.5 rounded-full ${
          active ? (tone === "amber" ? "bg-amber-500" : "bg-sky-500") : "bg-slate-300"
        }`}
      />
      {children}
      <span className={active ? "" : "text-slate-300"}>{count}</span>
    </button>
  );
}

// ── 상태 배지(통일 디자인) — 미연결(amber) / 연결 완료(emerald) ───────────────
function StatusPill({
  tone,
  children,
}: {
  tone: "amber" | "emerald";
  children: React.ReactNode;
}) {
  const cls =
    tone === "amber"
      ? "border-amber-200 bg-amber-100 text-amber-800"
      : "border-emerald-200 bg-emerald-100 text-emerald-800";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}
    >
      {tone === "emerald" ? (
        <CheckIcon className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-amber-500" />
      )}
      {children}
    </span>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
    </svg>
  );
}

// ── 활동 행(연결 완료 로그) ───────────────────────────────────────────────────
const EVENT_LABEL: Record<string, string> = {
  "consultation.created": "상담 기록",
};

function ActivityRow({ log }: { log: ActivityLogEntry }) {
  const inner = (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <StatusPill tone="emerald">연결 완료</StatusPill>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <PersonIcon className="size-4 text-emerald-600" />
          {log.patient_name ?? "알 수 없는 환자"}
        </span>
        <span className="ml-auto text-slate-400">{formatRelative(log.created_at)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {EVENT_LABEL[log.event_type] ?? log.event_type}
        </span>
        {log.content_preview && (
          <p className="truncate text-xs text-slate-500">{log.content_preview}</p>
        )}
      </div>
    </>
  );

  const cardCls =
    "block rounded-2xl border border-slate-100 border-l-4 border-l-emerald-400 bg-white p-4 shadow-sm transition";

  if (log.consultation_id && log.patient_id) {
    return (
      <Link
        href={`/patients/${log.patient_id}#consultation-${log.consultation_id}`}
        className={`${cardCls} hover:border-emerald-200 hover:bg-emerald-50/40`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={cardCls}>{inner}</div>;
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
