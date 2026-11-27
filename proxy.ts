import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isOldHost, siteUrl } from "@/lib/site-url";

export async function proxy(request: NextRequest) {
  // spec 042 2단계 — 옛 주소 → 새 주소 넘기기. 대표 결정 후 Vercel 환경변수 CARELOG_REDIRECT_OLD_HOST=1 로 켠다(기본 꺼짐).
  //   /api 는 넘기지 않음(EO SSO·서버 호출). sw.js·아이콘은 matcher 밖이라 옛 주소 앱·푸시도 그대로 동작.
  if (
    process.env.CARELOG_REDIRECT_OLD_HOST === "1" &&
    !request.nextUrl.pathname.startsWith("/api/") &&
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
