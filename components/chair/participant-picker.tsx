"use client";

import { useMemo, useState } from "react";
import { maskName } from "@/lib/mask-name";
import type { ClinicMemberRow, Participant } from "@/lib/types/database";

/**
 * 참여자 피커 — 26명 과부하 해소(spec 008 US2).
 * 노출 순서: 선택됨 → 검색 → [나] → [최근] → [진료/현장] → [기타 후순위].
 * 검색은 후순위 항목까지 전체 도달. 미선택 허용. 표시는 maskName.
 */

// 명백한 비진료·노이즈 역할은 기본 노출에서 후순위로 내린다(숨김 아님 — 검색으로 도달).
const DEPRIORITIZE_ROLES = new Set(["대표", "owner", "한량"]);

function memberRole(m: ClinicMemberRow): string | null {
  return m.position || m.role || null;
}

function isDeprioritized(role: string | null): boolean {
  if (!role) return true;
  return DEPRIORITIZE_ROLES.has(role);
}

export function ParticipantPicker({
  members,
  recent,
  me,
  value,
  onChange,
}: {
  members: ClinicMemberRow[];
  recent: Participant[];
  me: Participant | null;
  value: Participant[];
  onChange: (next: Participant[]) => void;
}) {
  const [query, setQuery] = useState("");

  const isSelected = (name: string) => value.some((v) => v.name === name);

  const toggle = (p: Participant) => {
    onChange(
      isSelected(p.name)
        ? value.filter((v) => v.name !== p.name)
        : [...value, p],
    );
  };

  // 이름 기준 dedup 통합 후보(나 → 최근 → 멤버), 멤버는 진료/현장 먼저·후순위 나중.
  const candidates = useMemo<Participant[]>(() => {
    const seen = new Set<string>();
    const out: Participant[] = [];
    const push = (p: Participant) => {
      if (!p?.name || seen.has(p.name)) return;
      seen.add(p.name);
      out.push(p);
    };

    if (me) push(me);
    for (const r of recent) push(r);

    const mapped = members.map<Participant>((m) => ({
      id: m.id,
      name: m.name,
      role: memberRole(m),
    }));
    for (const m of mapped) if (!isDeprioritized(m.role)) push(m);
    for (const m of mapped) if (isDeprioritized(m.role)) push(m);

    return out;
  }, [members, recent, me]);

  const q = query.trim();
  const visible = q
    ? candidates.filter((c) => c.name.includes(q))
    : candidates;

  return (
    <div className="flex flex-col gap-2">
      {/* 선택됨 */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => toggle(p)}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white"
            >
              {maskName(p.name)}
              <span className="text-sky-100">×</span>
            </button>
          ))}
        </div>
      )}

      {/* 검색 */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="참여자 이름 검색…"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
      />

      {/* 후보 */}
      <div className="flex max-h-44 flex-wrap content-start gap-1.5 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-1 py-2 text-xs text-slate-400">
            {members.length === 0
              ? "설정 → 멤버 관리에서 등록하면 참여자를 선택할 수 있어요."
              : "검색 결과가 없어요."}
          </p>
        ) : (
          visible
            .filter((c) => !isSelected(c.name))
            .map((c) => (
              <button
                key={`${c.id}-${c.name}`}
                type="button"
                onClick={() => toggle(c)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
              >
                {maskName(c.name)}
                {c.role ? <span className="text-slate-400"> · {c.role}</span> : null}
              </button>
            ))
        )}
      </div>
    </div>
  );
}
