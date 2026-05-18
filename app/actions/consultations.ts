"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  consultationBucket,
  consultationTable,
} from "@/lib/supabase/config";
import { getMyInstitutionId } from "@/lib/auth/institution";
import { resolveResidentMatchHashForPatient } from "@/app/actions/patients";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendPushToInstitution } from "@/app/actions/push";
import { sendPushToPatient } from "@/app/actions/patient-portal";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/sms/solapi";

export async function saveConsultation(
  patientId: string,
  content: string,
  formData: FormData,
): Promise<{ ok: false; message: string } | never> {
  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, message: "상담 내용을 입력해 주세요." };
  }

  const institutionId = await getMyInstitutionId();
  if (!institutionId) {
    return { ok: false, message: "기관 정보를 찾을 수 없습니다. 다시 로그인해 주세요." };
  }

  const stationRaw =
    formData.get("stationName") ?? formData.get("station_name");
  const station_name =
    typeof stationRaw === "string" && stationRaw.trim() ? stationRaw.trim() : null;

  const prescriptionsRaw = formData.get("prescriptions");
  let prescriptions: string[] = [];
  if (typeof prescriptionsRaw === "string" && prescriptionsRaw.trim()) {
    try {
      const parsed = JSON.parse(prescriptionsRaw) as unknown;
      if (Array.isArray(parsed)) {
        prescriptions = parsed.filter((v) => typeof v === "string") as string[];
      }
    } catch {
      prescriptions = [];
    }
  }

  const files = formData.getAll("images").filter((v) => v instanceof File) as File[];
  const nonEmpty = files.filter((f) => f.size > 0);

  try {
    const supabase = await createServerSupabaseClient();
    const image_urls: string[] = [];

    for (const file of nonEmpty) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${patientId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from(consultationBucket)
        .upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
      if (upErr) {
        return {
          ok: false,
          message: `이미지 업로드 실패(파일: ${file.name}): ${upErr.message}`,
        };
      }

      const { data: pub } = supabase.storage
        .from(consultationBucket)
        .getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) {
        return {
          ok: false,
          message: `이미지 URL 생성 실패(파일: ${file.name}): publicUrl이 비어있습니다.`,
        };
      }
      image_urls.push(publicUrl);
    }

    const { data: inserted, error } = await supabase
      .from(consultationTable)
      .insert({
        patient_id: patientId,
        institution_id: institutionId,
        content: trimmed,
        image_urls,
        prescriptions,
        station_name,
      })
      .select("id")
      .single();

    if (error) {
      return { ok: false, message: `DB 저장 실패: ${error.message}` };
    }
    if (!inserted?.id) {
      return { ok: false, message: "DB 저장 실패: consultation id가 없습니다." };
    }

    void (await resolveResidentMatchHashForPatient(patientId));

    const patientName = await supabase
      .from("patient")
      .select("name")
      .eq("id", patientId)
      .single()
      .then((r) => r.data?.name ?? "환자");

    // "저장 후 환자 전송" 모드: SMS 초대 발송
    const submitMode = formData.get("submit_mode");
    if (submitMode === "send") {
      // 이미 위에서 생성한 supabase 클라이언트 재사용 (RLS — 직원은 자기 기관 환자 조회 가능)
      const { data: patientRow, error: patientErr } = await supabase
        .from("patient")
        .select("phone, resident_no")
        .eq("id", patientId)
        .eq("institution_id", institutionId)
        .maybeSingle();

      if (patientErr) {
        return { ok: false, message: `환자 정보 조회 실패: ${patientErr.message}` };
      }
      if (!patientRow) {
        return { ok: false, message: "환자 정보를 찾을 수 없습니다." };
      }
      if (!patientRow.phone) {
        return { ok: false, message: "환자 전화번호가 등록되어 있지 않습니다. 환자 정보를 먼저 수정해 주세요." };
      }
      if (!patientRow.resident_no) {
        return { ok: false, message: "환자 주민번호가 등록되어 있지 않습니다. 환자 정보를 먼저 수정해 주세요." };
      }

      const adminSms = createAdminSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      // 기존 미수락 초대 무효화
      await adminSms
        .from("patient_invitations")
        .update({ expires_at: new Date().toISOString() })
        .eq("patient_id", patientId)
        .is("accepted_at", null);

      // 새 초대 생성
      const { data: invitation, error: invErr } = await adminSms
        .from("patient_invitations")
        .insert({
          institution_id: institutionId,
          patient_id: patientId,
          phone: patientRow.phone,
          consent_given: true,
          invited_by: user?.id ?? null,
        })
        .select("token")
        .single();

      if (invErr || !invitation) {
        return { ok: false, message: `초대 생성 실패: ${invErr?.message ?? "알 수 없는 오류"}` };
      }

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://carelog-tau.vercel.app";
      const institutionData = await (await import("@/lib/auth/institution")).getMyInstitution();
      const institutionName = institutionData?.institution.name ?? "케어로그";
      const smsText = `[${institutionName}] ${patientName}님의 상담 내역 확인하기: ${siteUrl}/p/${invitation.token}`;
      const smsResult = await sendSms(patientRow.phone, smsText);

      if (!smsResult.ok) {
        await adminSms.from("patient_invitations").delete().eq("token", invitation.token);
        return { ok: false, message: `SMS 발송 실패: ${smsResult.message}` };
      }
    }

    // 푸시 알림 발송 (fire-and-forget — 실패해도 상담 저장에 영향 없음)
    const preview = trimmed.replace(/<[^>]*>/g, "").slice(0, 60);
    sendPushToInstitution(institutionId, {
      title: "새 상담 기록",
      body: `${patientName} — ${preview}`,
      url: `/patients/${patientId}#consultation-${inserted.id}`,
    }).catch(() => {});

    // 환자 앱 푸시 알림 (가입한 환자에게만)
    const admin = createAdminSupabaseClient();
    void Promise.resolve(
      admin
        .from("patient_account_links")
        .select("patient_account_id")
        .eq("patient_id", patientId)
        .maybeSingle(),
    ).then((r) => {
      if (r.data?.patient_account_id) {
        sendPushToPatient(r.data.patient_account_id, {
          title: "새 진료 기록",
          body: `${patientName} — ${preview}`,
          url: `/portal/records`,
        }).catch(() => {});
      }
    }).catch(() => {});
  } catch (e) {
    const message = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return { ok: false, message };
  }

  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

export async function getConsultationsByPatientId(
  patientId: string,
): Promise<
  | {
      ok: true;
      consultations: Array<{
        id: string;
        content: string;
        image_urls: string[] | null;
        prescriptions: string[] | null;
        station_name: string | null;
        created_at: string;
      }>;
    }
  | { ok: false; message: string }
> {
  try {
    const institutionId = await getMyInstitutionId();
    if (!institutionId) {
      return { ok: false, message: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from(consultationTable)
      .select(
        "id, patient_id, content, image_urls, prescriptions, station_name, created_at",
      )
      .eq("patient_id", patientId)
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return { ok: false, message: error.message };
    }
    return {
      ok: true,
      consultations: (data ?? []) as Array<{
        id: string;
        patient_id: string;
        content: string;
        image_urls: string[] | null;
        prescriptions: string[] | null;
        station_name: string | null;
        created_at: string;
      }>,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "상담 내역 조회에 실패했습니다.";
    return { ok: false, message };
  }
}

export async function getConsultationById(
  consultationId: string,
): Promise<
  | {
      ok: true;
      consultation: {
        id: string;
        patient_id: string;
        content: string;
        image_urls: string[] | null;
        prescriptions: string[] | null;
        station_name: string | null;
        created_at: string;
      };
    }
  | { ok: false; message: string }
> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from(consultationTable)
      .select(
        "id, patient_id, content, image_urls, prescriptions, station_name, created_at",
      )
      .eq("id", consultationId)
      .maybeSingle();

    if (error) {
      return { ok: false, message: error.message };
    }
    if (!data) {
      return { ok: false, message: "상담을 찾을 수 없습니다." };
    }

    return { ok: true, consultation: data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "상담 상세 조회에 실패했습니다.";
    return { ok: false, message };
  }
}
