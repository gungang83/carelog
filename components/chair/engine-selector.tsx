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
      {/* 모드가 늘어 가로 1줄을 넘으므로 줄바꿈되는 pill 형태로(모바일 안전). */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {LAB_ENGINE_OPTIONS.map((o) => {
          const active = engine === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              title={o.desc}
              aria-pressed={active}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-sky-600 bg-sky-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
