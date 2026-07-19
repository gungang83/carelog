// 상담 기록 본문 표시 파이프라인(세션 66) — 마크다운 마커 제거 + URL 링크화 + 이미지 최적화.
// 카드·환자 상세·환자 포털의 dangerouslySetInnerHTML 앞단 공용 진입점.
import { stripMarkdownMarkers } from "@/lib/summary-format";
import { optimizeContentHtml } from "@/lib/image/optimize";

/** 본문 텍스트의 맨 URL을 클릭 가능한 링크로(spec 026 영상 링크 전달용).
 *  따옴표/= 뒤(태그 속성 안)의 URL은 건드리지 않는다. */
export function linkifyUrls(html: string): string {
  if (!html) return html;
  return html.replace(
    /(^|[^"'=>\w])(https?:\/\/[^\s<"']+)/g,
    (_m, pre: string, url: string) =>
      `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#0284c7;text-decoration:underline">${url}</a>`,
  );
}

/** 표시용 본문 HTML 준비: 마크다운 마커 제거 → URL 링크화 → 이미지 변환·lazy. */
export function renderContentHtml(html: string): string {
  return optimizeContentHtml(linkifyUrls(stripMarkdownMarkers(html)));
}
