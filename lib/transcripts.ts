// spec 034 — 전사 원문 보관. 요약 전 원문 텍스트를 consultation_transcripts에 남긴다.
// ★비차단·never-throw — 전사/저장 hot path에서 호출되므로 실패해도 상담 흐름을 막지 않는다.
// 원문은 민감 데이터(대화 전문): RLS 정책 0, service_role 서버 액션만 접근.

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type TranscriptMode = "replace" | "append";

export async function saveConsultationTranscript(
  consultationId: string | number,
  transcript: string,
  engine: string | null,
  mode: TranscriptMode,
): Promise<void> {
  try {
    const text = transcript?.trim();
    if (!text) return;
    const admin = createAdminSupabaseClient();

    if (mode === "append") {
      const { data: existing } = await admin
        .from("consultation_transcripts")
        .select("transcript")
        .eq("consultation_id", consultationId)
        .maybeSingle();
      if (existing?.transcript) {
        const stamp = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
        await admin
          .from("consultation_transcripts")
          .update({
            transcript: `${existing.transcript}\n\n[이어서 상담 — ${stamp}]\n${text}`,
            engine,
            updated_at: new Date().toISOString(),
          })
          .eq("consultation_id", consultationId);
        return;
      }
    }

    await admin.from("consultation_transcripts").upsert(
      {
        consultation_id: consultationId,
        transcript: text,
        engine,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "consultation_id" },
    );
  } catch {
    /* 원문 보관 실패는 무시 — 상담 저장·전사 흐름 불변 (음성 원본으로 재확보 가능) */
  }
}

export async function getConsultationTranscript(
  consultationId: string | number,
): Promise<string | null> {
  try {
    const admin = createAdminSupabaseClient();
    const { data } = await admin
      .from("consultation_transcripts")
      .select("transcript")
      .eq("consultation_id", consultationId)
      .maybeSingle();
    const t = (data?.transcript as string | undefined)?.trim();
    return t || null;
  } catch {
    return null;
  }
}
