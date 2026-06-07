"use client";

import { useState, useTransition } from "react";
import { upsertClinicMember } from "@/app/actions/clinic-members";
import { maskName } from "@/lib/mask-name";
import type { ClinicMemberRow } from "@/lib/types/database";

interface Props {
  initialMembers: ClinicMemberRow[];
}

export function ClinicMemberSettings({ initialMembers }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    if (!newName.trim()) return;
    setError("");
    startTransition(async () => {
      const result = await upsertClinicMember({
        name: newName.trim(),
        role: newRole.trim() || null,
        displayOrder: members.length,
        isActive: true,
      });
      if (result.ok) {
        setMembers(await refreshMembers());
        setNewName("");
        setNewRole("");
        setShowAddForm(false);
      } else {
        setError(result.message);
      }
    });
  };

  const handleToggleActive = (m: ClinicMemberRow) => {
    setError("");
    startTransition(async () => {
      const result = await upsertClinicMember({
        id: m.id,
        name: m.name,
        role: m.role,
        displayOrder: m.display_order,
        isActive: !m.is_active,
      });
      if (result.ok) {
        setMembers((prev) =>
          prev.map((x) =>
            x.id === m.id ? { ...x, is_active: !m.is_active } : x,
          ),
        );
      } else {
        setError(result.message);
      }
    });
  };

  const handleEdit = (m: ClinicMemberRow) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await upsertClinicMember({
        id: m.id,
        name: editName.trim(),
        role: editRole.trim() || null,
        displayOrder: m.display_order,
        isActive: m.is_active,
      });
      if (result.ok) {
        setMembers((prev) =>
          prev.map((x) =>
            x.id === m.id
              ? { ...x, name: editName.trim(), role: editRole.trim() || null }
              : x,
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
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">멤버 목록</h3>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
        >
          + 추가
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        원장·직원·담당자를 등록하면 녹음 시작 시 참여자로 선택할 수 있어요.
        환자 화면에는 {maskName("송정훈")}처럼 마스킹되어 표시됩니다.
      </p>

      {error && (
        <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {members.map((m) => (
          <li
            key={m.id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
              m.is_active
                ? "border-slate-200 bg-white"
                : "border-slate-100 bg-slate-50 opacity-60"
            }`}
          >
            {editingId === m.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="이름"
                  className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-sky-400 focus:outline-none"
                  autoFocus
                />
                <input
                  type="text"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  placeholder="역할(선택)"
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-sky-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleEdit(m)}
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
                  {m.name.slice(0, 1)}
                </span>
                <span className="flex-1 text-sm text-slate-700">
                  {m.name}
                  {m.role ? (
                    <span className="ml-1.5 text-xs text-slate-400">
                      {m.role}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(m.id);
                    setEditName(m.name);
                    setEditRole(m.role ?? "");
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  편집
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(m)}
                  disabled={isPending}
                  className={`rounded-lg px-2 py-0.5 text-xs font-medium transition disabled:opacity-40 ${
                    m.is_active
                      ? "border border-slate-200 text-slate-500 hover:bg-slate-50"
                      : "border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                  }`}
                >
                  {m.is_active ? "비활성화" : "활성화"}
                </button>
              </>
            )}
          </li>
        ))}
        {members.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">
            아직 등록된 멤버가 없어요. + 추가로 등록하세요.
          </li>
        )}
      </ul>

      {showAddForm && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="이름 (예: 송정훈)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            autoFocus
            maxLength={20}
          />
          <input
            type="text"
            placeholder="역할 (선택, 예: 원장)"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            maxLength={12}
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

async function refreshMembers(): Promise<ClinicMemberRow[]> {
  const { getClinicMembers } = await import("@/app/actions/clinic-members");
  return getClinicMembers();
}
