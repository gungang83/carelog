import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();

  let userId: string | null = null;
  let userEmail: string | null = null;

  if (tokenHash && type) {
    // SSO 경로: admin generateLink hashed_token → verifyOtp (PKCE 불필요)
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (!error && data.user) {
      userId = data.user.id;
      userEmail = data.user.email ?? null;
    } else {
      console.error("[callback] verifyOtp error:", error?.message);
    }
  } else if (code) {
    // 일반 로그인 경로: PKCE code exchange
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      userId = data.user.id;
      userEmail = data.user.email ?? null;
    } else {
      console.error("[callback] exchangeCodeForSession error:", error?.message);
    }
  }

  if (userId) {
    const { data: member } = await admin
      .from("institution_members")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!member) {
      // 멤버가 없을 때, 대기 중(미수락·미만료) 직원 초대가 있으면 수락 동선으로 보낸다.
      // (없을 때만 신규 워크스페이스 생성으로 — 초대받은 사람이 엉뚱한 워크스페이스를 만드는 트랩 방지)
      if (userEmail) {
        const { data: pendingInvite } = await admin
          .from("institution_invitations")
          .select("token")
          .ilike("email", userEmail)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingInvite?.token) {
          return NextResponse.redirect(`${origin}/invite/${pendingInvite.token}`);
        }
      }
      return NextResponse.redirect(`${origin}/onboarding`);
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
