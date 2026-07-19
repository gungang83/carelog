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
    id: "2026-07-08-plain-summary",
    date: "2026-07-08",
    emoji: "📝",
    title: "상담 기록 요약이 차트에 깔끔하게",
    items: [
      "요약에 섞여 있던 별표(**)·샵(#) 기호가 사라졌습니다 — 전자차트에 붙여넣어도 깔끔합니다.",
      "새 요약은 [진찰 소견]처럼 대괄호 라벨로 구조화되고, 이미 저장된 기록도 화면·복사에서 기호가 자동으로 걷힙니다.",
    ],
    internal: "세션 66",
  },
  {
    id: "2026-07-08-consult-assets",
    date: "2026-07-08",
    emoji: "📚",
    title: "상담 자료 라이브러리 + 편집기 업그레이드",
    items: [
      "자주 쓰는 설명 이미지를 설정 → 상담 자료에 등록해 두고, 상담 중 편집기의 '📚 자료' 버튼으로 바로 꺼내 쓸 수 있습니다.",
      "편집기가 커졌습니다 — 전체화면으로 크게 쓰고, 이미지를 글 옆에 배치(글감싸기)하거나 나란히 놓을 수 있습니다.",
    ],
    internal: "spec 025 · 세션 66",
  },
  {
    id: "2026-07-08-consult-stage",
    date: "2026-07-08",
    emoji: "🖊",
    title: "상담 스테이지 — 자료를 크게 열고 그리며 설명",
    items: [
      "상담 자료나 기록 속 이미지를 전체화면으로 크게 열고, 펜·마우스로 그려가며 설명한 뒤 '기록에 담기'를 누르면 그린 그대로 상담 기록에 남습니다.",
      "설명 영상은 링크로 등록해 두고 상담 기록에 넣어 환자에게 전달할 수 있습니다 — 대기실이나 집에서 볼 수 있어요.",
    ],
    internal: "spec 026 · 세션 66",
  },
  {
    id: "2026-07-08-estimate-builder",
    date: "2026-07-08",
    emoji: "₩",
    title: "치료비 견적 빌더",
    items: [
      "상담 편집기의 '₩ 견적' 버튼으로 치료 항목을 골라 수량·금액을 조정하면 합계까지 계산된 견적이 상담 기록에 깔끔하게 들어갑니다.",
      "자주 쓰는 치료 항목과 단가는 설정 → 치료 항목·수가에 미리 등록해 두세요.",
    ],
    internal: "spec 028 · 세션 66",
  },
  {
    id: "2026-07-08-blank-canvas",
    date: "2026-07-08",
    emoji: "🗒",
    title: "빈 캔버스 · 동의서 자료",
    items: [
      "'📚 자료'에서 백지·모눈·줄노트를 바로 열어 그림을 그려가며 설명하고 기록에 담을 수 있습니다.",
      "동의서 카테고리가 생겼습니다 — 동의서를 크게 열어 설명하고 화면에 펜으로 서명받아 상담 기록에 남겨보세요.",
    ],
    internal: "spec 026 P3-A · spec 028 확장 · 세션 66",
  },
  {
    id: "2026-07-08-recording-guard",
    date: "2026-07-08",
    emoji: "🔴",
    title: "녹음 상시 표시 + 방치 자동 저장",
    items: [
      "녹음 중엔 어느 화면에서든 '상담중(녹음중)' 표시가 떠 있고, 탭하면 상담 화면으로 바로 돌아갑니다. 데스크톱 크롬에선 '항상 위' 미니창으로 다른 프로그램 위에도 띄울 수 있어요.",
      "화면 조작도 대화 소리도 없이 방치되면 경고 후 자동으로 종료·저장됩니다 — 기준 시간은 설정 → 상담 안전망에서 조정하세요.",
      "편집기에 이 내용이 어느 체어의 상담 기록으로 저장되는지 안내가 표시됩니다.",
    ],
    internal: "spec 027 v1 · 세션 66",
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
