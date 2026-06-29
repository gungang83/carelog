// spec 014 — 일일 사용 리포트 생성기(서버). cron(발행)·리포트 페이지(열람)가 공용.
//   scope='all'(전체·슈퍼어드민) | institution_id(운영자, 자기 워크스페이스) 둘 다 지원.
//   하루 = KST 0~24시. menu_usage_daily(이미 KST 일자) + credit_log(timestamptz, KST 경계 집계).
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { featureLabel } from "@/lib/credits";
import { menuLabel } from "@/lib/usage/menu-config";

export interface DailyReport {
  date: string; // YYYY-MM-DD (KST)
  scope: string; // 'all' | institution_id
  summary: {
    workspaces: number;
    menuTotal: number;
    activeUsers: number;
    creditTotal: number;
    transcribeCount: number;
    tokensIn: number;
    tokensOut: number;
  };
  prev: { menuTotal: number; creditTotal: number } | null;
  byWorkspace: {
    id: string; name: string; menu: number; activeUsers: number;
    credit: number; transcribeCount: number; balance: number;
  }[];
  byFeature: { feature: string; label: string; credits: number; count: number; tokensIn: number; tokensOut: number }[];
  byMenu: { id: string; label: string; total: number; byRole: Record<string, number> }[];
  topUsers: { user: string; credit: number; count: number; tokensIn: number; tokensOut: number }[];
  alerts: { level: "warn" | "info"; text: string }[];
}

/** KST 일자(YYYY-MM-DD) → 해당 하루의 UTC 경계 [start, end). */
function kstDayRangeUtc(date: string): { startIso: string; endIso: string } {
  const start = new Date(`${date}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** KST 기준 며칠 전/후 일자 문자열. */
export function shiftKstDate(date: string, deltaDays: number): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  d.setTime(d.getTime() + deltaDays * 24 * 3600 * 1000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/** 오늘(KST) 일자 문자열. */
export function kstToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

const LOW_BALANCE = 50; // 잔액 임박 경고 임계치(크레딧)

export async function buildDailyReport(opts: { date: string; scope?: string }): Promise<DailyReport> {
  const date = opts.date;
  const scope = opts.scope ?? "all";
  const instFilter = scope === "all" ? null : scope;
  const admin = createAdminSupabaseClient();
  const { startIso, endIso } = kstDayRangeUtc(date);

  // 기관 이름·잔액
  const [{ data: instRows }, { data: balRows }] = await Promise.all([
    admin.from("institutions").select("id, name"),
    admin.from("institution_credits").select("institution_id, balance"),
  ]);
  const nameMap = new Map<string, string>();
  for (const i of (instRows ?? []) as { id: string; name: string | null }[]) nameMap.set(i.id, i.name || i.id);
  const balMap = new Map<string, number>();
  for (const b of (balRows ?? []) as { institution_id: string; balance: number }[]) balMap.set(b.institution_id, b.balance);

  // 메뉴 진입(당일)
  let mq = admin.from("menu_usage_daily").select("institution_id, user_email, menu_id, role_snap, count").eq("day", date);
  if (instFilter) mq = mq.eq("institution_id", instFilter);
  const { data: menuRows } = await mq;

  // 크레딧 로그(당일, 차감만 사용량으로 집계)
  let cq = admin
    .from("credit_log")
    .select("institution_id, created_by, feature, delta, tokens_in, tokens_out")
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  if (instFilter) cq = cq.eq("institution_id", instFilter);
  const { data: creditRows } = await cq;

  // ── 메뉴 집계 ──
  const byMenu = new Map<string, { total: number; byRole: Record<string, number> }>();
  const wsMenu = new Map<string, number>();
  const wsUsers = new Map<string, Set<string>>();
  const allUsers = new Set<string>();
  let menuTotal = 0;
  for (const r of (menuRows ?? []) as {
    institution_id: string; user_email: string; menu_id: string; role_snap: string | null; count: number;
  }[]) {
    const c = r.count ?? 0;
    menuTotal += c;
    const m = byMenu.get(r.menu_id) ?? { total: 0, byRole: {} };
    m.total += c;
    const rk = r.role_snap || "기타";
    m.byRole[rk] = (m.byRole[rk] || 0) + c;
    byMenu.set(r.menu_id, m);
    wsMenu.set(r.institution_id, (wsMenu.get(r.institution_id) || 0) + c);
    const us = wsUsers.get(r.institution_id) ?? new Set<string>();
    us.add(r.user_email);
    wsUsers.set(r.institution_id, us);
    allUsers.add(`${r.institution_id}::${r.user_email}`);
  }

  // ── 크레딧 집계 ──
  const byFeature = new Map<string, { credits: number; count: number; tokensIn: number; tokensOut: number }>();
  const wsCredit = new Map<string, { credit: number; count: number }>();
  const byUser = new Map<string, { credit: number; count: number; tokensIn: number; tokensOut: number }>();
  let creditTotal = 0;
  let transcribeCount = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  for (const r of (creditRows ?? []) as {
    institution_id: string; created_by: string | null; feature: string; delta: number; tokens_in: number; tokens_out: number;
  }[]) {
    if (r.delta >= 0) continue; // 충전(grant)은 사용량 제외
    const spent = -r.delta;
    const ti = r.tokens_in ?? 0;
    const to = r.tokens_out ?? 0;
    creditTotal += spent;
    transcribeCount += 1;
    tokensIn += ti;
    tokensOut += to;

    const f = byFeature.get(r.feature) ?? { credits: 0, count: 0, tokensIn: 0, tokensOut: 0 };
    f.credits += spent; f.count += 1; f.tokensIn += ti; f.tokensOut += to;
    byFeature.set(r.feature, f);

    const w = wsCredit.get(r.institution_id) ?? { credit: 0, count: 0 };
    w.credit += spent; w.count += 1;
    wsCredit.set(r.institution_id, w);

    const uk = r.created_by || "(알 수 없음)";
    const u = byUser.get(uk) ?? { credit: 0, count: 0, tokensIn: 0, tokensOut: 0 };
    u.credit += spent; u.count += 1; u.tokensIn += ti; u.tokensOut += to;
    byUser.set(uk, u);
  }

  // ── 워크스페이스 합치기(메뉴 ∪ 크레딧 등장 기관) ──
  const wsIds = new Set<string>([...wsMenu.keys(), ...wsCredit.keys()]);
  if (instFilter) wsIds.add(instFilter);
  const byWorkspace = [...wsIds]
    .map((id) => ({
      id,
      name: nameMap.get(id) || id,
      menu: wsMenu.get(id) || 0,
      activeUsers: wsUsers.get(id)?.size || 0,
      credit: wsCredit.get(id)?.credit || 0,
      transcribeCount: wsCredit.get(id)?.count || 0,
      balance: balMap.get(id) ?? 0,
    }))
    .sort((a, b) => b.credit - a.credit || b.menu - a.menu);

  // ── 전일 대비(menu total + credit total) ──
  const prevDate = shiftKstDate(date, -1);
  const prevRange = kstDayRangeUtc(prevDate);
  let pm = admin.from("menu_usage_daily").select("count").eq("day", prevDate);
  if (instFilter) pm = pm.eq("institution_id", instFilter);
  let pc = admin.from("credit_log").select("delta").gte("created_at", prevRange.startIso).lt("created_at", prevRange.endIso);
  if (instFilter) pc = pc.eq("institution_id", instFilter);
  const [{ data: pmRows }, { data: pcRows }] = await Promise.all([pm, pc]);
  const prevMenu = ((pmRows ?? []) as { count: number }[]).reduce((s, r) => s + (r.count ?? 0), 0);
  const prevCredit = ((pcRows ?? []) as { delta: number }[]).reduce((s, r) => (r.delta < 0 ? s - r.delta : s), 0);
  const prev = pmRows || pcRows ? { menuTotal: prevMenu, creditTotal: prevCredit } : null;

  // ── 경고 신호 ──
  const alerts: DailyReport["alerts"] = [];
  for (const w of byWorkspace) {
    if (w.balance < 0) alerts.push({ level: "warn", text: `잔액 음수: ${w.name} (${w.balance})` });
    else if (w.credit > 0 && w.balance < LOW_BALANCE) alerts.push({ level: "warn", text: `잔액 임박: ${w.name} (${w.balance})` });
  }
  if (prev && prevCredit > 0 && creditTotal > prevCredit * 1.5) {
    alerts.push({ level: "info", text: `크레딧 사용 급증: 전일 ${prevCredit} → 당일 ${creditTotal}` });
  }

  return {
    date,
    scope,
    summary: {
      workspaces: byWorkspace.length,
      menuTotal,
      activeUsers: allUsers.size,
      creditTotal,
      transcribeCount,
      tokensIn,
      tokensOut,
    },
    prev,
    byWorkspace,
    byFeature: [...byFeature.entries()]
      .map(([feature, v]) => ({ feature, label: featureLabel(feature), ...v }))
      .sort((a, b) => b.credits - a.credits),
    byMenu: [...byMenu.entries()]
      .map(([id, v]) => ({ id, label: menuLabel(id), total: v.total, byRole: v.byRole }))
      .sort((a, b) => b.total - a.total),
    topUsers: [...byUser.entries()]
      .map(([user, v]) => ({ user, ...v }))
      .sort((a, b) => b.credit - a.credit)
      .slice(0, 20),
    alerts,
  };
}

/** 리포트 스냅샷 저장(멱등 upsert). */
export async function persistDailyReport(report: DailyReport): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();
    await admin
      .from("usage_reports")
      .upsert(
        { report_date: report.date, scope: report.scope, payload: report },
        { onConflict: "report_date,scope" },
      );
  } catch (e) {
    console.warn("[daily-report] persist 실패(비차단):", e);
  }
}

/** 저장된 리포트 조회(없으면 null). */
export async function getStoredReport(date: string, scope = "all"): Promise<DailyReport | null> {
  try {
    const admin = createAdminSupabaseClient();
    const { data } = await admin
      .from("usage_reports")
      .select("payload")
      .eq("report_date", date)
      .eq("scope", scope)
      .maybeSingle();
    return (data?.payload as DailyReport) ?? null;
  } catch {
    return null;
  }
}

/** 알림/요약용 한 줄. */
export function reportHeadline(r: DailyReport): string {
  return `진입 ${r.summary.menuTotal.toLocaleString("ko-KR")} · 크레딧 ${r.summary.creditTotal.toLocaleString("ko-KR")} · 전사 ${r.summary.transcribeCount}건 · 토큰 ${(r.summary.tokensIn + r.summary.tokensOut).toLocaleString("ko-KR")}`;
}
