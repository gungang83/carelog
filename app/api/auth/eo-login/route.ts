import { NextResponse, type NextRequest } from "next/server";
import { EO_APP_URL } from "@/lib/eo/app-url";
import { eoSessionCookieHeader, safeNextPath, SSO_NEXT_COOKIE } from "@/lib/eo/session-relay";

/**
 * spec 043 — "EO로 로그인". EO에 로그인돼 있으면 화면 없이 바로 케어로그 로그인.
 *   1) 브라우저가 보낸 EO 세션 쿠키(.eo.ai.kr)를 EO 기존 창구(POST /api/carelog/sso-token)에 그대로 건넴
 *   2) EO가 서명한 60초 증명서 → 기존 /api/auth/sso 가 검증·계정 연결·로그인(돌아갈 화면은 쿠키로)
 *   EO 로그인 안 됨·만료 → /login?eo=… (자동 반복 없음). EO 코드는 바꾸지 않는다.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  const back = (code: string) => NextResponse.redirect(`${origin}/login?eo=${code}${next !== "/" ? `&redirect=${encodeURIComponent(next)}` : ""}`);

  const cookie = eoSessionCookieHeader(req.cookies.getAll());
  if (!cookie) return back("signin"); // EO에 로그인 안 된 상태(또는 옛 주소 — 쿠키는 eo.ai.kr 하위에만 옴)

  let token = "";
  try {
    const res = await fetch(`${EO_APP_URL}/api/carelog/sso-token`, {
      method: "POST",
      headers: { cookie },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401) return back("signin");
    if (res.status === 403) return back("not_linked");
    if (res.status === 400) return back("no_workspace");
    if (!res.ok) {
      console.warn("[eo-login] EO sso-token status", res.status);
      return back("fail");
    }
    const d = (await res.json()) as { token?: string };
    token = d.token ?? "";
  } catch (e) {
    console.warn("[eo-login] EO sso-token error:", e instanceof Error ? e.message : "unknown");
    return back("fail");
  }
  if (!token) return back("fail");

  const out = NextResponse.redirect(`${origin}/api/auth/sso?token=${encodeURIComponent(token)}`);
  if (next !== "/") {
    out.cookies.set(SSO_NEXT_COOKIE, next, { path: "/", httpOnly: true, sameSite: "lax", secure: origin.startsWith("https"), maxAge: 300 });
  }
  return out;
}
