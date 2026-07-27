// spec 025 상담 이미지 라이브러리 — 타입 + Library 기본 분류.
// spec 029: 분류 세트는 분과별 config(lib/specialties.ts)로 이동 — 여기선 치과 세트 기준 재노출(호환).
import { assetCategoriesFor, SPECIALTY_ASSET_CATEGORIES, COMMON_ASSET_CATEGORIES } from "@/lib/specialties";

export const CONSULT_ASSET_CATEGORIES = assetCategoriesFor("dental");

const CATEGORY_MAP = new Map(
  [...Object.values(SPECIALTY_ASSET_CATEGORIES).flat(), ...COMMON_ASSET_CATEGORIES].map((c) => [c.id, c.label]),
);
export function categoryLabel(id: string): string {
  return CATEGORY_MAP.get(id) ?? "기타";
}

export type ConsultAssetKind = "image" | "video_link";

export type ConsultAsset = {
  id: string;
  institution_id: string | null; // null = 전역(Carelog 제공)
  specialty?: string | null; // 전역 자료 분과 타겟(null=전 분과 공통) — spec 029
  kind: ConsultAssetKind; // image | video_link(외부 영상 링크, spec 026)
  title: string;
  category: string;
  image_url: string | null; // image 필수 / video_link는 null 가능
  link_url: string | null; // video_link 필수
  caption: string | null;
  display_order: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
};

// ── spec 029 큐레이션 — 기관 카테고리(그릇) + 담긴 자료 ──────────────
export type AssetCategory = {
  id: string;
  institution_id: string;
  name: string;
  display_order: number;
  active: boolean;
  created_at: string;
};

export type CategoryWithAssets = AssetCategory & {
  items: { itemId: string; asset: ConsultAsset }[]; // 담긴 순서대로
};

/** 픽커 데이터 — 기관이 구성한 카테고리 + Library(우리 기관/전역) */
export type PickerData = {
  categories: CategoryWithAssets[]; // active 카테고리만, 없으면 [] (Library 폴백)
  mine: ConsultAsset[];
  global: ConsultAsset[];
};
