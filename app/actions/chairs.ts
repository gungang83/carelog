"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  getMyInstitutionId,
  getMyAuthorInfo,
  getMyInstitutionLab,
} from "@/lib/auth/institution";
import { revalidatePath } from "next/cache";
import { sanitizeRichHtml, ensureHtml } from "@/lib/sanitize-html";
import type { ChairRow, Participant } from "@/lib/types/database";
import { transcribeEngine } from "@/app/actions/transcribe";
import type { EngineMode, EngineTranscribeResult } from "@/lib/transcribe/engines";
import { sendPushToInstitution } from "@/app/actions/push";

// ─── transcribeChairAudio ─────────────────────────────────────────────────────
// Server Action 파일 간 임포트 — client component는 이 파일만 참조.
// 실험실(lab_enabled) 워크스페이스만 mode 선택 가능 — 비-lab은 'basic' 강제(사고 차단).
export async function transcribeChairAudio(
  formData: FormData,
  mode: EngineMode = "basic",
): Promise<EngineTranscribeResult> {
  const lab = await getMyInstitutionLab();
  const effective: EngineMode = lab ? mode : "basic";
  return transcribeEngine(formData, effective);
}

// ─── getChairs ────────────────────────────────────────────────────────────────
export async function getChairs(): Promise<ChairRow[]> {
  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return [];

  const { data } = await supabase
    .from("chairs")
    .select("*")
    .eq("institution_id", institutionId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  return (data ?? []) as ChairRow[];
}

// ─── getRecentParticipants ────────────────────────────────────────────────────
/**
 * 최근 상담 기록의 참여자에서 distinct(name) 후보를 최근 등장순으로 반환.
 * 참여자 피커 "최근 함께한 사람" 노출용. 읽기 전용·비차단(실패 시 빈 배열).
 */
export async function getRecentParticipants(limit = 8): Promise<Participant[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const institutionId = await getMyInstitutionId();
    if (!institutionId) return [];

    const { data } = await supabase
      .from("consultation")
      .select("participants, created_at")
      .eq("institution_id", institutionId)
      .not("participants", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    const seen = new Set<string>();
    const recent: Participant[] = [];
    for (const row of (data ?? []) as { participants: Participant[] | null }[]) {
      for (const p of row.participants ?? []) {
        if (!p?.name || seen.has(p.name)) continue;
        seen.add(p.name);
        recent.push({ id: p.id, name: p.name, role: p.role ?? null });
        if (recent.length >= limit) return recent;
      }
    }
    return recent;
  } catch {
    return [];
  }
}

// ─── saveChairRecord ──────────────────────────────────────────────────────────
type SaveChairRecordResult =
  | { ok: true; consultationId: string }
  | { ok: false; message: string };

export async function saveChairRecord(params: {
  chairId: string;
  content: string;
  prescriptions?: string[];
  participants?: { id: string; name: string; role: string | null }[];
  transcriptionEngine?: string | null;
}): Promise<SaveChairRecordResult> {
  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  // 체어가 해당 기관 소속인지 확인
  const { data: chair } = await supabase
    .from("chairs")
    .select("id, name")
    .eq("id", params.chairId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!chair) return { ok: false, message: "유효하지 않은 체어입니다." };

  // 전사 평문은 줄바꿈 보존을 위해 HTML로 정규화 후 sanitize
  const sanitized = sanitizeRichHtml(ensureHtml(params.content));

  // 작성자 귀속(계약 §2.3) — 체어 즉시기록도 작성자를 남긴다.
  const { author_employee_id, author_name } = await getMyAuthorInfo();

  const { data: consultation, error } = await supabase
    .from("consultation")
    .insert({
      institution_id: institutionId,
      patient_id: null,
      chair_id: params.chairId,
      content: sanitized,
      prescriptions: params.prescriptions ?? [],
      participants: params.participants ?? [],
      status: "draft",
      author_employee_id,
      author_name,
      transcription_engine: params.transcriptionEngine ?? null,
    })
    .select("id")
    .single();

  if (error || !consultation) {
    console.error("[saveChairRecord] insert 실패:", error?.message, error?.details);
    return { ok: false, message: `기록 저장에 실패했습니다. (${error?.message ?? "원인 미상"})` };
  }

  await supabase.from("chair_audit_logs").insert({
    institution_id: institutionId,
    chair_id: params.chairId,
    consultation_id: consultation.id,
    event_type: "record_created",
    actor_user_id: user.id,
  });

  // 화면 꺼짐/백그라운드 기기 대비 Web Push (spec 007 US3) — fire-and-forget(저장 결과 비차단).
  // 환자정보·진료내용은 싣지 않는다(체어 이름 + 도착 사실만).
  sendPushToInstitution(institutionId, {
    title: "새 상담 기록",
    body: `${chair.name} · 상담 기록이 올라왔습니다`,
    url: "/",
    kind: "chair-record",
  }).catch(() => {});

  revalidatePath("/");
  return { ok: true, consultationId: consultation.id };
}

// ─── updateChairRecordContent ─────────────────────────────────────────────────
type UpdateChairRecordContentResult = { ok: true } | { ok: false; message: string };

export async function updateChairRecordContent(params: {
  consultationId: string;
  content: string;
  prescriptions?: string[];
}): Promise<UpdateChairRecordContentResult> {
  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  // 미연결 기록인지 + 소속 기관인지 확인
  const { data: existing } = await supabase
    .from("consultation")
    .select("id, chair_id")
    .eq("id", params.consultationId)
    .eq("institution_id", institutionId)
    .is("patient_id", null)
    .maybeSingle();

  if (!existing) return { ok: false, message: "수정 권한이 없거나 이미 연결된 기록입니다." };

  const sanitized = sanitizeRichHtml(ensureHtml(params.content));

  const { error } = await supabase
    .from("consultation")
    .update({ content: sanitized, prescriptions: params.prescriptions ?? [] })
    .eq("id", params.consultationId);

  if (error) return { ok: false, message: "기록 수정에 실패했습니다." };

  await supabase.from("chair_audit_logs").insert({
    institution_id: institutionId,
    chair_id: existing.chair_id,
    consultation_id: params.consultationId,
    event_type: "record_edited",
    actor_user_id: user.id,
  });

  revalidatePath("/");
  return { ok: true };
}

// ─── getAllUnlinkedRecords ────────────────────────────────────────────────────
// 모든 체어의 미연결 기록을 통합 조회 (홈 화면 인라인 섹션용)
export type AllUnlinkedRecord = {
  id: string;
  content: string;
  created_at: string;
  chair_id: string;
  prescriptions: string[] | null;
  /** 음성 원본 보관 여부(spec 009) — 재청취 버튼 노출 게이트. */
  has_audio: boolean;
};

export async function getAllUnlinkedRecords(): Promise<AllUnlinkedRecord[]> {
  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return [];

  const { data } = await supabase
    .from("consultation")
    .select("id, content, created_at, chair_id, prescriptions, audio_path")
    .eq("institution_id", institutionId)
    .is("patient_id", null)
    .not("chair_id", "is", null)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    content: r.content as string,
    created_at: r.created_at as string,
    chair_id: r.chair_id as string,
    prescriptions: r.prescriptions as string[] | null,
    has_audio: !!(r.audio_path as string | null),
  }));
}

// ─── unlinkChairRecord ────────────────────────────────────────────────────────
// 연결된 체어 기록을 미연결 상태로 되돌리기 (잘못 연결한 경우 복구)
type UnlinkChairRecordResult = { ok: true } | { ok: false; message: string };

export async function unlinkChairRecord(params: {
  consultationId: string;
}): Promise<UnlinkChairRecordResult> {
  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  // 체어에서 온 기록인지 + 현재 연결된 환자 확인
  const { data: consultation } = await supabase
    .from("consultation")
    .select("id, chair_id, patient_id")
    .eq("id", params.consultationId)
    .eq("institution_id", institutionId)
    .not("chair_id", "is", null)
    .maybeSingle();

  if (!consultation) return { ok: false, message: "대상 기록을 찾을 수 없습니다." };

  const prevPatientId = consultation.patient_id as number | null;

  const { error } = await supabase
    .from("consultation")
    .update({
      patient_id: null,
      status: "draft",
      linked_at: null,
      linked_by: null,
    })
    .eq("id", params.consultationId);

  if (error) return { ok: false, message: "연결 해제에 실패했습니다." };

  await supabase.from("chair_audit_logs").insert({
    institution_id: institutionId,
    chair_id: consultation.chair_id,
    consultation_id: params.consultationId,
    event_type: "patient_unlinked",
    actor_user_id: user.id,
    patient_id_before: prevPatientId,
    patient_id_after: null,
  });

  if (prevPatientId) revalidatePath(`/patients/${prevPatientId}`);
  revalidatePath("/");
  return { ok: true };
}

// ─── relinkChairRecord ────────────────────────────────────────────────────────
// 잘못 연결된 체어 기록을 다른 환자로 재연결
type RelinkChairRecordResult = { ok: true } | { ok: false; message: string };

export async function relinkChairRecord(params: {
  consultationId: string;
  newPatientId: number;
}): Promise<RelinkChairRecordResult> {
  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const { data: consultation } = await supabase
    .from("consultation")
    .select("id, chair_id, patient_id")
    .eq("id", params.consultationId)
    .eq("institution_id", institutionId)
    .not("chair_id", "is", null)
    .maybeSingle();

  if (!consultation) return { ok: false, message: "대상 기록을 찾을 수 없습니다." };

  const { data: newPatient } = await supabase
    .from("patient")
    .select("id")
    .eq("id", params.newPatientId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!newPatient) return { ok: false, message: "유효하지 않은 환자입니다." };

  const prevPatientId = consultation.patient_id as number | null;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("consultation")
    .update({
      patient_id: params.newPatientId,
      status: "confirmed",
      linked_at: now,
      linked_by: user.id,
    })
    .eq("id", params.consultationId);

  if (error) return { ok: false, message: "재연결에 실패했습니다." };

  await supabase.from("chair_audit_logs").insert({
    institution_id: institutionId,
    chair_id: consultation.chair_id,
    consultation_id: params.consultationId,
    event_type: "patient_relinked",
    actor_user_id: user.id,
    patient_id_before: prevPatientId,
    patient_id_after: params.newPatientId,
  });

  if (prevPatientId) revalidatePath(`/patients/${prevPatientId}`);
  revalidatePath(`/patients/${params.newPatientId}`);
  revalidatePath("/");
  return { ok: true };
}

// ─── getUnlinkedChairRecords ──────────────────────────────────────────────────
type UnlinkedRecord = { id: string; content: string; created_at: string };

export async function getUnlinkedChairRecords(
  chairId: string,
): Promise<UnlinkedRecord[]> {
  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return [];

  const { data } = await supabase
    .from("consultation")
    .select("id, content, created_at")
    .eq("chair_id", chairId)
    .eq("institution_id", institutionId)
    .is("patient_id", null)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    content:
      typeof r.content === "string" && r.content.length > 200
        ? r.content.slice(0, 200) + "…"
        : (r.content as string),
    created_at: r.created_at as string,
  }));
}

// ─── linkChairRecordToPatient ─────────────────────────────────────────────────
type LinkChairRecordResult = { ok: true } | { ok: false; message: string };

export async function linkChairRecordToPatient(params: {
  consultationId: string;
  patientId: number;
}): Promise<LinkChairRecordResult> {
  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  // 미연결 기록 확인
  const { data: consultation } = await supabase
    .from("consultation")
    .select("id, chair_id")
    .eq("id", params.consultationId)
    .eq("institution_id", institutionId)
    .is("patient_id", null)
    .maybeSingle();

  if (!consultation) return { ok: false, message: "연결 가능한 기록이 없습니다." };

  // 환자가 같은 기관 소속인지 확인
  const { data: patient } = await supabase
    .from("patient")
    .select("id")
    .eq("id", params.patientId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!patient) return { ok: false, message: "유효하지 않은 환자입니다." };

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("consultation")
    .update({
      patient_id: params.patientId,
      status: "confirmed",
      linked_at: now,
      linked_by: user.id,
    })
    .eq("id", params.consultationId);

  if (error) return { ok: false, message: "환자 연결에 실패했습니다." };

  await supabase.from("chair_audit_logs").insert({
    institution_id: institutionId,
    chair_id: consultation.chair_id,
    consultation_id: params.consultationId,
    event_type: "patient_linked",
    actor_user_id: user.id,
    patient_id_before: null,
    patient_id_after: params.patientId,
  });

  revalidatePath(`/patients/${params.patientId}`);
  revalidatePath("/");
  return { ok: true };
}

// ─── deleteChairRecord ────────────────────────────────────────────────────────
type DeleteChairRecordResult = { ok: true } | { ok: false; message: string };

export async function deleteChairRecord(params: {
  consultationId: string;
}): Promise<DeleteChairRecordResult> {
  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const { data: consultation } = await supabase
    .from("consultation")
    .select("id, chair_id")
    .eq("id", params.consultationId)
    .eq("institution_id", institutionId)
    .is("patient_id", null)
    .maybeSingle();

  if (!consultation) return { ok: false, message: "삭제 권한이 없거나 이미 연결된 기록입니다." };

  // 감사 로그 먼저 삽입 (삭제 전에)
  await supabase.from("chair_audit_logs").insert({
    institution_id: institutionId,
    chair_id: consultation.chair_id,
    consultation_id: params.consultationId,
    event_type: "record_deleted",
    actor_user_id: user.id,
  });

  const { error } = await supabase
    .from("consultation")
    .delete()
    .eq("id", params.consultationId);

  if (error) return { ok: false, message: "기록 삭제에 실패했습니다." };

  revalidatePath("/");
  return { ok: true };
}

// ─── searchPatientsForChair ───────────────────────────────────────────────────
type PatientSearchResult = {
  id: number;
  name: string;
  chart_no: string | null;
  phone: string | null;
};

export async function searchPatientsForChair(
  query: string,
): Promise<PatientSearchResult[]> {
  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return [];

  const q = query.trim();
  if (!q) return [];

  const { data } = await supabase
    .from("patient")
    .select("id, name, chart_no, phone")
    .eq("institution_id", institutionId)
    .or(`name.ilike.%${q}%,chart_no.ilike.%${q}%`)
    .order("name", { ascending: true })
    .limit(20);

  return (data ?? []) as PatientSearchResult[];
}

// ─── createPatientAndLink ─────────────────────────────────────────────────────
// 환자 프로필 신규 생성 후 체어 기록에 즉시 연결 (이름만 필수)
type CreatePatientAndLinkResult =
  | { ok: true; patientId: number }
  | { ok: false; message: string };

export async function createPatientAndLink(params: {
  consultationId: string;
  name: string;
  chartNo?: string;
  phone?: string;
}): Promise<CreatePatientAndLinkResult> {
  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const name = params.name.trim();
  if (!name) return { ok: false, message: "이름을 입력해 주세요." };

  // 미연결 기록 확인
  const { data: consultation } = await supabase
    .from("consultation")
    .select("id, chair_id")
    .eq("id", params.consultationId)
    .eq("institution_id", institutionId)
    .is("patient_id", null)
    .maybeSingle();

  if (!consultation) return { ok: false, message: "연결 가능한 기록이 없습니다." };

  // 환자 생성
  const { data: patient, error: patientError } = await supabase
    .from("patient")
    .insert({
      institution_id: institutionId,
      name,
      chart_no: params.chartNo?.trim() || null,
      phone: params.phone?.trim() || null,
    })
    .select("id")
    .single();

  if (patientError || !patient) {
    return { ok: false, message: "환자 등록에 실패했습니다." };
  }

  const patientId = patient.id as number;
  const now = new Date().toISOString();

  // 기록 연결
  const { error: linkError } = await supabase
    .from("consultation")
    .update({
      patient_id: patientId,
      status: "confirmed",
      linked_at: now,
      linked_by: user.id,
    })
    .eq("id", params.consultationId);

  if (linkError) return { ok: false, message: "환자 연결에 실패했습니다." };

  await supabase.from("chair_audit_logs").insert({
    institution_id: institutionId,
    chair_id: consultation.chair_id,
    consultation_id: params.consultationId,
    event_type: "patient_linked",
    actor_user_id: user.id,
    patient_id_before: null,
    patient_id_after: patientId,
  });

  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/");
  return { ok: true, patientId };
}

// ─── getOrCreateChairByName ───────────────────────────────────────────────────
// 이름으로 체어 조회 — 없으면 생성 (직접 입력 위치용)
type GetOrCreateChairResult =
  | { ok: true; chairId: string }
  | { ok: false; message: string };

export async function getOrCreateChairByName(
  name: string,
): Promise<GetOrCreateChairResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "위치 이름을 입력해 주세요." };

  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  // 기존 체어 조회
  const { data: existing } = await supabase
    .from("chairs")
    .select("id")
    .eq("institution_id", institutionId)
    .eq("name", trimmed)
    .maybeSingle();

  if (existing) return { ok: true, chairId: existing.id as string };

  // 없으면 admin client로 생성 (staff가 현장에서 위치 추가 허용)
  const admin = createAdminSupabaseClient();
  const { data: last } = await supabase
    .from("chairs")
    .select("display_order")
    .eq("institution_id", institutionId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((last?.display_order as number | null) ?? -1) + 1;

  const { data, error } = await admin
    .from("chairs")
    .insert({ institution_id: institutionId, name: trimmed, display_order: nextOrder })
    .select("id")
    .single();

  if (error || !data) return { ok: false, message: "위치 생성에 실패했습니다." };

  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true, chairId: data.id as string };
}

// ─── upsertChair ─────────────────────────────────────────────────────────────
type UpsertChairResult = { ok: true; chairId: string } | { ok: false; message: string };

export async function upsertChair(params: {
  id?: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}): Promise<UpsertChairResult> {
  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  // admin/owner 권한 확인
  const { data: member } = await supabase
    .from("institution_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!member || !["admin", "owner"].includes(member.role)) {
    return { ok: false, message: "체어 관리는 관리자만 가능합니다." };
  }

  const payload = {
    institution_id: institutionId,
    name: params.name.trim(),
    display_order: params.displayOrder,
    is_active: params.isActive,
  };

  let chairId: string;

  if (params.id) {
    const { data, error } = await supabase
      .from("chairs")
      .update(payload)
      .eq("id", params.id)
      .eq("institution_id", institutionId)
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: "체어 수정에 실패했습니다." };
    chairId = data.id as string;
  } else {
    const { data, error } = await supabase
      .from("chairs")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: "체어 추가에 실패했습니다." };
    chairId = data.id as string;
  }

  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true, chairId };
}
