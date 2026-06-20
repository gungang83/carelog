/**
 * 기관 요금 등급(plan)에 따른 정책 — 음성 보존·재청취·감사의 단일 출처.
 * 정책 문서: docs/pricing-tiers.md. DB 단일 출처: institutions.plan.
 */
export type PlanTier = "free" | "standard" | "pro" | "enterprise";

export function normalizePlan(value: string | null | undefined): PlanTier {
  return value === "standard" || value === "pro" || value === "enterprise"
    ? value
    : "free";
}

/** free는 개수(롤링) 기준이라 보존일수 없음(null). */
export const FREE_ROLLING_MAX = 3;

export function retentionDays(plan: PlanTier): number | null {
  switch (plan) {
    case "standard":
      return 90;
    case "pro":
    case "enterprise":
      return 365;
    case "free":
    default:
      return null;
  }
}

/** Pro 이상은 재청취 감사로그를 남긴다. */
export function auditReplay(plan: PlanTier): boolean {
  return plan === "pro" || plan === "enterprise";
}

// ── 요금제 표시용 카탈로그(설정 화면) — docs/pricing-tiers.md를 미러링 ──────────
export const PLAN_ORDER: PlanTier[] = ["free", "standard", "pro", "enterprise"];

export type PlanMeta = {
  label: string;
  priceLabel: string;
  priceNote?: string;
  tagline: string;
};

export const PLAN_META: Record<PlanTier, PlanMeta> = {
  free: { label: "Free", priceLabel: "₩0", tagline: "한 명의 와우 — 부담 없이 시작" },
  standard: {
    label: "Standard",
    priceLabel: "₩39,000/월",
    priceNote: "도입가 ₩19,000",
    tagline: "병원의 상담~차팅을 실무로",
  },
  pro: { label: "Pro", priceLabel: "₩59,000/월", tagline: "상담 데이터를 경영·마케팅 자산으로" },
  enterprise: { label: "Enterprise", priceLabel: "문의", tagline: "다지점·맞춤" },
};

export type PlanFeature = { label: string; values: Record<PlanTier, string> };

/** 등급 비교 표 행(기능 × 등급). 정책 출처: docs/pricing-tiers.md. */
export const PLAN_FEATURES: PlanFeature[] = [
  { label: "상담보드 · 녹음 → AI 기록", values: { free: "✓", standard: "✓", pro: "✓", enterprise: "✓" } },
  { label: "전체 복사(덴트웹 붙여넣기)", values: { free: "✓", standard: "✓", pro: "✓", enterprise: "✓" } },
  { label: "다기기 실시간 알림 · 그림 주석", values: { free: "✓", standard: "✓", pro: "✓", enterprise: "✓" } },
  { label: "월 녹음·전사", values: { free: "30분", standard: "300분", pro: "1,000분", enterprise: "협의" } },
  { label: "음성 원본 보관", values: { free: "최근 3개", standard: "90일", pro: "1년+", enterprise: "협의" } },
  { label: "음성 재청취", values: { free: "최근 3개", standard: "직원", pro: "직원 + 감사", enterprise: "맞춤" } },
  { label: "환자 전달(포털)", values: { free: "제한", standard: "✓", pro: "✓ + 개인화", enterprise: "✓" } },
  { label: "상담 분석 · CRM", values: { free: "맛보기", standard: "일부", pro: "전체", enterprise: "✓" } },
  { label: "다지점", values: { free: "—", standard: "—", pro: "—", enterprise: "✓" } },
];
