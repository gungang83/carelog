"use client";

import { useState, useTransition } from "react";
import { useChairContext } from "@/components/chair/chair-provider";
import { getOrCreateChairByName } from "@/app/actions/chairs";
import { maskName } from "@/lib/mask-name";
import type { ClinicMemberRow, Participant } from "@/lib/types/database";

/**
 * 홈 최상단 히어로 — 진료 기록의 진입점.
 *
 * Living Consult 톤(환자 모니터 /present 화면)을 직원 대시보드 입구로 변주했다.
 * "오늘 진료를 기록으로 남겨 환자에게 전달한다"는 제품 가치를 상단에 두고,
 * 체어를 고르면 바로 006 즉시기록 오버레이(openOverlay)를 연다.
 *
 * 기능은 기존 QuickRecordTrigger와 동일: 체어 칩 선택 또는 직접 입력 → openOverlay.
 */
export function ConsultHero({ members = [] }: { members?: ClinicMemberRow[] }) {
  const { chairs, openOverlay } = useChairContext();
  const [picking, setPicking] = useState(false);
  const [customName, setCustomName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const toggleMember = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // 선택한 멤버를 기록 시점 스냅샷으로 변환
  const buildParticipants = (): Participant[] =>
    members
      .filter((m) => selectedIds.includes(m.id))
      .map((m) => ({ id: m.id, name: m.name, role: m.role }));

  const resetPicking = () => {
    setPicking(false);
    setCustomName("");
    setSelectedIds([]);
    setError("");
  };

  const handlePickChair = (chairId: string) => {
    const participants = buildParticipants();
    resetPicking();
    openOverlay(chairId, participants);
  };

  const handleCustomSubmit = () => {
    if (!customName.trim()) return;
    setError("");
    const participants = buildParticipants();
    startTransition(async () => {
      const result = await getOrCreateChairByName(customName.trim());
      if (result.ok) {
        resetPicking();
        openOverlay(result.chairId, participants);
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-white p-7 shadow-sm sm:p-9">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sm font-bold text-sky-700">
          C
        </div>
        <span className="text-base font-semibold text-slate-900">Carelog</span>
      </div>

      <h1 className="mt-5 text-2xl font-bold leading-snug tracking-tight text-slate-900 break-keep sm:text-[1.85rem]">
        오늘 진료, 기록으로 남겨서{" "}
        <span className="text-sky-600">환자에게 전달해요</span>
      </h1>
      <p className="mt-2.5 max-w-md text-[15px] leading-relaxed text-slate-500 break-keep">
        체어를 고르면 바로 상담을 기록합니다. 녹음 내용은 AI가 정리해
        드리고, 검토 후 환자에게 진료기록으로 보낼 수 있어요.
      </p>

      {!picking ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-sky-600 px-6 py-4 text-base font-semibold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-700 active:scale-[0.99] sm:w-auto"
        >
          <MicIcon className="size-5 shrink-0" />
          상담 기록 시작
        </button>
      ) : (
        <div className="mt-6 rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">
              참여자와 체어를 선택하세요
            </p>
            <button
              type="button"
              onClick={resetPicking}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              aria-label="취소"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          {/* 참여자 (선택) */}
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-slate-500">
              참여자 <span className="text-slate-400">(선택)</span>
            </p>
            {members.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const active = selectedIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMember(m.id)}
                      className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-sky-600 text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {maskName(m.name)}
                      {m.role ? (
                        <span
                          className={active ? "text-sky-100" : "text-slate-400"}
                        >
                          {" · "}
                          {m.role}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                설정 → 멤버 관리에서 등록하면 참여자를 선택할 수 있어요.
              </p>
            )}
          </div>

          <p className="mb-2 text-xs font-medium text-slate-500">체어</p>
          {chairs.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {chairs.map((chair) => (
                <button
                  key={chair.id}
                  type="button"
                  onClick={() => handlePickChair(chair.id)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                >
                  {chair.name}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs text-slate-500">직접 입력</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="위치 이름 (예: 1번 체어, 원장실)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCustomSubmit();
                }}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
                autoFocus={chairs.length === 0}
              />
              <button
                type="button"
                onClick={handleCustomSubmit}
                disabled={isPending || !customName.trim()}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
              >
                {isPending ? "…" : "선택"}
              </button>
            </div>
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V4Z" />
      <path
        fillRule="evenodd"
        d="M5.5 10.5a.75.75 0 0 0-1.5 0 6 6 0 0 0 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.046A6 6 0 0 0 15.5 10.5a.75.75 0 0 0-1.5 0 4.5 4.5 0 0 1-9 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}
