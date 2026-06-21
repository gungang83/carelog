"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyInstitutionId, getSessionUser } from "@/lib/auth/institution";
import { patientTable } from "@/lib/supabase/config";
import { formatResidentNoForList } from "@/lib/rrn-core";
import { formatPhoneForList } from "@/lib/patient-search";

export type ActivityLogEntry = {
  id: string;
  event_type: string;
  patient_id: number | null;
  consultation_id: number | null;
  created_at: string;
  content_preview: string | null;
  patient_name: string | null;
  // 환자 등록 확인용 식별정보 — 민감정보는 서버에서 마스킹해 전달(평문 미노출).
  chart_no: string | null;
  resident_masked: string | null;
  phone_masked: string | null;
};

export async function getActivityLogs(limit = 50): Promise<
  { ok: true; logs: ActivityLogEntry[] } | { ok: false; message: string }
> {
  const supabase = await createServerSupabaseClient();
  // 인증 게이트는 요청당 1회로 dedupe된 getSessionUser 사용(카드 479 ②).
  // 별도 supabase.auth.getUser()는 GoTrue 왕복을 한 번 더 추가하므로 피한다.
  const user = await getSessionUser();
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

  // patient_id 목록으로 환자 식별정보 별도 조회 (FK 없이 수동 조인)
  const patientIds = [...new Set(logs.map((l) => l.patient_id).filter(Boolean))];
  type PatientInfo = {
    name: string;
    chart_no: string | null;
    resident_masked: string | null;
    phone_masked: string | null;
  };
  const infoMap = new Map<number, PatientInfo>();

  if (patientIds.length > 0) {
    const { data: patients } = await supabase
      .from(patientTable)
      .select("id, name, chart_no, resident_no, phone")
      .in("id", patientIds);

    for (const p of patients ?? []) {
      infoMap.set(p.id, {
        name: p.name,
        chart_no: (p.chart_no as string | null) ?? null,
        // 민감정보는 여기서 마스킹 — 평문 주민/전화는 클라이언트로 보내지 않는다.
        resident_masked: formatResidentNoForList(p.resident_no as string | null),
        phone_masked: formatPhoneForList(p.phone as string | null),
      });
    }
  }

  const result: ActivityLogEntry[] = logs.map((row) => {
    const info = row.patient_id != null ? infoMap.get(row.patient_id) : undefined;
    return {
      id: row.id,
      event_type: row.event_type,
      patient_id: row.patient_id,
      consultation_id: row.consultation_id,
      created_at: row.created_at,
      content_preview: (row.metadata as { content_preview?: string } | null)?.content_preview ?? null,
      patient_name: info?.name ?? null,
      chart_no: info?.chart_no ?? null,
      resident_masked: info?.resident_masked ?? null,
      phone_masked: info?.phone_masked ?? null,
    };
  });

  return { ok: true, logs: result };
}
