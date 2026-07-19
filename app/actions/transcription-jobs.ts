"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitutionId, getMyAuthorInfo } from "@/lib/auth/institution";
import { sanitizeRichHtml, ensureHtml } from "@/lib/sanitize-html";
import { uploadConsultationAudio } from "@/app/actions/audio";

// spec 020 서버 비동기 전사 — '상담 종료 및 저장' 시 음성만 올리고 job 등록.
//   플레이스홀더 상담 레코드를 즉시 생성('전사 중') → 브라우저는 바로 종료.
//   cron 워커(/api/cron/process-transcriptions)가 전사·요약 후 이 레코드를 채운다.

const PENDING_MARK = "🎙️ 서버에서 전사 중이에요 — 곧 자동으로 채워집니다.";

type EnqueueResult =
  | { ok: true; consultationId: string }
  | { ok: false; message: string };

export async function enqueueServerTranscription(formData: FormData): Promise<EnqueueResult> {
  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const chairId = String(formData.get("chairId") ?? "");
  const engine = String(formData.get("engine") ?? "basic");
  const audio = formData.get("audio") as File | null;
  if (!audio || audio.size < 1024) return { ok: false, message: "녹음이 비어 있습니다." };

  // 체어 기관 검증 — spec 027: 체어 미지정(빈 값) 허용(방치 자동 저장 등). chair_id null로 저장.
  let validChairId: string | null = null;
  if (chairId) {
    const { data: chair } = await supabase
      .from("chairs")
      .select("id")
      .eq("id", chairId)
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (!chair) return { ok: false, message: "유효하지 않은 체어입니다." };
    validChairId = chairId;
  }

  let prescriptions: string[] = [];
  let participants: { id: string; name: string; role: string | null }[] = [];
  try {
    prescriptions = JSON.parse(String(formData.get("prescriptions") ?? "[]"));
    participants = JSON.parse(String(formData.get("participants") ?? "[]"));
  } catch {
    /* 파싱 실패는 빈 값으로 */
  }

  // 사용자가 미리 입력해둔 본문(있으면 전사 앞에 보존)
  const prefixRaw = String(formData.get("prefixHtml") ?? "");
  const prefixHtml = prefixRaw.trim() ? sanitizeRichHtml(ensureHtml(prefixRaw)) : "";

  const { author_employee_id, author_name } = await getMyAuthorInfo();

  // 1) 플레이스홀더 상담 생성('전사 중')
  const placeholder = sanitizeRichHtml(ensureHtml(`${prefixHtml}<p>${PENDING_MARK}</p>`));
  const { data: consultation, error } = await supabase
    .from("consultation")
    .insert({
      institution_id: institutionId,
      patient_id: null,
      chair_id: validChairId,
      content: placeholder,
      prescriptions,
      participants,
      status: "draft",
      author_employee_id,
      author_name,
      transcription_engine: engine,
    })
    .select("id")
    .single();
  if (error || !consultation) {
    console.error("[enqueueServerTranscription] 상담 생성 실패:", error?.message);
    return { ok: false, message: `저장 준비 실패: ${error?.message ?? "원인 미상"}` };
  }

  if (validChairId) {
    await supabase.from("chair_audit_logs").insert({
      institution_id: institutionId,
      chair_id: validChairId,
      consultation_id: consultation.id,
      event_type: "record_created",
      actor_user_id: user.id,
    });
  }

  // 2) 음성 업로드(기존 경로 재사용 — audio_path 세팅). 실패 시 job 등록 중단(전사 불가).
  const up = await uploadConsultationAudio(consultation.id, formData);
  if (!up.ok) {
    console.error("[enqueueServerTranscription] 음성 업로드 실패:", up.message);
    return { ok: false, message: `음성 업로드 실패: ${up.message}` };
  }

  // 3) 전사 job 등록(pending) — admin(서버 권위)
  const admin = createAdminSupabaseClient();
  const { error: jobErr } = await admin.from("transcription_jobs").insert({
    institution_id: institutionId,
    consultation_id: consultation.id,
    engine,
    prefix_html: prefixHtml || null,
    created_by: user.email ?? null,
  });
  if (jobErr) {
    console.error("[enqueueServerTranscription] job 등록 실패:", jobErr.message);
    return { ok: false, message: `전사 작업 등록 실패: ${jobErr.message}` };
  }

  revalidatePath("/");
  return { ok: true, consultationId: consultation.id };
}
