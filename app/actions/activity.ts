"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyInstitutionId } from "@/lib/auth/institution";
import { patientTable } from "@/lib/supabase/config";

export type ActivityLogEntry = {
  id: string;
  event_type: string;
  patient_id: number | null;
  consultation_id: number | null;
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

  const { data: logs, error } = await supabase
    .from("activity_logs")
    .select("id, event_type, patient_id, consultation_id, created_at, metadata")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { ok: false, message: "활동 로그 조회에 실패했습니다." };
  if (!logs || logs.length === 0) return { ok: true, logs: [] };

  // patient_id 목록으로 환자 이름 별도 조회 (FK 없이 수동 조인)
  const patientIds = [...new Set(logs.map((l) => l.patient_id).filter(Boolean))];
  const nameMap = new Map<number, string>();

  if (patientIds.length > 0) {
    const { data: patients } = await supabase
      .from(patientTable)
      .select("id, name")
      .in("id", patientIds);

    for (const p of patients ?? []) {
      nameMap.set(p.id, p.name);
    }
  }

  const result: ActivityLogEntry[] = logs.map((row) => ({
    id: row.id,
    event_type: row.event_type,
    patient_id: row.patient_id,
    consultation_id: row.consultation_id,
    created_at: row.created_at,
    content_preview: (row.metadata as { content_preview?: string } | null)?.content_preview ?? null,
    patient_name: row.patient_id != null ? (nameMap.get(row.patient_id) ?? null) : null,
  }));

  return { ok: true, logs: result };
}
