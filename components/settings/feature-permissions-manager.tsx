"use client";

import { useState, useTransition } from "react";
import { FEATURE_META, type FeatureId } from "@/lib/permissions";
import { setFeatureOverride, type MemberPermissionRow } from "@/app/actions/permissions";

// spec 029 ③ — 설정 '기능 권한' (EO 개인 권한 설정 모델).
// 행 = 직원 계정, 열 = 기능. 기본(역할 기본값) / 허용 / 차단 3상태 오버라이드.
export function FeaturePermissionsManager({ initialRows }: { initialRows: MemberPermissionRow[] }) {
  const [rows, setRows] = useState<MemberPermissionRow[]>(initialRows);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const change = (memberId: string, featureId: FeatureId, state: "default" | "allow" | "deny") => {
    setError("");
    startTransition(async () => {
      const r = await setFeatureOverride(memberId, featureId, state);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setRows((prev) =>
        prev.map((m) =>
          m.memberId === memberId
            ? { ...m, features: { ...m.features, [featureId]: { ...m.features[featureId], state } } }
            : m,
        ),
      );
    });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] text-slate-400">
        기본값은 역할을 따릅니다(대표·관리자=허용, 직원=차단). 개인별로 허용/차단을 덮어쓸 수 있어요.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="py-2 pr-2 font-medium">직원</th>
              {FEATURE_META.map((f) => (
                <th key={f.id} className="px-2 py-2 font-medium" title={f.desc}>{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.memberId} className={`border-b border-slate-50 ${m.isActive ? "" : "opacity-40"}`}>
                <td className="py-2 pr-2">
                  <p className="text-sm font-medium text-slate-800">{m.displayName ?? m.email}</p>
                  <p className="text-[11px] text-slate-400">
                    {m.email} · {m.role === "owner" ? "대표" : m.role === "admin" ? "관리자" : "직원"}
                    {!m.isActive && " · 비활성"}
                  </p>
                </td>
                {FEATURE_META.map((f) => {
                  const st = m.features[f.id];
                  return (
                    <td key={f.id} className="px-2 py-2">
                      <select
                        value={st?.state ?? "default"}
                        disabled={isPending || m.role === "owner"}
                        onChange={(e) => change(m.memberId, f.id, e.target.value as "default" | "allow" | "deny")}
                        className={`rounded-lg border px-2 py-1 text-xs ${
                          st?.state === "allow"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : st?.state === "deny"
                              ? "border-red-200 bg-red-50 text-red-600"
                              : "border-slate-200 text-slate-600"
                        } disabled:opacity-50`}
                        title={m.role === "owner" ? "대표는 항상 허용" : undefined}
                      >
                        <option value="default">기본 ({st?.roleDefault ? "허용" : "차단"})</option>
                        <option value="allow">허용</option>
                        <option value="deny">차단</option>
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
