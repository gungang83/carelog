"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitutionId } from "@/lib/auth/institution";
import { audioBucket } from "@/lib/supabase/config";
import {
  normalizePlan,
  retentionDays,
  auditReplay,
  FREE_ROLLING_MAX,
  type PlanTier,
} from "@/lib/plan";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

async function getPlan(admin: AdminClient, institutionId: string): Promise<PlanTier> {
  const { data } = await admin
    .from("institutions")
    .select("plan")
    .eq("id", institutionId)
    .maybeSingle();
  return normalizePlan(data?.plan as string | null);
}

/**
 * 상담 음성 원본을 비공개 버킷에 업로드하고 상담에 연결한다(spec 009 US1).
 * 저장을 막지 않는 보조 단계 — 실패해도 텍스트 기록은 유효.
 */
export async function uploadConsultationAudio(
  consultationId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const file = formData.get("audio") as File | null;
  if (!file || file.size === 0) return { ok: false, message: "음성 파일이 없습니다." };

  const admin = createAdminSupabaseClient();

  // 대상 상담이 호출자 기관인지 검증(기관 격리)
  const { data: c } = await admin
    .from("consultation")
    .select("id, institution_id")
    .eq("id", consultationId)
    .maybeSingle();
  if (!c || c.institution_id !== institutionId) {
    return { ok: false, message: "유효하지 않은 상담입니다." };
  }

  const path = `${institutionId}/${consultationId}.webm`;

  // spec 027 ④ — 같은 상담에 다시 녹음(이어서 상담 등)할 때 기존 음성을 덮지 않고
  // .prev-<ts> 로 보관한다(의료기록 원본 보존 — UI 재생은 최신 세션).
  const { data: prev } = await admin
    .from("consultation")
    .select("audio_path")
    .eq("id", consultationId)
    .maybeSingle();
  if (prev?.audio_path === path) {
    await admin.storage
      .from(audioBucket)
      .move(path, `${institutionId}/${consultationId}.prev-${Date.now()}.webm`)
      .catch(() => {});
  }

  const { error: upErr } = await admin.storage
    .from(audioBucket)
    .upload(path, file, { contentType: file.type || "audio/webm", upsert: true });
  if (upErr) return { ok: false, message: `음성 업로드 실패: ${upErr.message}` };

  await admin
    .from("consultation")
    .update({ audio_path: path, audio_uploaded_at: new Date().toISOString() })
    .eq("id", consultationId);

  // 무료 등급: 최근 3개만 유지(롤링) — 4번째 이후 음성 정리(텍스트는 유지)
  const plan = await getPlan(admin, institutionId);
  if (plan === "free") await pruneFreeRolling(admin, institutionId);

  return { ok: true };
}

/** 무료 등급 롤링 정리 — audio_uploaded_at 최신순 FREE_ROLLING_MAX개만 남기고 음성 삭제. */
async function pruneFreeRolling(admin: AdminClient, institutionId: string): Promise<void> {
  const { data } = await admin
    .from("consultation")
    .select("id, audio_path, audio_uploaded_at")
    .eq("institution_id", institutionId)
    .not("audio_path", "is", null)
    .order("audio_uploaded_at", { ascending: false });

  const rows = (data ?? []) as { id: string; audio_path: string }[];
  const stale = rows.slice(FREE_ROLLING_MAX);
  if (stale.length === 0) return;

  await admin.storage.from(audioBucket).remove(stale.map((r) => r.audio_path));
  await admin
    .from("consultation")
    .update({ audio_path: null, audio_uploaded_at: null })
    .in(
      "id",
      stale.map((r) => r.id),
    );
}

export type AudioUrlResult =
  | { ok: true; url: string; expiresIn: number }
  | { ok: false; reason: "expired" | "not_stored" | "forbidden" | "error"; message: string };

/**
 * 재청취용 서명 URL 발급(spec 009 US1·US2). 권한·기관·등급 보존 판정 후 짧은 TTL로만.
 * Pro 이상은 재청취 감사로그를 남긴다(US3).
 */
export async function getConsultationAudioUrl(
  consultationId: string,
): Promise<AudioUrlResult> {
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, reason: "forbidden", message: "권한이 없습니다." };

  const admin = createAdminSupabaseClient();
  const { data: c } = await admin
    .from("consultation")
    .select("id, institution_id, audio_path, audio_uploaded_at")
    .eq("id", consultationId)
    .maybeSingle();

  if (!c || c.institution_id !== institutionId) {
    return { ok: false, reason: "forbidden", message: "권한이 없습니다." };
  }
  if (!c.audio_path) {
    return { ok: false, reason: "not_stored", message: "저장된 음성이 없어요." };
  }

  const plan = await getPlan(admin, institutionId);
  const days = retentionDays(plan);
  if (days !== null && c.audio_uploaded_at) {
    const ageDays = (Date.now() - new Date(c.audio_uploaded_at as string).getTime()) / 86_400_000;
    if (ageDays > days) {
      return { ok: false, reason: "expired", message: "보관 기간이 지나 들을 수 없어요." };
    }
  }

  const { data: signed, error } = await admin.storage
    .from(audioBucket)
    .createSignedUrl(c.audio_path as string, 60);
  if (error || !signed?.signedUrl) {
    return { ok: false, reason: "error", message: "음성을 불러오지 못했습니다." };
  }

  // 재청취 감사(Pro 이상) — chair_audit_logs 미사용(realtime 오발 방지)
  if (auditReplay(plan)) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await admin.from("audio_replay_logs").insert({
        institution_id: institutionId,
        consultation_id: consultationId,
        user_id: user.id,
      });
    }
  }

  return { ok: true, url: signed.signedUrl, expiresIn: 60 };
}
