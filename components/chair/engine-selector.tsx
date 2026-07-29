"use client";

import {
  LAB_ENGINE_OPTIONS,
  CREDIT_LOW_THRESHOLD,
  isPremiumMode,
  type EngineMode,
} from "@/lib/transcribe/engines";

/**
 * 녹음 엔진 선택 — 실험실 워크스페이스 전용. 히어로(녹음 시작 전)·보드(idle 폴백)
 * 공용. 라벨·컨트롤·설명을 같은 좌측 기준선에 맞춘 깔끔한 세그먼트 컨트롤.
 * 파란 히어로/흰 보드 어디서도 튀지 않도록 흰 배경 + 활성만 sky로 채운다.
 */
export function EngineSelector({
  engine,
  onChange,
  className = "",
  creditBalance,
}: {
  engine: EngineMode;
  onChange: (engine: EngineMode) => void;
  className?: string;
  /** spec 030 §3 — 잔액 전달 시 소진(≤0)이면 프리미엄 엔진 잠금 + 임박(≤임계) 안내 */
  creditBalance?: number;
}) {
  const selected = LAB_ENGINE_OPTIONS.find((o) => o.value === engine);
  const exhausted = creditBalance !== undefined && creditBalance <= 0;
  const low = creditBalance !== undefined && creditBalance > 0 && creditBalance <= CREDIT_LOW_THRESHOLD;
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
          // 소진 시 프리미엄 엔진 잠금(서버 게이트와 동일 기준 — UI는 안내, 서버가 권위)
          const locked = exhausted && isPremiumMode(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => !locked && onChange(o.value)}
              disabled={locked}
              title={
                locked
                  ? "크레딧이 소진되어 사용할 수 없어요 — 충전 후 이용해 주세요"
                  : `${o.desc} · ${o.credits} 크레딧`
              }
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-sky-600 bg-sky-600 text-white"
                  : locked
                    ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {locked && "🔒 "}
              {o.label}
              {/* spec 030 — 엔진별 크레딧 소모량 상시 표기 */}
              <span
                className={`rounded px-1 py-px text-[10px] font-semibold ${
                  active ? "bg-sky-500 text-sky-50" : "bg-slate-100 text-slate-400"
                }`}
              >
                {o.credits}
              </span>
            </button>
          );
        })}
      </div>
      {selected && (
        <p className="mt-2.5 text-xs text-slate-500">
          {selected.desc} · <span className="font-semibold">{selected.credits} 크레딧</span>
          {selected.value === "chunk" ? "" : "/회"}
        </p>
      )}
      {/* spec 030 §3 — 소진/임박 안내 */}
      {exhausted && (
        <p className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600">
          크레딧이 소진되었습니다 — 기본모델·빠른 메모·긴 상담은 계속 쓸 수 있고, 나머지 엔진은 충전 후
          이용할 수 있어요.
        </p>
      )}
      {low && (
        <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">
          크레딧 잔액 {creditBalance} — 곧 소진됩니다. 관리자에게 충전을 요청해 주세요.
        </p>
      )}
    </div>
  );
}
