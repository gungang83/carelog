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
