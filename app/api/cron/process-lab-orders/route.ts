import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/institution";
import { isSuperAdmin } from "@/lib/admin";
import { sendLabOrderById } from "@/lib/lab-order-sender";

// spec 035 — 기공지 재전송 큐 워커. queued 상태 의뢰를 EO 게이트웨이로 재전송한다.
//   게이트웨이 미발효(테오 EP 구축 중) 동안 큐가 쌓였다가, 발효되면 자동으로 흘러간다.
//   10분 주기(vercel.json cron). CRON_SECRET Bearer(자동) 또는 슈퍼어드민 세션(수동).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
const BATCH = 10;

async function authorize(req: NextRequest): Promise<boolean> {
  const secret = stripBom(process.env.CRON_SECRET ?? "");
  if (secret) {
    if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
    const user = await getSessionUser().catch(() => null);
    return isSuperAdmin(user?.email);
  }
  return true;
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminSupabaseClient();
  const { data: queued } = await admin
    .from("lab_orders")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(BATCH);

  let sent = 0;
  let kept = 0;
  let failed = 0;
  for (const row of queued ?? []) {
    const r = await sendLabOrderById(row.id as string);
    if (r.status === "sent") sent++;
    else if (r.status === "queued") kept++;
    else failed++;
  }
  return NextResponse.json({ ok: true, picked: queued?.length ?? 0, sent, kept, failed });
}
