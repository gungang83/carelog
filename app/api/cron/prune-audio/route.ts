import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { audioBucket } from "@/lib/supabase/config";
import { normalizePlan, retentionDays, FREE_ROLLING_MAX } from "@/lib/plan";

// admin(service role) + Storage → Node 런타임, 매 호출 동적.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

/**
 * Vercel Cron — 등급별 만료 음성 정리(spec 009 US3, 일 1회 권장).
 * standard(90일)·pro/enterprise(365일) 초과분 삭제, free는 최근 3개 초과분 정리(방어적).
 * 텍스트 기록은 보존(audio_path/audio_uploaded_at만 null). CRON_SECRET Bearer로 보호.
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

  const { data: insts } = await admin.from("institutions").select("id, plan");
  let pruned = 0;

  for (const inst of (insts ?? []) as { id: string; plan: string | null }[]) {
    const plan = normalizePlan(inst.plan);
    const days = retentionDays(plan);

    const { data: rows } = await admin
      .from("consultation")
      .select("id, audio_path, audio_uploaded_at")
      .eq("institution_id", inst.id)
      .not("audio_path", "is", null)
      .order("audio_uploaded_at", { ascending: false });

    const list = (rows ?? []) as {
      id: string;
      audio_path: string;
      audio_uploaded_at: string | null;
    }[];

    let toRemove: typeof list;
    if (days === null) {
      // free: 최근 FREE_ROLLING_MAX개만 유지
      toRemove = list.slice(FREE_ROLLING_MAX);
    } else {
      const cutoff = Date.now() - days * 86_400_000;
      toRemove = list.filter(
        (r) => r.audio_uploaded_at && new Date(r.audio_uploaded_at).getTime() < cutoff,
      );
    }

    if (toRemove.length > 0) {
      await admin.storage.from(audioBucket).remove(toRemove.map((r) => r.audio_path));
      await admin
        .from("consultation")
        .update({ audio_path: null, audio_uploaded_at: null })
        .in(
          "id",
          toRemove.map((r) => r.id),
        );
      pruned += toRemove.length;
    }
  }

  return NextResponse.json({ ok: true, pruned });
}
