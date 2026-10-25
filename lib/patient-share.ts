// spec 038 — 환자용 상담 안내: 직원 기록을 항목으로 나눠 고르기(순수 함수 — 서버·브라우저 공용).
// 기록 본문은 [라벨] 구조(세션 66 상담 요약 평문화)를 따른다: "[주소(Chief Complaint)]" 다음 줄들이 그 항목.

export type RecordBlock = {
  id: string;
  label: string | null;
  lines: string[];
  /** 기본으로 고를지 — 요약 머리줄("…상담 기록 요약 - Carelog")만 빼 둔다 */
  defaultOn: boolean;
};

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** HTML → 줄 목록(문단·줄바꿈·목록 기준) */
export function htmlToLines(html: string): string[] {
  const text = (html || "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "");
  return decode(text)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const INTERNAL = /^\s*(이어서 상담|상세 요약 추가|통역)/;

/** 기록을 [라벨] 항목으로 나눈다. 라벨 없는 앞부분은 "기타"(머리줄 "…상담 기록 요약 - Carelog"는 제외 기본). */
export function splitRecordBlocks(html: string): RecordBlock[] {
  const blocks: RecordBlock[] = [];
  let cur: RecordBlock | null = null;
  htmlToLines(html).forEach((line, i) => {
    const m = /^\[([^\]]{1,40})\]\s*(.*)$/.exec(line);
    if (m && !/^\d+$/.test(m[1])) {
      // 내부 구분선([이어서 상담 — 시각 · 상담: 이름])은 이름·시각을 지우고 "이어서 상담"으로 — 그 아래 내용은 실제 상담이라 기본 선택
      const label = INTERNAL.test(m[1]) ? m[1].replace(/\s*[—-].*$/, "").trim() : m[1].trim();
      cur = { id: `b${i}`, label, lines: m[2] ? [m[2]] : [], defaultOn: true };
      blocks.push(cur);
      return;
    }
    if (!cur) {
      cur = { id: `b${i}`, label: null, lines: [], defaultOn: true };
      blocks.push(cur);
    }
    cur.lines.push(line);
  });
  // 요약 머리줄만 있는 블록은 기본 제외
  for (const b of blocks) {
    if (!b.label && b.lines.every((l) => /상담 기록 요약|Carelog/i.test(l))) b.defaultOn = false;
  }
  return blocks.filter((b) => b.label || b.lines.length);
}

/** 기록 속 그림(치아 그림·치간칫솔 차트·상담자료 등) 주소 */
export function recordImages(html: string): string[] {
  const out: string[] = [];
  const re = /<img[^>]+src="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html || ""))) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 고른 항목을 그대로 HTML로(초안 없이 보낼 때) — 라벨은 굵게 */
export function blocksToHtml(blocks: RecordBlock[]): string {
  return blocks
    .map((b) => {
      const head = b.label ? `<p><strong>${esc(b.label)}</strong></p>` : "";
      return head + b.lines.map((l) => `<p>${esc(l)}</p>`).join("");
    })
    .join("");
}

/** 고른 항목을 AI에 넘길 평문 */
export function blocksToText(blocks: RecordBlock[]): string {
  return blocks.map((b) => [b.label ? `[${b.label}]` : null, ...b.lines].filter(Boolean).join("\n")).join("\n\n");
}
