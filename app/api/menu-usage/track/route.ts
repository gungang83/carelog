import { NextResponse } from "next/server";
import { getSessionUser, getMyInstitutionId } from "@/lib/auth/institution";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { MENU_IDS } from "@/lib/usage/menu-config";

// spec 013 — 메뉴(화면) 진입 수집. 클라(sendBeacon)에서 { menuId }만 받고
//   institution·user·role은 세션에서 신뢰원으로 확인. 화이트리스트만 기록.
//   실패해도 조용히 204(UX 무방해). 진입당 1회 increment.

function kstToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export async function POST(req: Request) {
  const ok = new NextResponse(null, { status: 204 });

  const user = await getSessionUser();
  const email = user?.email ?? "";
  if (!email) return ok;

  let menuId = "";
  try {
    const body = await req.json();
    menuId = String(body?.menuId ?? "");
  } catch {
    return ok;
  }
  if (!menuId || !MENU_IDS.has(menuId)) return ok;

  try {
    const institutionId = await getMyInstitutionId();
    if (!institutionId) return ok;

    // 역할 스냅샷(활성 기관 기준)
    const supabase = await createServerSupabaseClient();
    const { data: member } = await supabase
      .from("institution_members")
      .select("role")
      .eq("user_id", user!.id)
      .eq("institution_id", institutionId)
      .maybeSingle();

    const admin = createAdminSupabaseClient();
    await admin.rpc("increment_menu_usage", {
      p_inst: institutionId,
      p_email: email,
      p_menu: menuId,
      p_day: kstToday(),
      p_role: (member?.role as string | null) ?? "staff",
    });
  } catch {
    /* 통계 실패 무시 */
  }
  return ok;
}
