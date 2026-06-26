"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminInstitutionView, StaffMemberView } from "@/app/actions/admin";
import {
  getInstitutionStaff,
  setStaffActiveAsAdmin,
  setInstitutionLab,
  createInstitutionAsAdmin,
} from "@/app/actions/admin";

const ROLE_LABEL: Record<string, string> = {
  owner: "대표",
  admin: "관리자",
  staff: "직원",
};

interface InstitutionListProps {
  institutions: AdminInstitutionView[];
}

export function InstitutionList({ institutions }: InstitutionListProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 기관 생성(EO 연동 선발급용) — 입력·결과 id
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ id: string; existed: boolean } | null>(null);
  const [staffMap, setStaffMap] = useState<Record<string, StaffMemberView[]>>({});
  const [loadingInst, setLoadingInst] = useState<string | null>(null);
  const [loadingMember, setLoadingMember] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 워크스페이스 실험실(Engine Lab) 상태 — prop 초기값에서 시작, 토글 시 낙관적 갱신
  const [labState, setLabState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(institutions.map((i) => [i.id, i.lab_enabled])),
  );
  const [loadingLab, setLoadingLab] = useState<string | null>(null);
  // 기관 ID 복사 피드백(EO SSO 연동용 institution_id를 슈퍼어드민이 바로 확인·복사)
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopyId(institutionId: string) {
    try {
      await navigator.clipboard.writeText(institutionId);
      setCopiedId(institutionId);
      setTimeout(() => setCopiedId((c) => (c === institutionId ? null : c)), 1500);
    } catch {
      setError("복사에 실패했습니다. 수동으로 선택해 복사하세요.");
    }
  }

  async function handleCreateInstitution() {
    const name = newName.trim();
    if (!name || creating) return;
    setError(null);
    setCreatedResult(null);
    setCreating(true);
    const result = await createInstitutionAsAdmin(name);
    setCreating(false);
    if (result.ok) {
      setCreatedResult({ id: result.id, existed: result.existed });
      setNewName("");
      router.refresh(); // 목록 갱신(새 기관 노출)
    } else {
      setError(result.message);
    }
  }

  async function handleLabToggle(institutionId: string, current: boolean) {
    if (loadingLab) return;
    setError(null);
    setLoadingLab(institutionId);
    const result = await setInstitutionLab(institutionId, !current);
    if (result.ok) {
      setLabState((prev) => ({ ...prev, [institutionId]: !current }));
    } else {
      setError(result.message);
    }
    setLoadingLab(null);
  }

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

      {/* 기관 생성 — EO SSO 연동 선발급용. 같은 이름이 있으면 그 id를 반환. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">기관 생성 (EO 연동용)</p>
        <p className="mt-0.5 text-xs text-slate-500">
          EO 워크스페이스에 연결할 Carelog 기관을 만들고 institution_id를 받습니다. 같은
          이름이 이미 있으면 그 id를 반환합니다.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateInstitution();
            }}
            placeholder="예: 오늘의치과 강남점"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
          />
          <button
            onClick={handleCreateInstitution}
            disabled={creating || !newName.trim()}
            className="shrink-0 rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
          >
            {creating ? "생성 중…" : "생성"}
          </button>
        </div>
        {createdResult && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-800">
                {createdResult.existed ? "기존 기관 — institution_id" : "생성됨 — institution_id"}
              </p>
              <code className="mt-0.5 block truncate font-mono text-xs text-emerald-700">
                {createdResult.id}
              </code>
            </div>
            <button
              onClick={() => handleCopyId(createdResult.id)}
              className="shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              {copiedId === createdResult.id ? "복사됨 ✓" : "복사"}
            </button>
          </div>
        )}
      </div>

      {institutions.map((inst) => (
        <div
          key={inst.id}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <button
            onClick={() => handleExpand(inst.id)}
            className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{inst.name}</span>
              <span className="text-xs text-slate-500">{inst.type}</span>
              {labState[inst.id] && (
                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                  실험실
                </span>
              )}
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
              {/* 기관 ID — EO SSO 연동(JWT institution_id) 선발급용. 슈퍼어드민만 보는 콘솔. */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700">기관 ID (EO 연동용)</p>
                  <code className="mt-0.5 block truncate font-mono text-xs text-slate-500">
                    {inst.id}
                  </code>
                </div>
                <button
                  onClick={() => handleCopyId(inst.id)}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  {copiedId === inst.id ? "복사됨 ✓" : "복사"}
                </button>
              </div>
              {/* 워크스페이스 실험실 토글 — 녹음 엔진 picker 노출 여부 */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-violet-50/40 px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">실험실 (녹음 엔진)</p>
                  <p className="text-xs text-slate-500">
                    켜면 이 워크스페이스의 상담보드에 엔진 선택(기본/다국어/비교)이 노출됩니다.
                  </p>
                </div>
                <button
                  onClick={() => handleLabToggle(inst.id, labState[inst.id] ?? false)}
                  disabled={loadingLab === inst.id}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
                    labState[inst.id] ? "bg-violet-500" : "bg-slate-300"
                  }`}
                  aria-label={labState[inst.id] ? "실험실 끄기" : "실험실 켜기"}
                >
                  <span
                    className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                      labState[inst.id] ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
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
