"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useChairContext } from "@/components/chair/chair-provider";
import { CopyAllButton } from "@/components/copy-all-button";
import { AudioReplayButton } from "@/components/chair/audio-replay-button";
import { ConsultationEditor } from "@/components/chair/consultation-editor";
import { type RichTextEditorHandle } from "@/components/rich-text-editor";
import { ChairPatientSearch } from "@/components/chair/chair-patient-search";
import { ReviewFlags } from "@/components/consultation/review-flags";
import { optimizeContentHtml } from "@/lib/image/optimize";
import { updateChairRecordContent, deleteChairRecord } from "@/app/actions/chairs";
import { deleteConsultation } from "@/app/actions/consultations";
import type { Participant } from "@/lib/types/database";
import type { ReviewFlag } from "@/lib/review-flags";

// spec 021 — 홈/records 공용 상담 카드. 연결/미연결 구분해 동일 액션 제공
//   (전체복사·음성듣기·편집·삭제·환자연결) + 확인 꼬리표. 카드별 상태는 로컬 관리.
export type CardRecord = {
  id: string;
  linked: boolean;
  content: string;
  created_at: string;
  chair_id: string | null;
  prescriptions: string[] | null;
  participants: Participant[];
  has_audio: boolean;
  patient_id?: string | null;
  patient_name?: string | null;
};

function stripHtml(html: string): string {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ConsultationCard({
  record,
  flags,
  recent,
  onMutated,
  onFlagsChanged,
}: {
  record: CardRecord;
  flags: ReviewFlag[];
  recent: Participant[];
  onMutated: () => void | Promise<void>;
  onFlagsChanged?: () => void;
}) {
  const { chairs, members, me, openOverlay, refreshUnlinkedCount } = useChairContext();
  const [isEditing, setEditing] = useState(false);
  const [isLinking, setLinking] = useState(false);
  const [isDeleteConfirm, setDeleteConfirm] = useState(false);
  const [isViewing, setViewing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editPrescriptions, setEditPrescriptions] = useState<string[]>([]);
  const [editChairId, setEditChairId] = useState<string>("");
  const [editParticipants, setEditParticipants] = useState<Participant[]>([]);
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const editorRef = useRef<RichTextEditorHandle | null>(null);

  const chairName = (id: string | null) => (id ? chairs.find((c) => c.id === id)?.name ?? "체어" : "체어");
  const preview = stripHtml(record.content).slice(0, 120);
  const charCount = stripHtml(record.content).length;
  const linked = record.linked;

  const startEdit = () => {
    setEditContent(record.content);
    setEditPrescriptions(record.prescriptions ?? []);
    setEditChairId(record.chair_id ?? "");
    setEditParticipants(record.participants ?? []);
    setMsg("");
    setLinking(false);
    setDeleteConfirm(false);
    setEditing(true);
  };

  const saveEdit = (thenLink: boolean) => {
    setMsg("");
    startTransition(async () => {
      const result = await updateChairRecordContent({
        consultationId: record.id,
        content: editContent,
        prescriptions: editPrescriptions,
        chairId: editChairId || undefined,
        participants: editParticipants,
      });
      if (result.ok) {
        await onMutated();
        setEditing(false);
        if (thenLink) setLinking(true);
      } else {
        setMsg(result.message);
      }
    });
  };

  const handleDelete = () => {
    setDeleteConfirm(false);
    startTransition(async () => {
      if (linked) await deleteConsultation({ consultationId: record.id });
      else await deleteChairRecord({ consultationId: record.id });
      if (record.chair_id) await refreshUnlinkedCount(record.chair_id);
      await onMutated();
    });
  };

  const handleLinked = async () => {
    if (record.chair_id) await refreshUnlinkedCount(record.chair_id);
    setLinking(false);
    await onMutated();
  };

  return (
    <div className={`rounded-2xl border border-slate-100 border-l-4 ${linked ? "border-l-emerald-400 bg-emerald-50/20" : "border-l-amber-400 bg-amber-50/30"} p-4 shadow-sm`}>
      {/* 메타 */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${linked ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {linked ? "연결 완료" : "미연결"}
        </span>
        {record.chair_id && (
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <span className={`flex size-5 items-center justify-center rounded-lg ${linked ? "bg-emerald-600" : "bg-sky-600"} text-[9px] font-bold text-white`}>
              {chairName(record.chair_id).slice(0, 2)}
            </span>
            {chairName(record.chair_id)}
          </span>
        )}
        {linked ? (
          <span className="inline-flex items-center gap-1 font-medium text-slate-700">👤 {record.patient_name ?? "환자"}</span>
        ) : (
          record.participants.length > 0 && (
            <span className="inline-flex items-center gap-1 text-slate-400">🩺 {record.participants.map((p) => p.name).join(", ")}</span>
          )
        )}
        <span className="ml-auto flex items-center gap-1.5 text-slate-400">
          <span>{formatDate(record.created_at)}</span>
          <span className="text-slate-300">·</span>
          <span>{charCount}자</span>
        </span>
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-3">
          <ConsultationEditor
            ref={editorRef}
            content={editContent}
            onContentChange={setEditContent}
            placeholder="상담 내용을 수정하세요…"
            prescriptions={editPrescriptions}
            onPrescriptionsChange={setEditPrescriptions}
            chairs={chairs}
            chairId={editChairId}
            onChairChange={setEditChairId}
            members={members}
            recent={recent}
            me={me}
            participants={editParticipants}
            onParticipantsChange={setEditParticipants}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => saveEdit(false)} disabled={isPending}
              className="inline-flex min-h-9 items-center rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
              {isPending ? "저장 중…" : "저장"}
            </button>
            {!linked && (
              <button type="button" onClick={() => saveEdit(true)} disabled={isPending}
                className="inline-flex min-h-9 items-center rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50">
                저장 후 환자 연결
              </button>
            )}
            <CopyAllButton html={editContent} label="전체 복사"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900" />
            <button type="button" onClick={() => { setEditing(false); setMsg(""); }} disabled={isPending}
              className="inline-flex min-h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              취소
            </button>
          </div>
          {msg && <p className="text-xs text-red-500">{msg}</p>}
        </div>
      ) : isLinking ? (
        <ChairPatientSearch consultationId={record.id} onLinked={handleLinked} onCancel={() => setLinking(false)} />
      ) : (
        <>
          <div role="button" tabIndex={0} aria-expanded={isViewing}
            onClick={() => setViewing((v) => !v)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewing((v) => !v); } }}
            className={`mb-3 cursor-pointer rounded-xl px-2 py-1.5 -mx-2 transition ${linked ? "hover:bg-emerald-50/60" : "hover:bg-amber-50/60"}`}>
            {isViewing ? (
              <div className="rich-content text-sm leading-6 text-slate-800"
                dangerouslySetInnerHTML={{ __html: optimizeContentHtml(record.content || "<p>내용 없음</p>") }} />
            ) : (
              <p className="text-sm leading-relaxed text-slate-700">
                {preview || "내용 없음"}{charCount > 120 && <span className="text-slate-400">…</span>}
              </p>
            )}
            <span className={`mt-1.5 inline-flex items-center gap-0.5 text-xs font-medium ${linked ? "text-emerald-600" : "text-sky-600"}`}>
              {isViewing ? "접기 ▲" : "눌러서 전체 보기 ▼"}
            </span>
          </div>

          {(record.prescriptions ?? []).length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(record.prescriptions ?? []).map((name) => (
                <span key={name} className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">{name}</span>
              ))}
            </div>
          )}

          {isDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">삭제하시겠습니까?</span>
              <button type="button" onClick={handleDelete} disabled={isPending}
                className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50">삭제</button>
              <button type="button" onClick={() => setDeleteConfirm(false)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">취소</button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <CopyAllButton html={record.content} label="전체 복사"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-xl bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-900" />
              {record.has_audio && <AudioReplayButton consultationId={record.id} />}
              {!linked && (
                <button type="button" onClick={() => setLinking(true)}
                  className="inline-flex min-h-8 items-center rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-700 hover:bg-sky-100">환자 연결</button>
              )}
              {linked ? (
                record.patient_id && (
                  <Link href={`/patients/${record.patient_id}`} className="inline-flex min-h-8 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">편집</Link>
                )
              ) : (
                <button type="button" onClick={startEdit}
                  className="inline-flex min-h-8 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">편집</button>
              )}
              {!linked && record.chair_id && (
                <button type="button" onClick={() => openOverlay(record.chair_id!)}
                  className="inline-flex min-h-8 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">새 녹음</button>
              )}
              <button type="button" onClick={() => setDeleteConfirm(true)} disabled={isPending}
                className="inline-flex min-h-8 items-center rounded-xl border border-red-100 bg-white px-3 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-40">삭제</button>
            </div>
          )}

          {/* 확인 꼬리표 */}
          <ReviewFlags consultationId={record.id} flags={flags} onChanged={onFlagsChanged} />
        </>
      )}
    </div>
  );
}
