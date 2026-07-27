// spec 029 — 분과(specialty) config. 새 분과 추가 = 여기 한 블록(+ 카테고리 세트).
// 기관 분과 = institutions.type. EO 연동 기관은 EO clinic_type에서 자동 매핑(sync-master).

export const SPECIALTIES = [
  { id: "dental", label: "치과", eoClinicTypes: ["dental_clinic", "dental"] },
  // 확장 예: { id: "derm", label: "피부과", eoClinicTypes: ["derm_clinic"] },
] as const;

export type SpecialtyId = (typeof SPECIALTIES)[number]["id"];

export function specialtyLabel(id: string | null): string {
  return SPECIALTIES.find((s) => s.id === id)?.label ?? "전 분과 공통";
}

/** EO clinic_type → Carelog 분과 매핑(모르면 null = 변경하지 않음). */
export function mapEoClinicType(clinicType: string | null): SpecialtyId | null {
  if (!clinicType) return null;
  const t = clinicType.toLowerCase();
  for (const s of SPECIALTIES) {
    if ((s.eoClinicTypes as readonly string[]).includes(t)) return s.id;
  }
  return null;
}

// ── Library 기본 분류(분과별 세트 + 전 분과 공용) — 자료의 category 필드 값 ──
export type AssetCategoryDef = { id: string; label: string };

export const COMMON_ASSET_CATEGORIES: AssetCategoryDef[] = [
  { id: "consent", label: "동의서" },
  { id: "general", label: "기타" },
];

export const SPECIALTY_ASSET_CATEGORIES: Record<string, AssetCategoryDef[]> = {
  dental: [
    { id: "implant", label: "임플란트" },
    { id: "endo", label: "신경치료" },
    { id: "prosth", label: "보철" },
    { id: "ortho", label: "교정" },
    { id: "perio", label: "치주" },
    { id: "prevent", label: "예방" },
    { id: "appliance", label: "장치" },
  ],
};

/** 해당 분과의 Library 분류 세트(분과 세트 + 공용). */
export function assetCategoriesFor(specialty: string | null): AssetCategoryDef[] {
  return [...(SPECIALTY_ASSET_CATEGORIES[specialty ?? ""] ?? []), ...COMMON_ASSET_CATEGORIES];
}
