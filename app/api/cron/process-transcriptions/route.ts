import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/institution";
import { isSuperAdmin } from "@/lib/admin";
import { audioBucket } from "@/lib/supabase/config";
import { runServerTranscription } from "@/app/actions/transcribe";
import { sanitizeRichHtml, ensureHtml } from "@/lib/sanitize-html";
import { deductCredit, CREDIT_PRICES, type CreditFeature } from "@/lib/credits";
import { sendNotification } from "@/lib/notifications";

// spec 020 서버 비동기 전사 워커 — pending job을 집어 전사·요약 후 상담 레코드를 채운다.
//   매 분(vercel.json cron) 실행. CRON_SECRET Bearer(자동) 또는 슈퍼어드민 세션(수동).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 긴 상담 전사(Whisper+요약) 여유

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
const BATCH = 5; // 한 번에 처리할 job 수
const MAX_ATTEMPTS = 3;

async function authorize(req: NextRequest): Promise<boolean> {
  const secret = stripBom(process.env.CRON_SECRET ?? "");
  if (secret) {
    if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
    const user = await getSessionUser().catch(() => null);
    return isSuperAdmin(user?.email);
  }
  return true;
}

function insertTextToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${esc(l)}</p>`)
    .join("");
}

function engineFeature(engine: string): CreditFeature {
  const k = `transcribe_${engine}` as CreditFeature;
  return k in CREDIT_PRICES ? k : "transcribe_basic";
}

type Job = {
  id: string;
  institution_id: string;
  consultation_id: string;
  engine: string;
  prefix_html: string | null;
  attempts: number;
  created_by: string | null;
};

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminSupabaseClient();
  const now = () => new Date().toISOString();

  const { data: pending } = await admin
    .from("transcription_jobs")
    .select("id, institution_id, consultation_id, engine, prefix_html, attempts, created_by")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH);

  const jobs = (pending ?? []) as Job[];
  let done = 0;
  let failed = 0;

  for (const job of jobs) {
    // 원자적 클레임(중복 실행 방지) — 여전히 pending일 때만 processing으로.
    const { data: claimed } = await admin
      .from("transcription_jobs")
      .update({ status: "processing", updated_at: now() })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed?.length) continue;

    try {
      const { data: c } = await admin
        .from("consultation")
        .select("audio_path")
        .eq("id", job.consultation_id)
        .maybeSingle();
      const audioPath = c?.audio_path as string | null;
      if (!audioPath) throw new Error("audio_path 없음");

      const { data: blob, error: dlErr } = await admin.storage.from(audioBucket).download(audioPath);
      if (dlErr || !blob) throw new Error(`음성 다운로드 실패: ${dlErr?.message ?? "no blob"}`);

      const file = new File([blob], "recording.webm", { type: blob.type || "audio/webm" });
      const r = await runServerTranscription(file, job.engine);
      if (!r.ok) throw new Error(r.message);

      const finalHtml = sanitizeRichHtml(
        ensureHtml(`${job.prefix_html ?? ""}${insertTextToHtml(r.insertText)}`),
      );
      await admin.from("consultation").update({ content: finalHtml }).eq("id", job.consultation_id);
      await admin.from("transcription_jobs").update({ status: "done", error: null, updated_at: now() }).eq("id", job.id);

      // 사용량(크레딧·토큰) 기록 — 세션 없이 job 기준
      await deductCredit(job.institution_id, engineFeature(job.engine), job.created_by ?? "server", {
        refId: job.consultation_id,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
      });

      await sendNotification({
        title: "상담 기록이 준비됐어요",
        body: "백그라운드 전사가 완료돼 상담 기록에 반영됐어요.",
        type: "consultation_saved",
        link: "/records",
        recipients: "all",
        institutionId: job.institution_id,
      });
      done++;
    } catch (e) {
      const attempts = (job.attempts ?? 0) + 1;
      const msg = e instanceof Error ? e.message : "unknown";
      if (attempts >= MAX_ATTEMPTS) {
        await admin
          .from("transcription_jobs")
          .update({ status: "error", attempts, error: msg, updated_at: now() })
          .eq("id", job.id);
        // 상담 본문에 실패 안내 남김(유실 아님 — 음성은 보관, 재시도 가능)
        const failHtml = sanitizeRichHtml(
          ensureHtml(`${job.prefix_html ?? ""}<p>⚠️ 서버 전사에 실패했어요. 음성은 보관돼 있어요 — 다시 시도해 주세요.</p>`),
        );
        await admin.from("consultation").update({ content: failHtml }).eq("id", job.consultation_id);
        await sendNotification({
          title: "전사 실패",
          body: "서버 전사에 실패했어요. 상담 기록에서 다시 시도해 주세요.",
          type: "system",
          link: "/records",
          recipients: "all",
          institutionId: job.institution_id,
        });
        failed++;
      } else {
        // 재시도 — 다시 pending으로
        await admin
          .from("transcription_jobs")
          .update({ status: "pending", attempts, error: msg, updated_at: now() })
          .eq("id", job.id);
      }
    }
  }

  return NextResponse.json({ ok: true, picked: jobs.length, done, failed });
}
