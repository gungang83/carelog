import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/portal/login?error=auth_failed`);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/portal/login?error=auth_failed`);
  }

  const authUserId = data.user.id;
  const admin = createAdminSupabaseClient();
  const cookieStore = await cookies();
  const pendingAccountId = cookieStore.get("pending_patient_account_id")?.value;

  if (pendingAccountId) {
    // 신규 가입: OTP 세션에서 넘어온 patient_account_id와 연결
    await Promise.resolve(
      admin
        .from("patient_auth_links")
        .insert({ auth_user_id: authUserId, patient_account_id: pendingAccountId, provider: "google" }),
    ).catch(() => null); // ON CONFLICT DO NOTHING — UNIQUE 제약으로 중복 무시됨

    cookieStore.delete("pending_patient_account_id");
    return NextResponse.redirect(`${origin}/portal/records`);
  }

  // 재로그인: 기존 patient_auth_links 조회
  const { data: link } = await admin
    .from("patient_auth_links")
    .select("patient_account_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (link) {
    return NextResponse.redirect(`${origin}/portal/records`);
  }

  // 연결된 계정 없음 → 계정 연결 안내
  return NextResponse.redirect(`${origin}/portal/link-account`);
}
