// spec 022 공지·업데이트 — 타입 + 표시 톤(레벨) 정의. 확장형(레벨 추가 시 여기 한 줄).
export const ANNOUNCEMENT_LEVELS = [
  { id: "update", label: "업데이트", emoji: "✨" },
  { id: "notice", label: "공지", emoji: "📢" },
  { id: "info", label: "안내", emoji: "ℹ️" },
] as const;

export type AnnouncementLevel = (typeof ANNOUNCEMENT_LEVELS)[number]["id"];

const LEVELS = new Map(ANNOUNCEMENT_LEVELS.map((l) => [l.id, l]));
export function levelMeta(level: string): { label: string; emoji: string } {
  return LEVELS.get(level as AnnouncementLevel) ?? { label: "안내", emoji: "ℹ️" };
}

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  level: string;
  active: boolean;
  pinned: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
};
