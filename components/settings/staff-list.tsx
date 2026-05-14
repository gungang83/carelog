"use client";

import { useState } from "react";
import { setStaffActive } from "@/app/actions/admin";
import type { StaffMemberView } from "@/app/actions/admin";

const ROLE_LABEL: Record<string, string> = {
  owner: "대표",
  admin: "관리자",
  staff: "직원",
};

interface StaffListProps {
  members: StaffMemberView[];
  currentUserId: string;
  currentRole: "owner" | "admin" | "staff";
}

export function StaffList({ members, currentUserId, currentRole }: StaffListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = currentRole === "owner" || currentRole === "admin";

  async function handleToggle(memberId: string, currentActive: boolean) {
    if (loadingId) return;
    setError(null);
    setLoadingId(memberId);
    const result = await setStaffActive(memberId, !currentActive);
    if (!result.ok) setError(result.message);
    setLoadingId(null);
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3">역할</th>
              <th className="px-4 py-3">가입일</th>
              {canManage && <th className="px-4 py-3 text-right">접근 권한</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => {
              const isSelf = m.user_id === currentUserId;
              return (
                <tr key={m.id} className={m.is_active ? "" : "opacity-50"}>
                  <td className="px-4 py-3 text-slate-800">
                    {m.email}
                    {isSelf && (
                      <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                        나
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {ROLE_LABEL[m.role] ?? m.role}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(m.joined_at).toLocaleDateString("ko-KR")}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {isSelf || m.role === "owner" ? (
                        <span className="text-xs text-slate-400">–</span>
                      ) : (
                        <button
                          onClick={() => handleToggle(m.id, m.is_active)}
                          disabled={loadingId === m.id}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
                            m.is_active ? "bg-sky-500" : "bg-slate-300"
                          }`}
                          aria-label={m.is_active ? "비활성화" : "활성화"}
                        >
                          <span
                            className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                              m.is_active ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
