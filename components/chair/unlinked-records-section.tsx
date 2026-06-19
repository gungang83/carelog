"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useChairContext } from "@/components/chair/chair-provider";
import { CopyAllButton } from "@/components/copy-all-button";
import {
  getAllUnlinkedRecords,
  deleteChairRecord,
  updateChairRecordContent,
  type AllUnlinkedRecord,
} from "@/app/actions/chairs";
import { ChairPatientSearch } from "@/components/chair/chair-patient-search";
import { PrescriptionPicker } from "@/components/chair/prescription-picker";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/rich-text-editor";

export function UnlinkedRecordsSection({ initialRecords }: { initialRecords: AllUnlinkedRecord[] }) {
  const { chairs, openOverlay, refreshUnlinkedCount } = useChairContext();
  const [records, setRecords] = useState<AllUnlinkedRecord[]>(initialRecords);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editPrescriptions, setEditPrescriptions] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const editorRef = useRef<RichTextEditorHandle>(null);

  // router.refresh()(실시간 알림·저장 후)로 서버가 새 목록을 내려주면 반영한다.
  // 이로써 다른 기기에서 올린 기록도 이 화면의 '미연결 기록'에 자동으로 나타난다.
  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  const reload = async () => {
    const data = await getAllUnlinkedRecords();
    setRecords(data);
  };

  if (records.length === 0) return null;

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

  const cancelEdit = () => {
    setEditingId(null);
    setMsg("");
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

  // 저장하고 바로 환자 연결 화면으로 — 편집 후 별도 클릭 없이 연결까지 한 동선.
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
    await reload();
    setLinkingId(null);
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-700">
        미연결 기록
        <span className="ml-2 inline-flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
          {records.length > 9 ? "9+" : records.length}
        </span>
      </h2>

      <ul className="flex flex-col gap-3">
        {records.map((rec) => {
          const isEditing = editingId === rec.id;
          const isLinking = linkingId === rec.id;
          const isDeleteConfirm = deleteConfirmId === rec.id;
          const preview = stripHtml(rec.content).slice(0, 120);
          const charCount = stripHtml(rec.content).length;

          return (
            <li
              key={rec.id}
              className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm"
            >
              {/* 기록 헤더 */}
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="flex size-5 items-center justify-center rounded-lg bg-sky-600 text-[9px] font-bold text-white">
                  {chairName(rec.chair_id).slice(0, 2)}
                </span>
                <span className="font-medium text-slate-700">{chairName(rec.chair_id)}</span>
                <span className="text-slate-300">·</span>
                <span>{formatDate(rec.created_at)}</span>
                <span className="text-slate-300">·</span>
                <span>{charCount}자</span>
              </div>

              {/* 편집 모드 */}
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
                      onClick={cancelEdit}
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
                  {/* 내용 미리보기 */}
                  <p className="mb-3 text-sm leading-relaxed text-slate-700">
                    {preview || "내용 없음"}
                    {charCount > 120 && <span className="text-slate-400">…</span>}
                  </p>

                  {/* 처방 배지 */}
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

                  {/* 삭제 확인 */}
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}

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
