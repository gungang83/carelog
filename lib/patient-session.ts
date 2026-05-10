import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type PatientSessionData = {
  patientAccountId: string;
};

export async function getPatientSession(
  cookies: ReadonlyRequestCookies,
): Promise<PatientSessionData | null> {
  const token = cookies.get("patient_session_token")?.value;
  if (!token) return null;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("patient_sessions")
    .select("patient_account_id, expires_at")
    .eq("token", token)
    .single();

  if (error || !data) return null;

  if (new Date(data.expires_at) < new Date()) return null;

  return { patientAccountId: data.patient_account_id };
}
