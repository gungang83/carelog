// spec 025 상담 이미지 라이브러리 — 타입 + 카테고리 config(확장형: 추가는 여기 한 줄).
export const CONSULT_ASSET_CATEGORIES = [
  { id: "implant", label: "임플란트" },
  { id: "endo", label: "신경치료" },
  { id: "prosth", label: "보철" },
  { id: "ortho", label: "교정" },
  { id: "perio", label: "치주" },
  { id: "prevent", label: "예방" },
  { id: "appliance", label: "장치" },
  { id: "general", label: "기타" },
] as const;

export type ConsultAssetCategory = (typeof CONSULT_ASSET_CATEGORIES)[number]["id"];

const CATEGORY_MAP = new Map(CONSULT_ASSET_CATEGORIES.map((c) => [c.id, c.label]));
export function categoryLabel(id: string): string {
  return CATEGORY_MAP.get(id as ConsultAssetCategory) ?? "기타";
}

export type ConsultAsset = {
  id: string;
  institution_id: string | null; // null = 전역(Carelog 제공, 후속)
  title: string;
  category: string;
  image_url: string;
  caption: string | null;
  display_order: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
};
