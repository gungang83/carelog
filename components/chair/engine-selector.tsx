"use client";

import { LAB_ENGINE_OPTIONS, type EngineMode } from "@/lib/transcribe/engines";

/**
 * 녹음 엔진 선택 — 실험실 워크스페이스 전용. 히어로(녹음 시작 전)·보드(idle 폴백)
 * 공용. 라벨·컨트롤·설명을 같은 좌측 기준선에 맞춘 깔끔한 세그먼트 컨트롤.
 * 파란 히어로/흰 보드 어디서도 튀지 않도록 흰 배경 + 활성만 sky로 채운다.
 */
export function EngineSelector({
  engine,
  onChange,
  className = "",
}: {
  engine: EngineMode;
  onChange: (engine: EngineMode) => void;
  className?: string;
}) {
  const desc = LAB_ENGINE_OPTIONS.find((o) => o.value === engine)?.desc;
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">녹음 엔진</span>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
          실험실
        </span>
      </div>
      <div className="mt-2.5 inline-flex divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {LAB_ENGINE_OPTIONS.map((o) => {
          const active = engine === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              title={o.desc}
              aria-pressed={active}
              className={`px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-sky-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {desc && <p className="mt-2.5 text-xs text-slate-500">{desc}</p>}
    </div>
  );
}
