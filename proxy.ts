import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isOldHost, KEEP_ON_OLD_HOST, siteUrl } from "@/lib/site-url";

export async function proxy(request: NextRequest) {
  // spec 042 2단계(2026-11-27 대표 "남은 것도 하자") — 옛 주소 → 새 주소 308. 기본 켜짐, 끄려면 CARELOG_REDIRECT_OLD_HOST=0.
  //   빼는 것: /api(EO SSO·서버 호출) · /p·/portal(환자 — 인증이 주소별이라 옛 링크는 옛 주소에서 그대로).
  //   sw.js·아이콘은 matcher 밖 → 옛 주소의 설치 앱·푸시도 계속 동작.
  if (
    process.env.CARELOG_REDIRECT_OLD_HOST !== "0" &&
    !KEEP_ON_OLD_HOST.test(request.nextUrl.pathname) &&
    isOldHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host"))
  ) {
    return NextResponse.redirect(`${siteUrl()}${request.nextUrl.pathname}${request.nextUrl.search}`, 308);
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|opengraph-image|icons/|sounds/|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav)$).*)",
  ],
};
