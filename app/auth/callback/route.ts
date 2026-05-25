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

  if (tokenHash && type) {
    // SSO 경로: admin generateLink hashed_token → verifyOtp (PKCE 불필요)
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (!error && data.user) {
      userId = data.user.id;
    } else {
      console.error("[callback] verifyOtp error:", error?.message);
    }
  } else if (code) {
    // 일반 로그인 경로: PKCE code exchange
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      userId = data.user.id;
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
      return NextResponse.redirect(`${origin}/onboarding`);
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
