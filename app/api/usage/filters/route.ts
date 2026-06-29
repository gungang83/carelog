import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/institution";
import { isSuperAdmin } from "@/lib/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// spec 013/015 — 사용량 대시보드 필터 옵션(슈퍼어드민 전용).
//   기관 전체 목록 + Carelog 사용자(이메일) 목록(사용량 데이터 기준) + 사용자별 소속 기관.
//   검색형 드롭다운이 한 번 로드해서 클라에서 필터링한다.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSuperAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminSupabaseClient();

  const [{ data: instRows }, { data: menuRows }, { data: creditRows }] = await Promise.all([
    admin.from("institutions").select("id, name"),
    admin.from("menu_usage_daily").select("user_email, institution_id").limit(20000),
    admin.from("credit_log").select("created_by, institution_id").limit(20000),
  ]);

  const nameMap = new Map<string, string>();
  for (const i of (instRows ?? []) as { id: string; name: string | null }[]) nameMap.set(i.id, i.name || i.id);

  // 사용자(이메일) → 소속 기관 이름 집합
  const userInst = new Map<string, Set<string>>();
  const add = (email: string | null, inst: string | null) => {
    if (!email) return;
    const s = userInst.get(email) ?? new Set<string>();
    if (inst) s.add(nameMap.get(inst) || inst);
    userInst.set(email, s);
  };
  for (const r of (menuRows ?? []) as { user_email: string; institution_id: string }[]) add(r.user_email, r.institution_id);
  for (const r of (creditRows ?? []) as { created_by: string | null; institution_id: string }[]) add(r.created_by, r.institution_id);

  const users = [...userInst.entries()]
    .map(([email, set]) => ({ email, institutions: [...set] }))
    .sort((a, b) => a.email.localeCompare(b.email));

  const institutions = (instRows ?? [])
    .map((i) => ({ id: (i as { id: string }).id, name: (i as { name: string | null }).name || (i as { id: string }).id }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return NextResponse.json({ institutions, users });
}
