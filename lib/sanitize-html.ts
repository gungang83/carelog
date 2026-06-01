/**
 * 서버에서 rich text HTML 저장 전 XSS 위험 요소 제거.
 * <script>, on* 이벤트, javascript: URL, data: URL을 차단하고
 * 에디터가 생성하는 안전한 태그(p, strong, em, ul 등)는 유지.
 */
export function sanitizeRichHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
    .replace(/(href|src|action)\s*=\s*["']?\s*javascript:/gi, '$1="#"')
    .replace(/(src)\s*=\s*["']?\s*data:/gi, 'src=""')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "");
}

/**
 * content가 이미 rich editor가 만든 HTML인지 대략 판별.
 * 체어 전사 텍스트는 평문(줄바꿈만 있는)이라 false.
 */
function looksLikeHtml(s: string): boolean {
  return /<\/?(p|br|div|ul|ol|li|h[1-6]|strong|em|b|i|u|s|blockquote|img|a|span|hr|pre|code)\b/i.test(s);
}

/**
 * 평문(줄바꿈 포함)을 안전한 HTML로 변환.
 * HTML 렌더(dangerouslySetInnerHTML)·Tiptap 에디터 양쪽에서 줄바꿈이 유지되도록
 * 빈 줄은 문단(<p>) 경계로, 단일 줄바꿈은 <br>로 변환한다.
 */
export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const blocks = escaped
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 0) return "";
  return blocks.map((b) => `<p>${b.replace(/\n/g, "<br>")}</p>`).join("");
}

/**
 * rich text 저장 정규화: 평문이면 HTML로 변환하고, 이미 HTML이면 그대로 둔다.
 * (체어 전사 평문의 줄바꿈 손실 방지)
 */
export function ensureHtml(content: string): string {
  if (!content) return "";
  return looksLikeHtml(content) ? content : plainTextToHtml(content);
}
