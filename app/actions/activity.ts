"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyInstitutionId } from "@/lib/auth/institution";

export type ActivityLogEntry = {
  id: string;
  event_type: string;
  patient_id: string | null;
  consultation_id: string | null;
  created_at: string;
  content_preview: string | null;
  patient_name: string | null;
};

export async function getActivityLogs(limit = 50): Promise<
  { ok: true; logs: ActivityLogEntry[] } | { ok: false; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, event_type, patient_id, consultation_id, created_at, metadata, patients(name)")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { ok: false, message: "활동 로그 조회에 실패했습니다." };

  const logs: ActivityLogEntry[] = (data ?? []).map((row) => ({
    id: row.id,
    event_type: row.event_type,
    patient_id: row.patient_id,
    consultation_id: row.consultation_id,
    created_at: row.created_at,
    content_preview: (row.metadata as { content_preview?: string } | null)?.content_preview ?? null,
    patient_name: (row.patients as unknown as { name: string } | null)?.name ?? null,
  }));

  return { ok: true, logs };
}
