import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEoSession, NO_AUTO_COOKIE, VIA_EO_COOKIE } from "@/lib/eo/session-relay";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do not add logic between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/patient-callback") || // 환자 구글 로그인 복귀(spec 038 점검 중 발견 — 비로그인 환자가 직원 로그인으로 튕기던 문제)
    pathname.startsWith("/api/auth/sso") || // EO SSO 브릿지 — 자체 토큰 검증
    pathname.startsWith("/api/auth/eo-login") || // spec 043 EO로 로그인(EO 세션 → SSO 증명서)
    pathname.startsWith("/api/cron/") || // Vercel Cron(예: sync-master) — 라우트에서 CRON_SECRET 자체 검증
    pathname.startsWith("/present/") || // 체어 모니터 환자 안내 화면 — 로그인 불요(표시 전용)
    pathname.startsWith("/p/") ||
    pathname.startsWith("/portal/"); // 환자 포털 전체 — 각 페이지가 자체 세션 검증

  // spec 043 §7 — EO로 들어온 '개인' 로그인은 EO에서 로그아웃하면 함께 끝낸다(같이 쓰는 PC 보호).
  //   공용 계정(이메일·구글로 로그인)은 표시가 없어 건드리지 않는다. 네트워크 확인 없음 — 쿠키가 있는지만 본다.
  //   화면을 새로 열 때만(document GET). 화면 안 이동·미리 받기·저장·녹음 업로드(POST)·API·환자 화면은 그대로 둔다.
  const viaEo = request.cookies.get(VIA_EO_COOKIE)?.value;
  if (user && viaEo) {
    if (viaEo !== user.id) {
      supabaseResponse.cookies.delete(VIA_EO_COOKIE); // 다른 계정으로 바꿔 로그인함 → 표시 무효
    } else if (
      request.method === "GET" &&
      request.headers.get("sec-fetch-dest") === "document" && // 화면을 새로 열 때만(새로고침·새 탭·주소 입력) — 화면 안 이동·미리 받기·녹음 중엔 안 함
      !pathname.startsWith("/api/") &&
      !isPublicPath &&
      !hasEoSession(request.cookies.getAll())
    ) {
      await supabase.auth.signOut({ scope: "local" }); // 이 브라우저만(그 사람의 다른 기기는 그대로) — 세션 쿠키 삭제가 supabaseResponse에 실린다
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?eo=logged_out";
      const out = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((c) => out.cookies.set(c));
      out.cookies.delete(VIA_EO_COOKIE);
      out.cookies.set(NO_AUTO_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax", secure: url.protocol === "https:" });
      return out;
    }
  }

  // spec 043 — EO에 로그인돼 있으면(.eo.ai.kr 쿠키) 로그인 화면 없이 바로 EO로 로그인.
  //   첫 화면('/')·보호 화면만. 로그아웃 직후(NO_AUTO_COOKIE)는 제외 — 다시 자동으로 들어가지 않게.
  if (
    !user &&
    (pathname === "/" || !isPublicPath) &&
    !request.cookies.get(NO_AUTO_COOKIE) &&
    hasEoSession(request.cookies.getAll())
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/auth/eo-login";
    url.search = "";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    // Root → landing page; all other protected paths → login with redirect
    if (pathname === "/") {
      url.pathname = "/about";
      return NextResponse.redirect(url);
    }
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
