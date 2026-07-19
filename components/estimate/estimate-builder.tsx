"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fmtWon,
  formatEstimateBlock,
  type EstimateRow,
  type TreatmentItem,
} from "@/lib/treatment-items";
import { getTreatmentItems } from "@/app/actions/treatment-items";

// spec 028 견적 빌더 — 프리셋 클릭으로 행 추가 → 수량·단가 조정 → [치료비 견적] 평문 블록 삽입.
// 체어 태블릿 고려: 큰 행·수량 ± 스텝퍼·숫자 키패드(inputMode).
export function EstimateBuilder({
  onInsert,
  onClose,
}: {
  onInsert: (text: string) => void;
  onClose: () => void;
}) {
  const [presets, setPresets] = useState<TreatmentItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<EstimateRow[]>([]);
  const [memo, setMemo] = useState("보험 적용 여부에 따라 달라질 수 있습니다");

  useEffect(() => {
    getTreatmentItems().then(setPresets).catch(() => setPresets([]));
  }, []);

  const filteredPresets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (presets ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [presets, query]);

  const total = rows.reduce((s, r) => s + r.qty * r.price, 0);

  const addRow = (name = "", price = 0) =>
    setRows((prev) => [...prev, { name, qty: 1, price }]);
  const patchRow = (i: number, patch: Partial<EstimateRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i));

  const insert = () => {
    const valid = rows.filter((r) => r.name.trim());
    if (valid.length === 0) return;
    onInsert(formatEstimateBlock(valid, memo));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-label="치료비 견적 만들기"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">₩ 치료비 견적</h3>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* 프리셋 */}
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-600">치료 항목 (탭해서 추가)</p>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="검색"
                className="ml-auto w-32 rounded-lg border border-slate-200 px-2.5 py-1 text-xs outline-none focus:border-sky-500"
              />
            </div>
            {presets === null ? (
              <p className="py-3 text-center text-xs text-slate-400">불러오는 중…</p>
            ) : filteredPresets.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-3 text-center text-xs text-slate-400">
                {(presets?.length ?? 0) === 0
                  ? "등록된 치료 항목이 없습니다. 설정 → 치료 항목·수가에서 등록하거나 아래에 직접 입력하세요."
                  : "검색 결과가 없습니다."}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {filteredPresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addRow(p.name, p.price)}
                    className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
                    title={`${fmtWon(p.price)}원`}
                  >
                    {p.name} <span className="text-sky-500">{fmtWon(p.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 견적 행 */}
          <div className="space-y-2">
            {rows.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">
                위 항목을 탭하거나 &apos;+ 직접 입력&apos;으로 견적을 만드세요.
              </p>
            )}
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2">
                <input
                  value={r.name}
                  onChange={(e) => patchRow(i, { name: e.target.value })}
                  placeholder="항목명 (예: 상담 할인)"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-sky-500"
                />
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => patchRow(i, { qty: Math.max(1, r.qty - 1) })}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-base font-bold text-slate-600 hover:bg-slate-50"
                    aria-label="수량 줄이기"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-medium text-slate-700">{r.qty}</span>
                  <button
                    type="button"
                    onClick={() => patchRow(i, { qty: r.qty + 1 })}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-base font-bold text-slate-600 hover:bg-slate-50"
                    aria-label="수량 늘리기"
                  >
                    ＋
                  </button>
                </div>
                <input
                  value={r.price === 0 ? "" : String(r.price)}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9-]/g, "");
                    patchRow(i, { price: Number(v) || 0 });
                  }}
                  inputMode="numeric"
                  placeholder="단가(원)"
                  className="w-28 shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-right text-sm outline-none focus:border-sky-500"
                  aria-label="단가(원) — 할인은 음수"
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="shrink-0 rounded-lg px-2 py-1 text-sm text-red-400 hover:bg-red-50"
                  aria-label="행 삭제"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addRow()}
              className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 transition hover:border-sky-400 hover:text-sky-600"
            >
              + 직접 입력 (할인은 단가를 음수로)
            </button>
          </div>

          {/* 메모 */}
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="안내 메모(선택) — ※ 로 표시됩니다"
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
        </div>

        {/* 푸터: 합계 + 삽입 */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="text-sm text-slate-600">
            합계 <span className="text-lg font-bold text-slate-900">{fmtWon(total)}원</span>
          </p>
          <button
            type="button"
            onClick={insert}
            disabled={rows.filter((r) => r.name.trim()).length === 0}
            className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
          >
            기록에 삽입
          </button>
        </div>
      </div>
    </div>
  );
}
