import {
  PLAN_ORDER,
  PLAN_META,
  PLAN_FEATURES,
  type PlanTier,
} from "@/lib/plan";

/**
 * 요금제 섹션(설정 화면) — 현재 플랜 + 전체 등급 비교 + 기대감.
 * 표시 전용(결제·업그레이드는 향후). 단일 출처: lib/plan.ts / docs/pricing-tiers.md.
 */
export function PlanSection({ currentPlan }: { currentPlan: PlanTier }) {
  const meta = PLAN_META[currentPlan];

  return (
    <div className="space-y-4">
      {/* 현재 플랜 배너 */}
      <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
        <p className="text-xs font-medium text-sky-700">현재 이용 중인 플랜</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">
          {meta.label}
          <span className="ml-2 text-sm font-medium text-sky-700">{meta.priceLabel}</span>
        </p>
        <p className="mt-1 text-sm text-slate-600 break-keep">{meta.tagline}</p>
      </div>

      {/* 등급 비교 표 */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="p-3 text-left text-xs font-medium text-slate-400">기능</th>
              {PLAN_ORDER.map((p) => {
                const m = PLAN_META[p];
                const current = p === currentPlan;
                return (
                  <th
                    key={p}
                    className={`p-3 text-center align-top ${current ? "bg-sky-50" : ""}`}
                  >
                    <div className="text-sm font-bold text-slate-800">{m.label}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {m.priceLabel}
                      {m.priceNote ? <span className="block text-sky-600">{m.priceNote}</span> : null}
                    </div>
                    {current && (
                      <div className="mt-1.5 inline-block rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        현재 이용 중
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {PLAN_FEATURES.map((f) => (
              <tr key={f.label} className="border-b border-slate-50 last:border-0">
                <td className="p-3 text-slate-600">{f.label}</td>
                {PLAN_ORDER.map((p) => (
                  <td
                    key={p}
                    className={`p-3 text-center ${
                      p === currentPlan
                        ? "bg-sky-50/60 font-semibold text-sky-800"
                        : "text-slate-600"
                    }`}
                  >
                    {f.values[p]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 기대감 + (준비 중) 업그레이드 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">곧 더 많은 게 열려요 ✨</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600 break-keep">
          음성 원본 장기 보관, 상담 분석·CRM, 다지점 관리까지 — 상위 플랜에서 차례로
          만나보실 수 있어요. 결제·업그레이드 신청은 준비 중이며, 먼저 써보고 싶은
          기능이 있으면 알려주세요.
        </p>
        {currentPlan !== "enterprise" && (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
            업그레이드 신청 — 곧 열려요
          </span>
        )}
      </div>
    </div>
  );
}
