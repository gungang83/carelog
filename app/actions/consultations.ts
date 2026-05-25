"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  consultationBucket,
  consultationTable,
} from "@/lib/supabase/config";
import { getMyInstitutionId } from "@/lib/auth/institution";
import { resolveResidentMatchHashForPatient } from "@/app/actions/patients";
import { revalidatePath } from "next/cache";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { redirect } from "next/navigation";
import { sendPushToInstitution } from "@/app/actions/push";
import { sendPushToPatient } from "@/app/actions/patient-portal";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/sms/solapi";

// ─── 내부 헬퍼: SMS 초대 발송 + sms_sent_at 기록 ─────────────────────────────
async function _sendConsultationSms(
  consultationId: string,
  patientId: string,
  institutionId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: patientRow } = await supabase
    .from("patient")
    .select("name, phone, resident_no")
    .eq("id", patientId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!patientRow?.phone) {
    return { ok: false, message: "환자 전화번호가 등록되어 있지 않습니다." };
  }
  if (!patientRow?.resident_no) {
    return { ok: false, message: "환자 주민번호가 등록되어 있지 않습니다." };
  }

  const admin = createAdminSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 기존 미수락 초대 무효화
  await admin
    .from("patient_invitations")
    .update({ expires_at: new Date().toISOString() })
    .eq("patient_id", patientId)
    .is("accepted_at", null);

  const { data: invitation, error: invErr } = await admin
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
  const smsText = `[${institutionName}] ${patientRow.name}님의 상담 내역 확인하기: ${siteUrl}/p/${invitation.token}`;

  const smsResult = await sendSms(patientRow.phone, smsText);
  if (!smsResult.ok) {
    await admin.from("patient_invitations").delete().eq("token", invitation.token);
    return { ok: false, message: smsResult.message ?? "SMS 발송 실패" };
  }

  // sms_sent_at 기록
  await supabase
    .from(consultationTable)
    .update({ sms_sent_at: new Date().toISOString() })
    .eq("id", consultationId);

  return { ok: true };
}

// ─── 상담 저장 (임시저장 / 저장 / 저장 후 전송) ────────────────────────────────
export async function saveConsultation(
  patientId: string,
  content: string,
  formData: FormData,
): Promise<{ ok: false; message: string } | never> {
  const trimmed = sanitizeRichHtml(content.trim());
  if (!trimmed) {
    return { ok: false, message: "상담 내용을 입력해 주세요." };
  }

  const institutionId = await getMyInstitutionId();
  if (!institutionId) {
    return { ok: false, message: "기관 정보를 찾을 수 없습니다. 다시 로그인해 주세요." };
  }

  const stationRaw = formData.get("stationName") ?? formData.get("station_name");
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

  const submitMode = formData.get("submit_mode");
  const status = submitMode === "draft" ? "draft" : "confirmed";

  const files = formData.getAll("images").filter((v) => v instanceof File) as File[];
  const nonEmpty = files.filter((f) => f.size > 0);

  // redirect()를 try-catch 밖에서 호출해야 Next.js가 올바르게 처리함.
  // 아래 블록은 에러 반환만 하고, 성공 시 try 블록을 정상 종료.
  try {
    const supabase = await createServerSupabaseClient();
    const image_urls: string[] = [];

    for (const file of nonEmpty) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${patientId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from(consultationBucket)
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) {
        return { ok: false, message: `이미지 업로드 실패(${file.name}): ${upErr.message}` };
      }
      const { data: pub } = supabase.storage.from(consultationBucket).getPublicUrl(path);
      if (!pub?.publicUrl) {
        return { ok: false, message: `이미지 URL 생성 실패(${file.name})` };
      }
      image_urls.push(pub.publicUrl);
    }

    const { data: inserted, error } = await supabase
      .from(consultationTable)
      .insert({ patient_id: patientId, institution_id: institutionId, content: trimmed, image_urls, prescriptions, station_name, status })
      .select("id")
      .single();

    if (error) return { ok: false, message: `DB 저장 실패: ${error.message}` };
    if (!inserted?.id) return { ok: false, message: "DB 저장 실패: id 없음" };

    void (await resolveResidentMatchHashForPatient(patientId));

    const patientName = await supabase
      .from("patient").select("name").eq("id", patientId).single()
      .then((r) => r.data?.name ?? "환자");

    // draft는 SMS/푸시 없이 저장만
    if (status !== "draft") {
      if (submitMode === "send") {
        const smsResult = await _sendConsultationSms(inserted.id, patientId, institutionId);
        if (!smsResult.ok) return { ok: false, message: `SMS 발송 실패: ${smsResult.message}` };
      }

      const preview = trimmed.replace(/<[^>]*>/g, "").slice(0, 60);
      sendPushToInstitution(institutionId, {
        title: "새 상담 기록",
        body: `${patientName} — ${preview}`,
        url: `/patients/${patientId}#consultation-${inserted.id}`,
      }).catch(() => {});

      const admin = createAdminSupabaseClient();
      void Promise.resolve(
        admin.from("patient_account_links").select("patient_account_id").eq("patient_id", patientId).maybeSingle(),
      ).then((r) => {
        if (r.data?.patient_account_id) {
          sendPushToPatient(r.data.patient_account_id, {
            title: "새 진료 기록",
            body: `${patientName} — ${preview}`,
            url: `/portal/records`,
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return { ok: false, message };
  }

  // redirect()는 항상 try-catch 밖에서 호출 (NEXT_REDIRECT 에러가 catch에 잡히지 않도록)
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

// ─── 임시저장 수정 ────────────────────────────────────────────────────────────
export async function updateDraftConsultation(
  consultationId: string,
  content: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = sanitizeRichHtml(content.trim());
  if (!trimmed) return { ok: false, message: "상담 내용을 입력해 주세요." };

  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const prescriptionsRaw = formData.get("prescriptions");
  let prescriptions: string[] = [];
  if (typeof prescriptionsRaw === "string" && prescriptionsRaw.trim()) {
    try {
      const parsed = JSON.parse(prescriptionsRaw) as unknown;
      if (Array.isArray(parsed)) prescriptions = parsed.filter((v) => typeof v === "string") as string[];
    } catch { prescriptions = []; }
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from(consultationTable)
      .update({ content: trimmed, prescriptions })
      .eq("id", consultationId)
      .eq("institution_id", institutionId)
      .eq("status", "draft");

    if (error) return { ok: false, message: `수정 실패: ${error.message}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "수정에 실패했습니다." };
  }
}

// ─── 임시저장 확정 (선택적 SMS 발송) ─────────────────────────────────────────
export async function confirmConsultation(
  consultationId: string,
  patientId: string,
  shouldSendSms: boolean = false,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  try {
    const supabase = await createServerSupabaseClient();
    const { data: updated, error } = await supabase
      .from(consultationTable)
      .update({ status: "confirmed" })
      .eq("id", consultationId)
      .eq("institution_id", institutionId)
      .eq("status", "draft")
      .select("id, content")
      .single();

    if (error) return { ok: false, message: `확정 실패: ${error.message}` };
    if (!updated) return { ok: false, message: "임시저장 상담을 찾을 수 없습니다." };

    if (shouldSendSms) {
      const smsResult = await _sendConsultationSms(consultationId, patientId, institutionId);
      if (!smsResult.ok) {
        // SMS 실패해도 확정은 유지, 메시지만 반환
        revalidatePath(`/patients/${patientId}`);
        return { ok: false, message: `확정 완료, SMS 발송 실패: ${smsResult.message}` };
      }
    }

    const patientName = await supabase
      .from("patient").select("name").eq("id", patientId).single()
      .then((r) => r.data?.name ?? "환자");

    const preview = String(updated.content).replace(/<[^>]*>/g, "").slice(0, 60);
    const admin = createAdminSupabaseClient();
    void Promise.resolve(
      admin.from("patient_account_links").select("patient_account_id").eq("patient_id", patientId).maybeSingle(),
    ).then((r) => {
      if (r.data?.patient_account_id) {
        sendPushToPatient(r.data.patient_account_id, {
          title: "새 진료 기록",
          body: `${patientName} — ${preview}`,
          url: `/portal/records`,
        }).catch(() => {});
      }
    }).catch(() => {});

    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "확정에 실패했습니다." };
  }
}

// ─── 확정된 상담에 SMS 추가 발송 ──────────────────────────────────────────────
export async function sendConsultationSms(
  consultationId: string,
  patientId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  try {
    const result = await _sendConsultationSms(consultationId, patientId, institutionId);
    if (result.ok) revalidatePath(`/patients/${patientId}`);
    return result;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "전송에 실패했습니다." };
  }
}

// ─── 임시저장 삭제 ────────────────────────────────────────────────────────────
export async function deleteDraftConsultation(
  consultationId: string,
  patientId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from(consultationTable)
      .delete()
      .eq("id", consultationId)
      .eq("institution_id", institutionId)
      .eq("status", "draft");

    if (error) return { ok: false, message: `삭제 실패: ${error.message}` };
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "삭제에 실패했습니다." };
  }
}

// ─── 상담 목록 조회 (직원용) ─────────────────────────────────────────────────
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
        chair_id: string | null;
        status: string;
        sms_sent_at: string | null;
        created_at: string;
      }>;
    }
  | { ok: false; message: string }
> {
  try {
    const institutionId = await getMyInstitutionId();
    if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from(consultationTable)
      .select("id, patient_id, content, image_urls, prescriptions, station_name, status, sms_sent_at, created_at, chair_id")
      .eq("patient_id", patientId)
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return { ok: false, message: error.message };
    return {
      ok: true,
      consultations: (data ?? []) as Array<{
        id: string;
        patient_id: string;
        content: string;
        image_urls: string[] | null;
        prescriptions: string[] | null;
        station_name: string | null;
        chair_id: string | null;
        status: string;
        sms_sent_at: string | null;
        created_at: string;
      }>,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "상담 내역 조회에 실패했습니다." };
  }
}

// ─── 상담 단건 조회 ──────────────────────────────────────────────────────────
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
        status: string;
        sms_sent_at: string | null;
        created_at: string;
      };
    }
  | { ok: false; message: string }
> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from(consultationTable)
      .select("id, patient_id, content, image_urls, prescriptions, station_name, status, sms_sent_at, created_at")
      .eq("id", consultationId)
      .maybeSingle();

    if (error) return { ok: false, message: error.message };
    if (!data) return { ok: false, message: "상담을 찾을 수 없습니다." };
    return { ok: true, consultation: data };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "상담 상세 조회에 실패했습니다." };
  }
}
