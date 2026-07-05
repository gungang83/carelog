// spec 023 업데이트 피드 — 슈퍼어드민(대표)만 보는 업데이트 내역 저장소.
// 다온이 세션 마무리 때 "사용자에게 보이는 변경"을 엔트리로 추가(append) → 배포와 함께 쌓인다.
// 대표가 /admin/updates에서 보고 취사선택해 공지로 발행하거나 보류한다.
// ⚠️ 문구는 사용자(직원)에게 그대로 나갈 수 있으므로 항상 사용자 톤 + 용어 규칙("상담 기록") 준수.

export type UpdateFeedEntry = {
  id: string; // 고유·불변 (예: "2026-07-05-spec022") — DB 결정 상태의 키
  date: string; // YYYY-MM-DD (배포/완료일)
  emoji?: string; // 공지 본문에 쓸 아이콘 (기본 ✨)
  title: string; // 사용자 문구 한 줄 (공지 제목 조합에 사용)
  items: string[]; // 사용자 문구 상세 (공지 본문 조합에 사용)
  internal?: string; // 내부 참고(스펙·세션 번호) — 피드 화면에서만 보임
};

// ── 피드 (오래된 것 → 최신, 아래에 append) ─────────────────────────────
export const UPDATE_FEED: UpdateFeedEntry[] = [
  {
    id: "2026-07-05-records-card",
    date: "2026-07-05",
    emoji: "🗂",
    title: "기록 화면 카드 개선",
    items: [
      "'기록' 화면의 상담 카드가 홈과 완전히 같아졌습니다.",
      "전체 복사·음성 듣기·편집·삭제·환자 연결을 기록 화면에서 바로 처리할 수 있습니다.",
    ],
    internal: "spec 021 · 세션 62",
  },
  {
    id: "2026-07-05-review-flags",
    date: "2026-07-05",
    emoji: "🏷",
    title: "'확인 필요' 꼬리표",
    items: [
      "상담 기록을 차트에 옮기기 전 확인할 항목(환자·참여자·장소·내용 등)을 카드에 달 수 있습니다.",
      "'기록' 화면에서 '확인 필요만' 필터로 모아볼 수 있습니다.",
    ],
    internal: "spec 021 · 세션 62",
  },
  {
    id: "2026-07-05-record-pause",
    date: "2026-07-05",
    emoji: "⏸️",
    title: "녹음 일시정지/재개",
    items: [
      "상담 중 자리를 비울 때 녹음을 잠시 멈췄다가 이어서 녹음할 수 있습니다.",
      "상담보드·체어 녹음 바의 '일시정지' 버튼을 눌러보세요.",
    ],
    internal: "세션 63",
  },
  {
    id: "2026-07-05-announce-ticker",
    date: "2026-07-05",
    emoji: "📢",
    title: "공지·업데이트 티커",
    items: [
      "홈 상단에 새 소식이 한 줄로 흐릅니다.",
      "'전체보기'에서 지난 공지도 확인할 수 있습니다.",
    ],
    internal: "spec 022 · 세션 64",
  },
];

// ── 결정 상태 (DB update_feed_decisions) ──────────────────────────────
export type UpdateFeedDecisionStatus = "published" | "dismissed";

export type UpdateFeedDecision = {
  entry_id: string;
  status: UpdateFeedDecisionStatus;
  announcement_id: string | null;
  decided_at: string;
};

export type UpdateFeedItem = UpdateFeedEntry & {
  decision: UpdateFeedDecision | null;
};

// ── 공지 문구 자동 조합 (선택 엔트리 → 제목/본문 초안, 발행 전 수정 가능) ──
export function composeAnnouncementDraft(entries: UpdateFeedEntry[]): {
  title: string;
  body: string;
} {
  const latest = entries[entries.length - 1]?.date ?? "";
  const [, m, d] = latest.split("-");
  const dateLabel = m && d ? `${Number(m)}/${Number(d)}` : "";
  const title = `${dateLabel} 업데이트 — ${entries.map((e) => e.title).join(", ")}`;
  const body =
    "이번 업데이트 내용을 안내드립니다.\n\n" +
    entries
      .map((e) => `${e.emoji ?? "✨"} ${e.title} — ${e.items.join(" ")}`)
      .join("\n\n");
  return { title, body };
}
