"use client";

// spec 040 — 환자 페이지 "잇몸 기록" — 회차 목록 · 새로 시작(상담 없이도) · 열어 고치기.

import { useCallback, useEffect, useState } from "react";
import { deleteOralExam, getOralExam, listOralExams, type OralExamListItem } from "@/app/actions/oral-exams";
import { PerioEditor } from "@/components/oral/perio-editor";
import type { PerioData } from "@/lib/oral/perio";

export function PatientOralExams({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [items, setItems] = useState<OralExamListItem[] | null>(null);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<{ id: string | null; data: PerioData | null } | null>(null);

  // 다시 불러오기 신호(저장·삭제 후 +1)
  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    void listOralExams(patientId).then((r) => {
      if (!alive) return;
      if (r.ok) {
        setItems(r.items);
        setMsg("");
      } else {
        setItems([]);
        setMsg(r.message);
      }
    });
    return () => {
      alive = false;
    };
  }, [patientId, tick]);

  const openExam = async (id: string) => {
    const r = await getOralExam(id);
    if (!r.ok) return setMsg(r.message);
    setOpen({ id: r.id, data: r.data });
  };

  const remove = async (id: string) => {
    if (!confirm("이 잇몸 기록을 지울까요? 되돌릴 수 없습니다.")) return;
    const r = await deleteOralExam(id);
    if (!r.ok) return setMsg(r.message);
    load();
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-rose-600">잇몸 기록 (치주 차트)</p>
        <button
          type="button"
          onClick={() => setOpen({ id: null, data: null })}
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-800 hover:bg-rose-100"
        >
          🩺 새 잇몸 기록
        </button>
      </div>
      {msg && <p className="mb-2 text-xs text-amber-700">{msg}</p>}
      {items === null ? (
        <p className="text-sm text-slate-400">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">아직 잇몸 기록이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((it) => {
            const s = it.summary;
            return (
              <li key={it.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                <span className="font-semibold text-slate-800">{new Date(it.recordedAt).toLocaleDateString("ko-KR")}</span>
                {s && (
                  <span className="text-slate-600">
                    측정 {s.sites}부위{s.meanPd !== null ? ` · 평균 PD ${s.meanPd}mm` : ""} · 4mm↑ {s.pd4} · 6mm↑ {s.pd6}
                    {s.bopPct !== null ? ` · 출혈 ${s.bopPct}%` : ""}
                    {s.pcr !== null ? ` · 치태 ${s.pcr}%` : ""}
                  </span>
                )}
                {it.status === "draft" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">작성 중</span>}
                <span className="ml-auto flex gap-2">
                  <button type="button" onClick={() => void openExam(it.id)} className="text-sky-700 hover:underline">
                    열기
                  </button>
                  <button type="button" onClick={() => void remove(it.id)} className="text-slate-400 hover:text-red-600">
                    지우기
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {open && (
        <PerioEditor
          patient={{ id: patientId, name: patientName }}
          examId={open.id}
          initialData={open.data}
          onSaved={load}
          onClose={() => {
            setOpen(null);
            load();
          }}
        />
      )}
    </div>
  );
}
