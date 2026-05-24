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
