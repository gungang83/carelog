import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/institution";
import { isSuperAdmin } from "@/lib/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { MENU_ITEMS, menuLabel } from "@/lib/usage/menu-config";
import { resolveRange } from "@/lib/usage/range";

// spec 013 §A — 메뉴(화면) 사용량 집계 (슈퍼어드민 전용).
//   전체(모든 기관) 또는 특정 기관. 다각도: 총합 · 기관별 · 메뉴별(역할분해) · 미사용.

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSuperAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const range = resolveRange(url.searchParams);
  const instFilter = url.searchParams.get("institution") || "";
  const userFilter = url.searchParams.get("user") || "";

  const admin = createAdminSupabaseClient();

  let q = admin
    .from("menu_usage_daily")
    .select("menu_id, role_snap, user_email, institution_id, count")
    .gte("day", range.dateFrom)
    .lte("day", range.dateTo);
  if (instFilter) q = q.eq("institution_id", instFilter);
  if (userFilter) q = q.eq("user_email", userFilter);
  const { data: rows } = await q;

  const { data: instRows } = await admin.from("institutions").select("id, name");
  const instNameMap = new Map<string, string>();
  for (const i of (instRows ?? []) as { id: string; name: string | null }[]) {
    instNameMap.set(i.id, i.name || i.id);
  }

  const byMenu = new Map<string, { total: number; byRole: Record<string, number> }>();
  const byInst = new Map<string, number>();
  const userSet = new Set<string>();
  let total = 0;

  for (const r of (rows ?? []) as {
    menu_id: string; role_snap: string | null; user_email: string; institution_id: string; count: number;
  }[]) {
    const c = r.count ?? 0;
    total += c;
    userSet.add(`${r.institution_id}::${r.user_email}`);

    const m = byMenu.get(r.menu_id) ?? { total: 0, byRole: {} };
    m.total += c;
    const rk = r.role_snap || "기타";
    m.byRole[rk] = (m.byRole[rk] || 0) + c;
    byMenu.set(r.menu_id, m);

    byInst.set(r.institution_id, (byInst.get(r.institution_id) || 0) + c);
  }

  const menus = [...byMenu.entries()]
    .map(([id, v]) => ({ id, label: menuLabel(id), total: v.total, byRole: v.byRole }))
    .sort((a, b) => b.total - a.total);

  const usedIds = new Set(byMenu.keys());
  const unused = MENU_ITEMS.filter((m) => !usedIds.has(m.id)).map((m) => ({ id: m.id, label: m.label }));

  const byInstitution = [...byInst.entries()]
    .map(([id, t]) => ({ id, name: instNameMap.get(id) || id, total: t }))
    .sort((a, b) => b.total - a.total);

  const institutions = (instRows ?? [])
    .map((i) => ({ id: (i as { id: string }).id, name: (i as { name: string | null }).name || (i as { id: string }).id }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return NextResponse.json({
    days: range.days, dateFrom: range.dateFrom, dateTo: range.dateTo, total,
    activeUsers: userSet.size,
    scope: instFilter || "all",
    user: userFilter || null,
    institutions, byInstitution, menus, unused,
  });
}
