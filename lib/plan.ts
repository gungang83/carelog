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
