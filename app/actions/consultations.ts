"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  consultationBucket,
  consultationTable,
} from "@/lib/supabase/config";
import { getMyInstitutionId, getMyAuthorInfo } from "@/lib/auth/institution";
import { resolveResidentMatchHashForPatient } from "@/app/actions/patients";
import { revalidatePath } from "next/cache";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { sendNotification } from "@/lib/notifications";
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
): Promise<{ ok: true; mode: "draft" | "save" | "send" } | { ok: false; message: string }> {
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

    // 작성자 귀속(계약 §2.3) — 세션 멤버의 eo_employee_id·표시명을 기록.
    const { author_employee_id, author_name } = await getMyAuthorInfo();

    const { data: inserted, error } = await supabase
      .from(consultationTable)
      .insert({ patient_id: patientId, institution_id: institutionId, content: trimmed, image_urls, prescriptions, station_name, status, author_employee_id, author_name })
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
      // 알림함 적재 + Web Push 통합(spec 012)
      void sendNotification({
        title: "새 상담 기록",
        body: `${patientName} — ${preview}`,
        type: "consultation_saved",
        link: `/patients/${patientId}#consultation-${inserted.id}`,
        recipients: "all",
        institutionId,
      }).catch(() => {});

      const admin = createAdminSupabaseClient();
      void Promise.resolve(
        admin.from("patient_account_links").select("patient_account_id").eq("patient_id", patientId).maybeSingle(),
      ).then((r) => {
        if (r.data?.patient_account_id) {
          sendPushToPatient(r.data.patient_account_id, {
            title: "새 상담 기록",
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

  // 성공: redirect 대신 결과를 반환해 클라이언트가 명시적 피드백(토스트)을 보여준다.
  revalidatePath(`/patients/${patientId}`);
  const mode: "draft" | "save" | "send" =
    submitMode === "draft" ? "draft" : submitMode === "send" ? "send" : "save";
  return { ok: true, mode };
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

// ─── 확정 상담 본문 수정 (STT 오인식 등 사후 정정) ────────────────────────────
// draft 전용인 updateDraftConsultation과 달리 status 가드가 없다.
// 회의 피드백(W0): 연결된 확정 상담도 바로 편집해 덴트웹 등으로 옮기게.
export async function updateConsultationContent(
  consultationId: string,
  patientId: string,
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
      .eq("institution_id", institutionId);

    if (error) return { ok: false, message: `수정 실패: ${error.message}` };
    revalidatePath(`/patients/${patientId}`);
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
          title: "새 상담 기록",
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
      .select("id, patient_id, content, image_urls, prescriptions, station_name, status, sms_sent_at, created_at, linked_at, chair_id")
      .eq("patient_id", patientId)
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return { ok: false, message: error.message };

    // "최신에 작업한 순"으로 정렬: 마지막 작업 시각 = max(created_at, linked_at).
    // 체어 기록은 created_at이 '체어에서 녹음한 과거 시각'이라, 방금 환자에 연결해도
    // (linked_at=지금) created_at만 보면 더 최근 기록 아래로 가라앉는다. linked_at을
    // 함께 반영해 '방금 연결한 기록'이 환자 상세 최상단에 보이게 한다.
    const lastActivity = (r: { created_at: string; linked_at: string | null }) =>
      Math.max(
        new Date(r.created_at).getTime(),
        r.linked_at ? new Date(r.linked_at).getTime() : 0,
      );
    const sorted = [...(data ?? [])].sort((a, b) => lastActivity(b) - lastActivity(a));

    return {
      ok: true,
      consultations: sorted as Array<{
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

// ─── 상담 기록 통합 검색·필터 (spec 011) ─────────────────────────────────────
// 연결·미연결 상담을 함께 조회. 기관 격리·서버 권위. PII 평문 미노출(이름·차트만).
export type SearchedConsultation = {
  id: string;
  content: string;
  created_at: string;
  linked_at: string | null;
  chair_id: string | null;
  patient_id: string | null;
  patient_name: string | null;
  chart_no: string | null;
  status: string;
  prescriptions: string[] | null;
  has_audio: boolean;
  sms_sent_at: string | null;
};

export type SearchConsultationsFilters = {
  q?: string; // 본문 키워드
  status?: "all" | "linked" | "unlinked";
  chairId?: string;
  patientId?: string;
  from?: string; // ISO date
  to?: string; // ISO date
  sort?: "newest" | "oldest";
  limit?: number;
  offset?: number;
};

export async function searchConsultations(
  filters: SearchConsultationsFilters = {},
): Promise<
  | { ok: true; rows: SearchedConsultation[]; hasMore: boolean }
  | { ok: false; message: string }
> {
  try {
    const institutionId = await getMyInstitutionId();
    if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

    const limit = Math.min(Math.max(filters.limit ?? 30, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);
    const ascending = filters.sort === "oldest";

    const supabase = await createServerSupabaseClient();
    // ★ patient 임베드 조인은 관계 해석 실패 위험 → 수동 조인(activity.ts와 동일 패턴).
    let query = supabase
      .from(consultationTable)
      .select(
        "id, content, created_at, linked_at, chair_id, patient_id, status, prescriptions, audio_path, sms_sent_at",
      )
      .eq("institution_id", institutionId);

    if (filters.status === "linked") query = query.not("patient_id", "is", null);
    else if (filters.status === "unlinked") query = query.is("patient_id", null);
    if (filters.chairId) query = query.eq("chair_id", filters.chairId);
    if (filters.patientId) query = query.eq("patient_id", filters.patientId);
    if (filters.from) query = query.gte("created_at", filters.from);
    if (filters.to) query = query.lte("created_at", filters.to);
    if (filters.q && filters.q.trim()) {
      // 본문 키워드(HTML 포함 best-effort). 태그 영향 줄이려 공백 보정은 클라이언트 표시에서.
      query = query.ilike("content", `%${filters.q.trim()}%`);
    }

    const { data, error } = await query
      .order("created_at", { ascending })
      .range(offset, offset + limit); // limit+1 fetch로 hasMore 판정

    if (error) return { ok: false, message: error.message };

    const raw = (data ?? []) as unknown as Array<{
      id: string;
      content: string;
      created_at: string;
      linked_at: string | null;
      chair_id: string | null;
      patient_id: string | null;
      status: string;
      prescriptions: string[] | null;
      audio_path: string | null;
      sms_sent_at: string | null;
    }>;
    const hasMore = raw.length > limit;
    const page = raw.slice(0, limit);

    // 연결 상담의 환자명·차트번호 일괄 조회(수동 조인). PII는 이름·차트만(주민번호 등 평문 미노출).
    const patientIds = [
      ...new Set(page.map((r) => r.patient_id).filter((v): v is string => !!v)),
    ];
    const pmap = new Map<string, { name: string | null; chart_no: string | null }>();
    if (patientIds.length > 0) {
      const { data: pts } = await supabase
        .from("patient")
        .select("id, name, chart_no")
        .eq("institution_id", institutionId)
        .in("id", patientIds);
      for (const p of (pts ?? []) as Array<{ id: unknown; name: string | null; chart_no: string | null }>) {
        pmap.set(String(p.id), { name: p.name, chart_no: p.chart_no });
      }
    }

    const rows: SearchedConsultation[] = page.map((r) => ({
      id: r.id,
      content: r.content,
      created_at: r.created_at,
      linked_at: r.linked_at,
      chair_id: r.chair_id,
      patient_id: r.patient_id,
      patient_name: r.patient_id ? pmap.get(String(r.patient_id))?.name ?? null : null,
      chart_no: r.patient_id ? pmap.get(String(r.patient_id))?.chart_no ?? null : null,
      status: r.status,
      prescriptions: r.prescriptions,
      has_audio: !!r.audio_path,
      sms_sent_at: r.sms_sent_at,
    }));

    return { ok: true, rows, hasMore };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "상담 검색에 실패했습니다.",
    };
  }
}

// ─── 상담 삭제 (연결 포함, spec 011) ──────────────────────────────────────────
// deleteChairRecord는 미연결만 삭제 가능 → 연결완료 카드의 삭제용. 기관 격리·감사 로그.
export async function deleteConsultation(params: {
  consultationId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const institutionId = await getMyInstitutionId();
    if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: row } = await supabase
      .from(consultationTable)
      .select("id, chair_id, patient_id")
      .eq("id", params.consultationId)
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (!row) return { ok: false, message: "대상 상담을 찾을 수 없습니다." };

    const r = row as { chair_id: string | null; patient_id: string | null };
    // 감사 로그(체어 기록인 경우) — 데이터 손실 추적(헌법 III)
    if (r.chair_id) {
      await supabase.from("chair_audit_logs").insert({
        institution_id: institutionId,
        chair_id: r.chair_id,
        consultation_id: params.consultationId,
        event_type: "record_deleted",
        actor_user_id: user?.id ?? null,
      });
    }

    const { error } = await supabase
      .from(consultationTable)
      .delete()
      .eq("id", params.consultationId)
      .eq("institution_id", institutionId);
    if (error) return { ok: false, message: "삭제에 실패했습니다." };

    revalidatePath("/");
    if (r.patient_id) revalidatePath(`/patients/${r.patient_id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "삭제에 실패했습니다." };
  }
}
