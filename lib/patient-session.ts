import { cache } from "react";
import { cookies } from "next/headers";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type PatientSessionData = {
  patientAccountId: string;
};

export const getPatientSession = cache(
  async (): Promise<PatientSessionData | null> => {
    const cookieStore = await cookies();
    const admin = createAdminSupabaseClient();

    // 1단계: OTP 쿠키 세션
    const token = cookieStore.get("patient_session_token")?.value;
    if (token) {
      const { data, error } = await admin
        .from("patient_sessions")
        .select("patient_account_id, expires_at")
        .eq("token", token)
        .single();

      if (!error && data && new Date(data.expires_at) > new Date()) {
        return { patientAccountId: data.patient_account_id };
      }
    }

    // 2단계: Supabase 인증 세션 (Google OAuth 가입 환자)
    try {
      const { createServerSupabaseClient } = await import("@/lib/supabase/server");
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: link } = await admin
          .from("patient_auth_links")
          .select("patient_account_id")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (link) {
          return { patientAccountId: link.patient_account_id };
        }
      }
    } catch {
      // 서버 컨텍스트 밖(예: 미들웨어)에서 호출 시 무시
    }

    return null;
  },
);
