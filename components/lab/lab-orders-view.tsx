"use client";

// spec 035 — 기공지 목록 + 작성 진입. 전송 상태(sent/queued/failed)와 재전송을 한 화면에.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  retryLabOrder,
  getLabOrderSet,
  type LabOrderContext,
  type LabOrderListRow,
  type LabOrderSetSnapshot,
} from "@/app/actions/lab-orders";
import { LabOrderComposer } from "@/components/lab/lab-order-composer";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  sent: { label: "전송 완료", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  queued: { label: "전송 대기", cls: "border-sky-200 bg-sky-50 text-sky-700" },
  failed: { label: "전송 실패", cls: "border-rose-200 bg-rose-50 text-rose-600" },
};

export function LabOrdersView({
  ctx,
  rows,
  openNew,
}: {
  ctx: LabOrderContext;
  rows: LabOrderListRow[];
  openNew: boolean;
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(openNew);
  const [editSnapshot, setEditSnapshot] = useState<LabOrderSetSnapshot | null>(null);
  const [info, setInfo] = useState("");
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  const retry = (id: string) => {
    startTransition(async () => {
      const r = await retryLabOrder(id);
      if (r.ok) {
        // 거절(failed)은 빨간 톤 — 성공·대기만 초록
        if (r.status === "failed") setMsg(r.message);
        else setInfo(r.message);
        router.refresh();
      } else setMsg(r.message);
    });
  };

  // 보낸 기공지 수정·첨부 추가 — 세트 전체를 불러와 컴포저로
  const edit = (id: string) => {
    startTransition(async () => {
      const r = await getLabOrderSet(id);
      if (r.ok) {
        setEditSnapshot(r.snapshot);
        setComposing(true);
        setMsg("");
      } else setMsg(r.message);
    });
  };

  return (
    <div className="space-y-6">
      {!ctx.gatewayOn && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          EO 전송 통로(게이트웨이)가 아직 연결 전입니다 — 지금 쓰는 기공지는 안전하게 보관됐다가
          연결되는 즉시 자동 전송됩니다.
        </div>
      )}
      {info && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          {info}
        </div>
      )}
      {msg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{msg}</div>
      )}

      {composing ? (
        <LabOrderComposer
          key={editSnapshot?.setId ?? "new"}
          ctx={ctx}
          initial={editSnapshot}
          onDone={(message, status) => {
            setComposing(false);
            setEditSnapshot(null);
            // 거절(failed)은 빨간 톤으로 — 성공·대기만 초록
            if (status === "failed") setMsg(message);
            else setInfo(message);
            router.refresh();
          }}
          onCancel={() => {
            setComposing(false);
            setEditSnapshot(null);
          }}
        />
      ) : (
        <button
          onClick={() => setComposing(true)}
          className="w-full rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 px-5 py-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
        >
          + 새 기공지 작성
        </button>
      )}

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-800">보낸 기공지</h2>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400 shadow-sm">
            아직 작성한 기공지가 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {rows.map((r) => {
              const meta = STATUS_META[r.status] ?? STATUS_META.queued;
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-slate-800">{r.patient_name}</span>
                      <span className="text-slate-400">→ {r.lab_name}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
                        {meta.label}
                      </span>
                      {r.revision > 1 && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            r.last_edit?.after_sent
                              ? "border-amber-300 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-slate-50 text-slate-500"
                          }`}
                          title={
                            r.last_edit
                              ? `${new Date(r.last_edit.at).toLocaleString("ko-KR")} · ${r.last_edit.by} 수정${r.last_edit.after_sent ? " (전송 후)" : ""}`
                              : ""
                          }
                        >
                          v{r.revision} 수정됨{r.last_edit?.after_sent ? " · 전송 후" : ""}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {r.prosthesis}
                      {r.tooth.length > 0 ? ` · #${r.tooth.join(",")}` : ""}
                      {r.order_date ? ` · 의뢰 ${r.order_date}` : ""}
                      {r.due_date ? ` · 납기 ${r.due_date}` : ""}
                      {r.created_by ? ` · ${r.created_by}` : ""}
                      {r.eo_order_id ? ` · EO #${r.eo_order_id}` : ""}
                    </div>
                    {r.last_edit && (
                      <div className="mt-0.5 text-xs text-slate-400">
                        최근 수정: {new Date(r.last_edit.at).toLocaleString("ko-KR")} · {r.last_edit.by}
                        {r.last_edit.after_sent ? " · ⚠️ 전송(접수) 후 수정" : ""}
                      </div>
                    )}
                    {r.error && r.status !== "sent" && (
                      <div className="mt-0.5 text-xs text-rose-500">{r.error}</div>
                    )}
                  </div>
                  <button
                    onClick={() => edit(r.id)}
                    disabled={isPending}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    title="내용 수정·사진/동영상 추가 (수정 이력이 남습니다)"
                  >
                    수정·첨부
                  </button>
                  {r.status !== "sent" && (
                    <button
                      onClick={() => retry(r.id)}
                      disabled={isPending}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      다시 보내기
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
