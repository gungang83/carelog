"use client";

import { useState, useTransition } from "react";
import { fmtWon, type TreatmentItem } from "@/lib/treatment-items";
import {
  createTreatmentItem,
  updateTreatmentItem,
  deleteTreatmentItem,
} from "@/app/actions/treatment-items";

// spec 028 — /settings "치료 항목·수가" 섹션 (owner/admin). 견적 빌더의 프리셋.
export function TreatmentItemsManager({ initialItems }: { initialItems: TreatmentItem[] }) {
  const [items, setItems] = useState<TreatmentItem[]>(initialItems);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    if (!newName.trim()) {
      setError("항목명을 입력해 주세요.");
      return;
    }
    setError("");
    startTransition(async () => {
      const r = await createTreatmentItem({
        name: newName.trim(),
        price: Number(newPrice.replace(/[^0-9-]/g, "")) || 0,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setItems((prev) => [...prev, r.item]);
      setNewName("");
      setNewPrice("");
    });
  };

  const saveEdit = (item: TreatmentItem) => {
    const name = editName.trim();
    const price = Number(editPrice.replace(/[^0-9-]/g, "")) || 0;
    setEditingId(null);
    if (!name || (name === item.name && price === item.price)) return;
    startTransition(async () => {
      const r = await updateTreatmentItem(item.id, { name, price });
      if (r.ok) {
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, name, price } : x)));
      } else {
        setError(r.message);
      }
    });
  };

  const toggleActive = (item: TreatmentItem) =>
    startTransition(async () => {
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, active: !item.active } : x)));
      const r = await updateTreatmentItem(item.id, { active: !item.active });
      if (!r.ok) {
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, active: item.active } : x)));
        setError(r.message);
      }
    });

  const remove = (item: TreatmentItem) =>
    startTransition(async () => {
      if (!window.confirm(`'${item.name}' 항목을 삭제할까요?`)) return;
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      const r = await deleteTreatmentItem(item.id);
      if (!r.ok) setError(r.message);
    });

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="항목명 (예: 임플란트(뼈이식 포함))"
            className="min-w-[12rem] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <input
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="기본 단가(원)"
            className="w-32 rounded-xl border border-slate-300 px-3 py-2 text-right text-sm outline-none focus:border-sky-500"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
          >
            추가
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <p className="mt-2 text-[11px] text-slate-400">
          상담 편집기의 &apos;₩ 견적&apos; 빌더에서 탭 한 번으로 견적 행이 됩니다. 단가는 참고값 — 견적마다 수정 가능해요.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-center text-sm text-slate-400">
          등록된 치료 항목이 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((item) => (
            <li
              key={item.id}
              className={`flex items-center gap-2 px-4 py-2.5 ${item.active ? "" : "opacity-50"}`}
            >
              {editingId === item.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-sky-300 px-2.5 py-1.5 text-sm outline-none"
                    autoFocus
                  />
                  <input
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value.replace(/[^0-9-]/g, ""))}
                    inputMode="numeric"
                    className="w-28 rounded-lg border border-sky-300 px-2.5 py-1.5 text-right text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(item)}
                    className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    저장
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{item.name}</span>
                  <span className="shrink-0 text-sm font-medium text-slate-600">
                    {fmtWon(item.price)}원
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditName(item.name);
                        setEditPrice(String(item.price));
                      }}
                      disabled={isPending}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(item)}
                      disabled={isPending}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {item.active ? "숨기기" : "노출"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      disabled={isPending}
                      className="rounded-lg border border-red-100 px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
