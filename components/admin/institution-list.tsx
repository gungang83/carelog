"use client";

import { useState } from "react";
import type { AdminInstitutionView, StaffMemberView } from "@/app/actions/admin";
import { getInstitutionStaff, setStaffActiveAsAdmin } from "@/app/actions/admin";

const ROLE_LABEL: Record<string, string> = {
  owner: "대표",
  admin: "관리자",
  staff: "직원",
};

interface InstitutionListProps {
  institutions: AdminInstitutionView[];
}

export function InstitutionList({ institutions }: InstitutionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [staffMap, setStaffMap] = useState<Record<string, StaffMemberView[]>>({});
  const [loadingInst, setLoadingInst] = useState<string | null>(null);
  const [loadingMember, setLoadingMember] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExpand(institutionId: string) {
    if (expandedId === institutionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(institutionId);
    if (staffMap[institutionId]) return;
    setLoadingInst(institutionId);
    const result = await getInstitutionStaff(institutionId);
    if (result.ok) {
      setStaffMap((prev) => ({ ...prev, [institutionId]: result.members }));
    }
    setLoadingInst(null);
  }

  async function handleToggle(memberId: string, institutionId: string, currentActive: boolean) {
    if (loadingMember) return;
    setError(null);
    setLoadingMember(memberId);
    const result = await setStaffActiveAsAdmin(memberId, !currentActive);
    if (result.ok) {
      setStaffMap((prev) => ({
        ...prev,
        [institutionId]: prev[institutionId]?.map((m) =>
          m.id === memberId ? { ...m, is_active: !currentActive } : m,
        ) ?? [],
      }));
    } else {
      setError(result.message);
    }
    setLoadingMember(null);
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {institutions.map((inst) => (
        <div
          key={inst.id}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <button
            onClick={() => handleExpand(inst.id)}
            className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50"
          >
            <div>
              <span className="font-semibold text-slate-800">{inst.name}</span>
              <span className="ml-2 text-xs text-slate-500">{inst.type}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>
                활성 {inst.active_member_count} / 전체 {inst.member_count}명
              </span>
              <span className="text-slate-300">
                {new Date(inst.created_at).toLocaleDateString("ko-KR")}
              </span>
              <svg
                className={`size-4 text-slate-400 transition-transform ${expandedId === inst.id ? "rotate-180" : ""}`}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>

          {expandedId === inst.id && (
            <div className="border-t border-slate-100">
              {loadingInst === inst.id ? (
                <div className="px-5 py-4 text-sm text-slate-400">불러오는 중…</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                      <th className="px-5 py-2">이메일</th>
                      <th className="px-5 py-2">역할</th>
                      <th className="px-5 py-2 text-right">접근 권한</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(staffMap[inst.id] ?? []).map((m) => (
                      <tr key={m.id} className={m.is_active ? "" : "opacity-50"}>
                        <td className="px-5 py-2.5 text-slate-800">{m.email}</td>
                        <td className="px-5 py-2.5 text-slate-600">
                          {ROLE_LABEL[m.role] ?? m.role}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          {m.role === "owner" ? (
                            <span className="text-xs text-slate-400">–</span>
                          ) : (
                            <button
                              onClick={() => handleToggle(m.id, inst.id, m.is_active)}
                              disabled={loadingMember === m.id}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
