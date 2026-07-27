// spec 029 — 기능 권한 config (EO permissions.ts 모델 이식).
// 판정 = 개인 오버라이드(permission_overrides) > 역할 기본값(여기 코드).
// 키 추가 = FEATURES + FEATURE_META + DEFAULT_ROLE_FEATURES에 한 줄씩.

export const FEATURES = {
  CONSULT_ASSETS_MANAGE: "consult_assets.manage", // 상담자료 관리(Library·카테고리 구성)
  TREATMENT_ITEMS_MANAGE: "treatment_items.manage", // 치료 항목·수가 관리(견적 프리셋)
} as const;

export type FeatureId = (typeof FEATURES)[keyof typeof FEATURES];

export const FEATURE_META: { id: FeatureId; label: string; desc: string }[] = [
  {
    id: FEATURES.CONSULT_ASSETS_MANAGE,
    label: "상담자료 관리",
    desc: "상담 자료 업로드·카테고리 구성(설정 → 상담 자료)",
  },
  {
    id: FEATURES.TREATMENT_ITEMS_MANAGE,
    label: "치료 항목·수가 관리",
    desc: "견적 빌더 프리셋 관리(설정 → 치료 항목·수가)",
  },
];

export type MemberRole = "owner" | "admin" | "staff";

export const DEFAULT_ROLE_FEATURES: Record<MemberRole, FeatureId[]> = {
  owner: [FEATURES.CONSULT_ASSETS_MANAGE, FEATURES.TREATMENT_ITEMS_MANAGE],
  admin: [FEATURES.CONSULT_ASSETS_MANAGE, FEATURES.TREATMENT_ITEMS_MANAGE],
  staff: [],
};

export function roleHasFeature(role: string, featureId: FeatureId): boolean {
  return (DEFAULT_ROLE_FEATURES[role as MemberRole] ?? []).includes(featureId);
}
