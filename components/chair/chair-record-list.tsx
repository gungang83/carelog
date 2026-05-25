"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { getUnlinkedChairRecords, deleteChairRecord } from "@/app/actions/chairs";
import { ChairPatientSearch } from "@/components/chair/chair-patient-search";

type Record = { id: string; content: string; created_at: string };

interface ChairRecordListProps {
  chairId: string;
  onLinked: () => void;
}

export function ChairRecordList({ chairId, onLinked }: ChairRecordListProps) {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getUnlinkedChairRecords(chairId);
    setRecords(data);
    setLoading(false);
  }, [chairId]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = (id: string) => {
    setDeleteConfirmId(null);
    setDeletingId(id);
    startTransition(async () => {
      await deleteChairRecord({ consultationId: id });
      await load();
      setDeletingId(null);
    });
  };

  const handleLinked = async () => {
    await load();
    onLinked();
    setLinkingId(null);
  };

  if (linkingId) {
    return (
      <ChairPatientSearch
        consultationId={linkingId}
        onLinked={handleLinked}
        onCancel={() => setLinkingId(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
        <span className="inline-block size-3 animate-spin rounded-full border border-slate-300 border-t-slate-600" />
        불러오는 중…
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <p className="py-2 text-sm text-slate-500">미연결 기록이 없습니다.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-slate-500">미연결 기록 ({records.length}건)</p>
      <ul className="flex flex-col gap-1.5">
        {records.map((rec) => (
          <li
            key={rec.id}
            className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
          >
            <p className="line-clamp-2 text-sm text-slate-700">
              {stripHtml(rec.content) || "내용 없음"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {formatDate(rec.created_at)}
            </p>
            {deleteConfirmId === rec.id ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-red-600">삭제하시겠습니까?</span>
                <button
                  type="button"
                  onClick={() => handleDelete(rec.id)}
                  disabled={isPending}
                  className="rounded-lg bg-red-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  삭제
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-white"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setLinkingId(rec.id)}
                  className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
                >
                  환자 연결
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(rec.id)}
                  disabled={deletingId === rec.id}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                >
                  {deletingId === rec.id ? "삭제 중…" : "삭제"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
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
