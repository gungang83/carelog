"use client";

import { useState, useTransition } from "react";
import { upsertChair } from "@/app/actions/chairs";
import type { ChairRow } from "@/lib/types/database";

interface ChairSettingsProps {
  initialChairs: ChairRow[];
}

export function ChairSettings({ initialChairs }: ChairSettingsProps) {
  const [chairs, setChairs] = useState(initialChairs);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    if (!newName.trim()) return;
    setError("");
    startTransition(async () => {
      const result = await upsertChair({
        name: newName.trim(),
        displayOrder: chairs.length,
        isActive: true,
      });
      if (result.ok) {
        const updated = await refreshChairs();
        setChairs(updated);
        setNewName("");
        setShowAddForm(false);
      } else {
        setError(result.message);
      }
    });
  };

  const handleToggleActive = (chair: ChairRow) => {
    setError("");
    startTransition(async () => {
      const result = await upsertChair({
        id: chair.id,
        name: chair.name,
        displayOrder: chair.display_order,
        isActive: !chair.is_active,
      });
      if (result.ok) {
        setChairs((prev) =>
          prev.map((c) =>
            c.id === chair.id ? { ...c, is_active: !chair.is_active } : c,
          ),
        );
      } else {
        setError(result.message);
      }
    });
  };

  const handleRename = (chair: ChairRow) => {
    if (!editName.trim() || editName.trim() === chair.name) {
      setEditingId(null);
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await upsertChair({
        id: chair.id,
        name: editName.trim(),
        displayOrder: chair.display_order,
        isActive: chair.is_active,
      });
      if (result.ok) {
        setChairs((prev) =>
          prev.map((c) =>
            c.id === chair.id ? { ...c, name: editName.trim() } : c,
          ),
        );
        setEditingId(null);
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">체어 목록</h3>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
        >
          + 추가
        </button>
      </div>

      {error && (
        <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {chairs.map((chair) => (
          <li
            key={chair.id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
              chair.is_active
                ? "border-slate-200 bg-white"
                : "border-slate-100 bg-slate-50 opacity-60"
            }`}
          >
            {editingId === chair.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(chair);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-sky-400 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleRename(chair)}
                  disabled={isPending}
                  className="rounded-lg bg-sky-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
                >
                  취소
                </button>
              </>
            ) : (
              <>
                <span className="flex size-7 items-center justify-center rounded-lg bg-sky-600 text-xs font-bold text-white">
                  {chair.name}
                </span>
                <span className="flex-1 text-sm text-slate-700">
                  체어 {chair.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(chair.id);
                    setEditName(chair.name);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  이름 변경
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(chair)}
                  disabled={isPending}
                  className={`rounded-lg px-2 py-0.5 text-xs font-medium transition disabled:opacity-40 ${
                    chair.is_active
                      ? "border border-slate-200 text-slate-500 hover:bg-slate-50"
                      : "border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                  }`}
                >
                  {chair.is_active ? "비활성화" : "활성화"}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {showAddForm && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="체어 이름 (예: D)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            autoFocus
            maxLength={10}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending || !newName.trim()}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
          >
            {isPending ? "추가 중…" : "추가"}
          </button>
        </div>
      )}
    </div>
  );
}

async function refreshChairs(): Promise<ChairRow[]> {
  const { getChairs } = await import("@/app/actions/chairs");
  return getChairs();
}
