"use client";

import { useState } from "react";
import { setStaffActive, changeStaffRole, removeStaff } from "@/app/actions/admin";
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

  async function handleRoleChange(memberId: string, newRole: "staff" | "admin") {
    if (loadingId) return;
    setError(null);
    setLoadingId(memberId);
    const result = await changeStaffRole(memberId, newRole);
    if (!result.ok) setError(result.message);
    setLoadingId(null);
  }

  async function handleRemove(memberId: string, email: string) {
    if (loadingId) return;
    if (!window.confirm(`'${email}' 직원을 기관에서 제거할까요?\n접근 권한이 회수되며, 다시 초대할 수 있습니다.`)) {
      return;
    }
    setError(null);
    setLoadingId(memberId);
    const result = await removeStaff(memberId);
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
              {canManage && <th className="px-4 py-3 text-right">관리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => {
              const isSelf = m.user_id === currentUserId;
              const isProtected = isSelf || m.role === "owner";
              const busy = loadingId === m.id;
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
                    {canManage && !isProtected ? (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          handleRoleChange(m.id, e.target.value as "staff" | "admin")
                        }
                        disabled={busy}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-sky-300 disabled:opacity-50"
                        aria-label="역할 변경"
                      >
                        <option value="staff">직원</option>
                        <option value="admin">관리자</option>
                      </select>
                    ) : (
                      ROLE_LABEL[m.role] ?? m.role
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(m.joined_at).toLocaleDateString("ko-KR")}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      {isProtected ? (
                        <div className="text-right">
                          <span className="text-xs text-slate-400">–</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleToggle(m.id, m.is_active)}
                            disabled={busy}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
                              m.is_active ? "bg-sky-500" : "bg-slate-300"
                            }`}
                            aria-label={m.is_active ? "비활성화" : "활성화"}
                            title={m.is_active ? "접근 비활성화" : "접근 활성화"}
                          >
                            <span
                              className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                                m.is_active ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                          <button
                            onClick={() => handleRemove(m.id, m.email)}
                            disabled={busy}
                            className="text-xs font-medium text-red-500 transition hover:text-red-600 disabled:opacity-50"
                          >
                            제거
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canManage && (
        <p className="px-1 text-xs text-slate-400">
          토글은 접근 권한(비활성 시 로그인은 되나 기관 데이터 접근 불가), 제거는 기관에서 완전히 내보냅니다.
        </p>
      )}
    </div>
  );
}
