"use client";

import { useEffect, useState, useTransition } from "react";
import {
  REVIEW_FLAG_TYPES,
  flagMeta,
  type ReviewFlag,
} from "@/lib/review-flags";
import {
  addReviewFlag,
  resolveReviewFlag,
  deleteReviewFlag,
} from "@/app/actions/review-flags";

// spec 021 확인 꼬리표 — 카드에 붙는 '확인 필요' 칩 + 추가/완료/삭제.
export function ReviewFlags({
  consultationId,
  flags,
  onChanged,
}: {
  consultationId: string;
  flags: ReviewFlag[];
  onChanged?: () => void;
}) {
  const [local, setLocal] = useState<ReviewFlag[]>(flags);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => setLocal(flags), [flags]);

  const open = local.filter((f) => f.status === "open");

  const add = (type: string) =>
    startTransition(async () => {
      const r = await addReviewFlag(consultationId, type, note);
      if (r.ok) {
        setAdding(false);
        setNote("");
        onChanged?.();
      }
    });

  const resolve = (id: string) =>
    startTransition(async () => {
      setLocal((l) => l.map((f) => (f.id === id ? { ...f, status: "resolved" } : f)));
      await resolveReviewFlag(id);
      onChanged?.();
    });

  const remove = (id: string) =>
    startTransition(async () => {
      setLocal((l) => l.filter((f) => f.id !== id));
      await deleteReviewFlag(id);
      onChanged?.();
    });

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {open.map((f) => {
        const m = flagMeta(f.type);
        return (
          <span
            key={f.id}
            className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 py-0.5 pl-2 pr-1 text-xs font-medium text-amber-800"
            title={f.note ?? undefined}
          >
            <span>{m.emoji}</span>
            <span>{m.label}</span>
            {f.note && <span className="max-w-[8rem] truncate text-amber-600">· {f.note}</span>}
            <button
              type="button"
              onClick={() => resolve(f.id)}
              disabled={pending}
              title="확인 완료"
              className="ml-0.5 flex size-4 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-100"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={() => remove(f.id)}
              disabled={pending}
              title="꼬리표 삭제"
              className="flex size-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            >
              ✕
            </button>
          </span>
        );
      })}

      {adding ? (
        <span className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
          {REVIEW_FLAG_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => add(t.id)}
              disabled={pending}
              className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {t.emoji} {t.label}
            </button>
          ))}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="메모(선택)"
            className="w-24 rounded-lg border border-slate-200 px-2 py-0.5 text-xs outline-none focus:border-sky-300"
          />
          <button
            type="button"
            onClick={() => { setAdding(false); setNote(""); }}
            className="rounded-lg px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-600"
          >
            취소
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-500 transition hover:border-amber-300 hover:text-amber-700"
        >
          + 확인 필요
        </button>
      )}
    </div>
  );
}
