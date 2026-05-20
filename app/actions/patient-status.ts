"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitutionId } from "@/lib/auth/institution";

export type PatientSmsRecord = {
  id: string;
  phone: string;
  sentAt: string;
  acceptedAt: string | null;
  expiresAt: string;
};

export type PatientPortalStatusData = {
  isActive: boolean;        // patient_account_links 레코드 존재 여부
  linkedAt: string | null;  // 앱 가입 시각
  consentAt: string | null; // 최초 동의 시각 (consent_given=true 첫 번째 초대)
  smsHistory: PatientSmsRecord[];
};

export async function getPatientPortalStatus(
  patientId: string,
): Promise<{ ok: true; status: PatientPortalStatusData } | { ok: false; message: string }> {
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const admin = createAdminSupabaseClient();

  const [linkResult, invResult] = await Promise.all([
    admin
      .from("patient_account_links")
      .select("id, linked_at")
      .eq("patient_id", patientId)
      .eq("institution_id", institutionId)
      .order("linked_at", { ascending: true })
      .limit(1),
    admin
      .from("patient_invitations")
      .select("id, phone, consent_given, accepted_at, expires_at, created_at")
      .eq("patient_id", patientId)
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const link = linkResult.data?.[0] ?? null;
  const invitations = invResult.data ?? [];

  // 최초 동의 — consent_given=true 중 가장 오래된 것
  const firstConsent = [...invitations]
    .filter((i) => i.consent_given)
    .sort((a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime())[0];

  const smsHistory: PatientSmsRecord[] = invitations.map((i) => ({
    id: i.id as string,
    phone: i.phone as string,
    sentAt: i.created_at as string,
    acceptedAt: (i.accepted_at as string | null) ?? null,
    expiresAt: i.expires_at as string,
  }));

  return {
    ok: true,
    status: {
      isActive: link !== null,
      linkedAt: link ? (link.linked_at as string) : null,
      consentAt: firstConsent ? (firstConsent.created_at as string) : null,
      smsHistory,
    },
  };
}
