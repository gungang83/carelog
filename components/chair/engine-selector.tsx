"use client";

import { LAB_ENGINE_OPTIONS, type EngineMode } from "@/lib/transcribe/engines";

/**
 * 녹음 엔진 선택 — 실험실 워크스페이스 전용. 히어로(녹음 시작 전)·보드(idle 폴백)
 * 공용. 파란 히어로/흰 보드 어디에 놓여도 튀지 않도록 중립 슬레이트 톤의
 * 세그먼트 컨트롤로 통일하고, 실험실 정체성은 작은 핀 하나로만 남긴다.
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
        <span className="text-xs font-semibold text-slate-700">녹음 엔진</span>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
          실험실
        </span>
      </div>
      <div className="mt-2 inline-flex rounded-xl bg-slate-100 p-1">
        {LAB_ENGINE_OPTIONS.map((o) => {
          const active = engine === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              title={o.desc}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {desc && <p className="mt-2 text-xs text-slate-500">{desc}</p>}
    </div>
  );
}
