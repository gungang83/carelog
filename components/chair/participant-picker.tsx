"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { matchesQuery } from "@/lib/hangul";
import type { ClinicMemberRow, Participant } from "@/lib/types/database";

/**
 * 참여자 피커 — 26명 과부하 해소(spec 008 US2) + C-07 검색 매끄러움.
 * 입력 단계는 **실명 노출**(직원 내부 도구 — 동명 충돌·"어디 있어" 해소).
 * 마스킹은 저장된 기록의 환자 노출 맥락에서만 유지한다.
 * 구획: [나] · [최근] · [전체(진료/현장 먼저, 후순위 나중)].
 * 검색은 초성("ㄱㄷㅇ")·부분일치 모두 지원, 후순위까지 전체 도달.
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

type Section = { key: string; label: string; items: Participant[] };

export function ParticipantPicker({
  members,
  recent,
  me,
  value,
  onChange,
  compact,
}: {
  members: ClinicMemberRow[];
  recent: Participant[];
  me: Participant | null;
  value: Participant[];
  onChange: (next: Participant[]) => void;
  /** 접힌 모양 — 고른 사람 + [＋]만 보이고, 누르면 위로 작은 검색 창(최근 몇 명 + 검색 결과)이 열린다(상담보드) */
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fn = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", fn);
    return () => window.removeEventListener("pointerdown", fn);
  }, [open]);

  const isSelected = (name: string) => value.some((v) => v.name === name);

  const toggle = (p: Participant) => {
    onChange(
      isSelected(p.name)
        ? value.filter((v) => v.name !== p.name)
        : [...value, p],
    );
  };

  // 구획별 후보 구성. 이름 기준 dedup(나 → 최근 → 전체), 한 번 등장한 이름은 이후 구획에서 제외.
  const sections = useMemo<Section[]>(() => {
    const seen = new Set<string>();
    const take = (p: Participant | null | undefined): Participant | null => {
      if (!p?.name || seen.has(p.name)) return null;
      seen.add(p.name);
      return p;
    };

    const meItem = me ? take(me) : null;
    const recentItems = recent.map(take).filter(Boolean) as Participant[];

    const mapped = members.map<Participant>((m) => ({
      id: m.id,
      name: m.name,
      role: memberRole(m),
    }));
    const allItems = [
      ...mapped.filter((m) => !isDeprioritized(m.role)),
      ...mapped.filter((m) => isDeprioritized(m.role)),
    ]
      .map(take)
      .filter(Boolean) as Participant[];

    const out: Section[] = [];
    if (meItem) out.push({ key: "me", label: "나", items: [meItem] });
    if (recentItems.length)
      out.push({ key: "recent", label: "최근", items: recentItems });
    if (allItems.length)
      out.push({ key: "all", label: "전체", items: allItems });
    return out;
  }, [members, recent, me]);

  const q = query.trim();
  const filtered = useMemo<Section[]>(() => {
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (p) => !isSelected(p.name) && matchesQuery(p.name, q),
        ),
      }))
      .filter((s) => s.items.length > 0);
    // isSelected는 value 의존 — value 변경 시 재계산되도록 포함
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, q, value]);

  if (compact) {
    // 검색어가 없으면 나·최근만 몇 명, 있으면 전체에서 찾은 사람 — 26명을 한꺼번에 펼치지 않는다
    const quick = filtered.filter((s) => s.key !== "all").flatMap((s) => s.items);
    const pool = q ? filtered.flatMap((s) => s.items) : quick.length ? quick : filtered.flatMap((s) => s.items); // 최근이 없으면 앞쪽(진료 인원) 몇 명
    const shown = pool.slice(0, q ? 12 : 6);
    return (
      <div ref={boxRef} className="relative flex flex-wrap items-center gap-1.5">
        {value.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => toggle(p)}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2 py-1 text-xs font-semibold text-white"
            title="빼기"
          >
            {p.name}
            <span className="text-sky-100">×</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-7 items-center rounded-lg border border-dashed border-slate-300 px-2 text-xs font-semibold text-slate-500 transition hover:border-sky-300 hover:text-sky-700"
          aria-expanded={open}
        >
          ＋ 사람
        </button>
        {open && (
          <div className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xl">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름·초성 (예: ㄱㄷㅇ)"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
            />
            <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {shown.length === 0 ? (
                <p className="px-1 py-1 text-xs text-slate-400">{members.length === 0 ? "설정 → 멤버 관리에서 등록하세요." : q ? "검색 결과가 없어요." : "이름을 입력해 찾아요."}</p>
              ) : (
                shown.map((c) => (
                  <button
                    key={`${c.id}-${c.name}`}
                    type="button"
                    onClick={() => {
                      toggle(c);
                      setQuery("");
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                  >
                    {c.name}
                    {c.role ? <span className="text-slate-400"> · {c.role}</span> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 선택됨 (실명) */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => toggle(p)}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white"
            >
              {p.name}
              <span className="text-sky-100">×</span>
            </button>
          ))}
        </div>
      )}

      {/* 검색 (초성·부분일치) */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="이름·초성 검색 (예: 김도우 / ㄱㄷㅇ)"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
      />

      {/* 후보 — 구획별 (실명) */}
      <div className="flex max-h-44 flex-col gap-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-1 py-2 text-xs text-slate-400">
            {members.length === 0
              ? "설정 → 멤버 관리에서 등록하면 참여자를 선택할 수 있어요."
              : "검색 결과가 없어요."}
          </p>
        ) : (
          filtered.map((s) => (
            <div key={s.key} className="flex flex-col gap-1">
              <span className="px-0.5 text-[11px] font-semibold text-slate-400">
                {s.label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {s.items.map((c) => (
                  <button
                    key={`${c.id}-${c.name}`}
                    type="button"
                    onClick={() => toggle(c)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                  >
                    {c.name}
                    {c.role ? (
                      <span className="text-slate-400"> · {c.role}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
