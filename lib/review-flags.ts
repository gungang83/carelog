// spec 021 확인 꼬리표 — 타입 정의(확장형). 항목이 늘면 여기 한 줄 추가.
export const REVIEW_FLAG_TYPES = [
  { id: "patient", label: "환자 확인", emoji: "👤" },
  { id: "participants", label: "참여자 확인", emoji: "🩺" },
  { id: "location", label: "장소·체어 확인", emoji: "🪑" },
  { id: "content", label: "내용 정확성", emoji: "📝" },
  { id: "other", label: "기타", emoji: "🏷️" },
] as const;

export type ReviewFlagType = (typeof REVIEW_FLAG_TYPES)[number]["id"];

const LABELS = new Map(REVIEW_FLAG_TYPES.map((t) => [t.id, t]));
export function flagMeta(type: string): { label: string; emoji: string } {
  return LABELS.get(type as ReviewFlagType) ?? { label: type, emoji: "🏷️" };
}

export type ReviewFlag = {
  id: string;
  consultation_id: string; // bigint을 문자열로 정규화(다른 상담 id 취급과 동일)
  type: string;
  note: string | null;
  status: "open" | "resolved";
  created_by: string | null;
  created_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
};
