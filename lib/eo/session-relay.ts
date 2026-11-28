// spec 043 — EO 로그인으로 케어로그 들어오기(신뢰 관계 방식, EO 코드 변경 없음).
//   EO(Auth.js)는 로그인 쿠키를 .eo.ai.kr 전체에 둔다(EO #2681) → carelog.eo.ai.kr에도 브라우저가 함께 보낸다.
//   케어로그는 그 쿠키를 '읽지 않고'(풀 열쇠도 없음) EO의 기존 창구 POST /api/carelog/sso-token 에 그대로 건네
//   "이 사람 누구?"를 묻는다 → EO가 서명한 60초 증명서(JWT) → 기존 /api/auth/sso 가 검증·로그인.
//   ⚠️ 쿠키 값은 저장·기록(log)하지 않는다. EO 세션 쿠키 이름만 골라 EO 주소(EO_APP_URL)로만 보낸다.

/** Auth.js 세션 쿠키(운영: __Secure-authjs.session-token, 크면 .0 .1 조각) */
const EO_SESSION_COOKIE = /^(__Secure-)?(authjs|next-auth)\.session-token(\.\d+)?$/;

/** 로그아웃 직후 자동 로그인 막기(브라우저 닫으면 사라짐) */
export const NO_AUTO_COOKIE = "carelog_no_eo_auto";
/** EO로 로그인 후 돌아갈 화면(5분) */
export const SSO_NEXT_COOKIE = "carelog_sso_next";

type CookieLike = { name: string; value: string };

/** 요청 쿠키 중 EO 세션 쿠키만 "a=b; c=d" 로 */
export function eoSessionCookieHeader(all: CookieLike[]): string {
  return all
    .filter((c) => EO_SESSION_COOKIE.test(c.name))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

export function hasEoSession(all: CookieLike[]): boolean {
  return all.some((c) => EO_SESSION_COOKIE.test(c.name) && !!c.value);
}

/** 돌아갈 주소는 우리 사이트 안의 경로만("/records" O, "//evil.com"·"https://…" X) */
export function safeNextPath(v: string | null | undefined): string {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return "/";
  if (v.startsWith("/login") || v.startsWith("/api/")) return "/";
  return v.slice(0, 300);
}
