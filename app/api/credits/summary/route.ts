import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/institution";
import { isSuperAdmin } from "@/lib/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { featureLabel } from "@/lib/credits";
import type { CreditLogRow } from "@/lib/types/database";

// spec 013 §B/C — 크레딧 사용량 집계 (슈퍼어드민 전용).
//   누가(created_by) · 얼마나(delta) · 어떤 기능(feature)에서 썼는지 상세 + 통계.
//   사용량 = 차감(delta<0)만 집계. 충전(grant)은 잔액에만 반영.

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSuperAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10) || 30, 1), 365);
  const instFilter = url.searchParams.get("institution") || "";
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const admin = createAdminSupabaseClient();

  let q = admin
    .from("credit_log")
    .select("id, institution_id, delta, feature, ref_id, balance_after, memo, created_by, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (instFilter) q = q.eq("institution_id", instFilter);
  const { data: logs } = await q;

  const { data: instRows } = await admin.from("institutions").select("id, name");
  const instNameMap = new Map<string, string>();
  for (const i of (instRows ?? []) as { id: string; name: string | null }[]) {
    instNameMap.set(i.id, i.name || i.id);
  }

  const { data: balRows } = await admin.from("institution_credits").select("institution_id, balance");

  const rows = (logs ?? []) as CreditLogRow[];

  let totalSpent = 0;
  let totalGranted = 0;
  const byFeature = new Map<string, { credits: number; count: number }>();
  const byInst = new Map<string, number>();
  const byUser = new Map<string, { email: string; credits: number; count: number }>();

  for (const r of rows) {
    if (r.delta < 0) {
      const spent = -r.delta;
      totalSpent += spent;

      const f = byFeature.get(r.feature) ?? { credits: 0, count: 0 };
      f.credits += spent;
      f.count += 1;
      byFeature.set(r.feature, f);

      byInst.set(r.institution_id, (byInst.get(r.institution_id) || 0) + spent);

      const uk = r.created_by || "(알 수 없음)";
      const u = byUser.get(uk) ?? { email: uk, credits: 0, count: 0 };
      u.credits += spent;
      u.count += 1;
      byUser.set(uk, u);
    } else {
      totalGranted += r.delta;
    }
  }

  const features = [...byFeature.entries()]
    .map(([feature, v]) => ({ feature, label: featureLabel(feature), credits: v.credits, count: v.count }))
    .sort((a, b) => b.credits - a.credits);

  const byInstitution = [...byInst.entries()]
    .map(([id, credits]) => ({ id, name: instNameMap.get(id) || id, credits }))
    .sort((a, b) => b.credits - a.credits);

  const topUsers = [...byUser.values()].sort((a, b) => b.credits - a.credits).slice(0, 20);

  const balances = ((balRows ?? []) as { institution_id: string; balance: number }[])
    .map((b) => ({ id: b.institution_id, name: instNameMap.get(b.institution_id) || b.institution_id, balance: b.balance }))
    .sort((a, b) => a.balance - b.balance);

  // 최근 사용 내역(상세) — 누가·언제·어떤 기능·얼마
  const recent = rows.slice(0, 50).map((r) => ({
    id: r.id,
    at: r.created_at,
    institution: instNameMap.get(r.institution_id) || r.institution_id,
    user: r.created_by || "—",
    feature: r.feature,
    label: featureLabel(r.feature),
    delta: r.delta,
    balance_after: r.balance_after,
    memo: r.memo,
  }));

  return NextResponse.json({
    days, since,
    scope: instFilter || "all",
    totalSpent, totalGranted,
    institutions: (instRows ?? [])
      .map((i) => ({ id: (i as { id: string }).id, name: (i as { name: string | null }).name || (i as { id: string }).id }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko")),
    features, byInstitution, topUsers, balances, recent,
  });
}
