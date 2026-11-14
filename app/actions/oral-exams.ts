"use server";

// spec 040 — 잇몸 기록(구강 지표 기록 회차) 저장·목록. RLS 정책 0 테이블 → 기관 멤버십 가드 후 service_role로만.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitutionId } from "@/lib/auth/institution";
import { normalizePerio, summarize, type PerioData, type PerioSummary } from "@/lib/oral/perio";

type Fail = { ok: false; message: string };

async function requireStaff(): Promise<{ ok: true; institutionId: string; email: string } | Fail> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };
  return { ok: true, institutionId, email: user.email ?? "" };
}

async function patientInInstitution(patientId: string, institutionId: string): Promise<boolean> {
  const { data } = await createAdminSupabaseClient()
    .from("patient")
    .select("id")
    .eq("id", patientId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  return !!data;
}

const TABLE_HINT = "잇몸 기록 저장소가 아직 준비되지 않았습니다(SQL oral_exams 실행 필요).";

export type OralExamListItem = { id: string; recordedAt: string; status: string; summary: PerioSummary | null; recordedBy: string | null };

export async function listOralExams(patientId: string): Promise<{ ok: true; items: OralExamListItem[] } | Fail> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const { data, error } = await createAdminSupabaseClient()
    .from("oral_exams")
    .select("id, recorded_at, status, summary, recorded_by")
    .eq("institution_id", auth.institutionId)
    .eq("patient_id", patientId)
    .eq("kind", "perio")
    .order("recorded_at", { ascending: false })
    .limit(50);
  if (error) return { ok: false, message: TABLE_HINT };
  return {
    ok: true,
    items: (data ?? []).map((r) => ({
      id: r.id as string,
      recordedAt: r.recorded_at as string,
      status: r.status as string,
      summary: (r.summary as PerioSummary) ?? null,
      recordedBy: (r.recorded_by as string) ?? null,
    })),
  };
}

export async function getOralExam(id: string): Promise<{ ok: true; id: string; recordedAt: string; data: PerioData } | Fail> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const { data, error } = await createAdminSupabaseClient()
    .from("oral_exams")
    .select("id, recorded_at, data")
    .eq("id", id)
    .eq("institution_id", auth.institutionId)
    .maybeSingle();
  if (error) return { ok: false, message: TABLE_HINT };
  if (!data) return { ok: false, message: "기록을 찾을 수 없습니다." };
  return { ok: true, id: data.id as string, recordedAt: data.recorded_at as string, data: normalizePerio(data.data) };
}

export async function saveOralExam(input: {
  id?: string | null;
  patientId: string;
  consultationId?: string | null;
  data: PerioData;
  done?: boolean;
}): Promise<{ ok: true; id: string } | Fail> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  if (!(await patientInInstitution(input.patientId, auth.institutionId))) return { ok: false, message: "환자를 찾을 수 없습니다." };
  const data = normalizePerio(input.data);
  const row = {
    institution_id: auth.institutionId,
    patient_id: input.patientId,
    consultation_id: input.consultationId ?? null,
    kind: "perio",
    status: input.done ? "done" : "draft",
    data,
    summary: summarize(data),
    updated_at: new Date().toISOString(),
  };
  const admin = createAdminSupabaseClient();
  if (input.id) {
    const { error } = await admin.from("oral_exams").update(row).eq("id", input.id).eq("institution_id", auth.institutionId);
    if (error) return { ok: false, message: `${TABLE_HINT} (${error.message})` };
    return { ok: true, id: input.id };
  }
  const { data: created, error } = await admin
    .from("oral_exams")
    .insert({ ...row, recorded_by: auth.email })
    .select("id")
    .single();
  if (error || !created) return { ok: false, message: `${TABLE_HINT} (${error?.message ?? ""})` };
  return { ok: true, id: created.id as string };
}

export async function deleteOralExam(id: string): Promise<{ ok: true } | Fail> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const { error } = await createAdminSupabaseClient().from("oral_exams").delete().eq("id", id).eq("institution_id", auth.institutionId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
