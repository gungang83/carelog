/**
 * 리치 텍스트(HTML) → 평문 변환. 줄바꿈을 보존해 외부 EMR(덴트웹 등) 텍스트 칸에
 * 붙여넣기 좋은 형태로 만든다. ('전체 복사' 기능용)
 */
export function htmlToPlainText(html: string): string {
  if (!html) return "";

  let text = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, ""); // 남은 태그 제거(이미지 등 포함)

  // 기본 HTML 엔티티 디코드
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 과도한 빈 줄·행끝 공백 정리
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
