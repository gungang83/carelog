// spec 042 — 케어로그 주소 한 곳에서. carelog.eo.ai.kr(EO 하위 도메인)로 옮기는 중.
//   실제 값은 Vercel 환경변수 NEXT_PUBLIC_SITE_URL. 비어 있으면 옛 주소(도메인 연결 확인 전까지 안전한 기본값).
//   ⚠️ 옛 주소는 끄지 않는다 — 이미 보낸 환자 문자 링크·설치한 앱·푸시 구독이 그 주소에 묶여 있다.

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

/** 옛 Vercel 주소 */
export const OLD_SITE_URL = "https://carelog-tau.vercel.app";
/** 옮겨 갈 새 주소(EO 하위 도메인) */
export const NEW_SITE_URL = "https://carelog.eo.ai.kr";

/** 바깥으로 내보내는 링크(환자 문자·가입·초대 메일)에 쓰는 케어로그 주소 — 끝 / 없음 */
export function siteUrl(): string {
  const env = stripBom(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  return (env || OLD_SITE_URL).replace(/\/+$/, "");
}

/** 지금 접속한 호스트가 정식 주소가 아닌 옛 Vercel 주소인가(정식 주소가 새 주소로 정해진 뒤에만 true) */
export function isOldHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const canonical = new URL(siteUrl()).host;
  return canonical !== new URL(OLD_SITE_URL).host && host === new URL(OLD_SITE_URL).host;
}

/** 새 주소가 열린 시각(인증서 발급 2026-11-27 14:47Z 직전) — 이 전에 만든 직원 푸시 구독은 옛 주소 것 */
export const SITE_MOVED_AT = "2026-11-27T14:40:00Z";

/** 지금 접속한 호스트가 정식(새) 주소인가 */
export function isCanonicalHost(host: string | null | undefined): boolean {
  return !!host && host === new URL(siteUrl()).host && !isOldHost(host);
}

/** 옛 주소 → 새 주소 넘기기에서 빼는 경로 — 환자 화면은 로그인(인증)이 주소별이라 옛 링크는 옛 주소에서 그대로 */
export const KEEP_ON_OLD_HOST = /^\/(api|p|portal)(\/|$)/;
