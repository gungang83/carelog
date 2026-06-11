import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { syncEoMaster } from "@/lib/eo/sync-master";

// 서버-서버(게이트웨이) + admin 클라이언트 사용 → Node 런타임, 매 호출 동적.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

/**
 * EO 미연동 플레이스홀더/시드 기관 — 폴링에서 제외.
 * 매 주기 게이트웨이로 보내져 404를 유발(EO Vercel 로그 노이즈)하므로 건너뛴다.
 * 빌(EO) 보고: a0000000-0000-0000-0000-… 더미는 workspace_carelog_links 미등록.
 * 실제 EO 연동 기관은 random UUID라 이 시드 프리픽스와 충돌하지 않는다.
 */
const EO_POLL_EXCLUDE_PREFIXES = ["a0000000-0000-0000-0000-"];

/**
 * Vercel Cron — EO 마스터 게이트웨이 폴링(권장 5~15분).
 * 모든 기관에 대해 syncEoMaster를 호출하고, EO 미연동(404)은 조용히 스킵한다.
 * CRON_SECRET이 설정되어 있으면 Authorization: Bearer <secret>로 보호한다.
 */
export async function GET(req: NextRequest) {
  const cronSecret = stripBom(process.env.CRON_SECRET ?? "");
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  let admin;
  try {
    admin = createAdminSupabaseClient();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "config" },
      { status: 500 },
    );
  }

  const { data: institutions, error } = await admin
    .from("institutions")
    .select("id");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: Array<{ institution_id: string; status: string }> = [];
  let synced = 0;
  let skipped = 0;

  for (const inst of institutions ?? []) {
    const id = inst.id as string;
    if (EO_POLL_EXCLUDE_PREFIXES.some((p) => id.startsWith(p))) continue;
    const result = await syncEoMaster(id);
    if (result.ok) {
      synced += 1;
      results.push({
        institution_id: id,
        status: `synced(+${result.inserted}/~${result.updated}/-${result.deactivated})`,
      });
    } else if (result.reason === "not_linked") {
      skipped += 1;
      // EO 미연동 기관은 정상 — 결과에 남기지 않음(노이즈 방지).
    } else {
      results.push({ institution_id: id, status: `error:${result.reason}` });
    }
  }

  return NextResponse.json({ ok: true, synced, skipped, results });
}
