"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { patientTable } from "@/lib/supabase/config";
import type { PatientRow } from "@/lib/types/database";
import {
  escapeIlike,
  ilikeOrFragment,
  phoneSearchFragments,
} from "@/lib/patient-search";
import {
  mergeResidentNoParts,
  normalizeFullResidentNo,
  residentNoSearchPatterns,
} from "@/lib/rrn-core";
import { hashResidentNoForMatching } from "@/lib/rrn-hash";
import { revalidatePath } from "next/cache";

const PATIENT_SELECT_PUBLIC =
  "id, name, chart_no, phone, resident_no, created_at";

function mapPatientRow(row: unknown): PatientRow | null {
  const r = row as Record<string, unknown>;
  const rawId = r?.id ?? r?.ID ?? r?.patient_id ?? r?.patientId;
  if (rawId == null) return null;
  const id = String(rawId).trim();
  if (!/^\d+$/.test(id)) return null;
  return {
    id,
    name: String(r.name ?? ""),
    chart_no: r.chart_no != null ? String(r.chart_no) : null,
    phone: r.phone != null ? String(r.phone) : null,
    resident_no: r.resident_no != null ? String(r.resident_no) : null,
    created_at: String(r.created_at ?? ""),
  };
}

/** 상담 저장·외부 매칭 연동 시 환자 단위 고유 해시(주민번호 기반). */
export async function resolveResidentMatchHashForPatient(
  patientId: string,
): Promise<string | null> {
  try {
    const idBigint = BigInt(patientId);
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from(patientTable)
      .select("resident_no")
      .eq("id", idBigint as unknown as number)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { resident_no: string | null };
    const n = row.resident_no
      ? normalizeFullResidentNo(row.resident_no)
      : null;
    return n ? hashResidentNoForMatching(n) : null;
  } catch {
    return null;
  }
}

export async function searchPatients(
  rawQuery: string,
): Promise<{ ok: true; patients: PatientRow[] } | { ok: false; message: string }> {
  const q = rawQuery.trim();
  if (!q) {
    return { ok: true, patients: [] };
  }
  try {
    const supabase = await createServerSupabaseClient();
    const term = `%${escapeIlike(q)}%`;
    const orParts = new Set<string>([
      `name.${ilikeOrFragment(term)}`,
      `chart_no.${ilikeOrFragment(term)}`,
      `phone.${ilikeOrFragment(term)}`,
    ]);
    for (const frag of phoneSearchFragments(q)) {
      const phonePat = `%${escapeIlike(frag)}%`;
      orParts.add(`phone.${ilikeOrFragment(phonePat)}`);
    }
    for (const frag of residentNoSearchPatterns(q)) {
      const rrnPat = `%${escapeIlike(frag)}%`;
      orParts.add(`resident_no.${ilikeOrFragment(rrnPat)}`);
    }
    const { data, error } = await supabase
      .from(patientTable)
      .select(PATIENT_SELECT_PUBLIC)
      .or([...orParts].join(","))
      .order("name", { ascending: true })
      .limit(50);

    if (error) {
      return { ok: false, message: error.message };
    }
    const patients = (data ?? [])
      .map((row) => mapPatientRow(row))
      .filter(Boolean) as PatientRow[];

    return { ok: true, patients };
  } catch (e) {
    const message = e instanceof Error ? e.message : "검색에 실패했습니다.";
    return { ok: false, message };
  }
}

export async function getPatientById(
  id: string,
): Promise<
  { ok: true; patient: PatientRow } | { ok: false; message: string }
> {
  if (!id || id === "undefined") {
    return { ok: false, message: "환자를 찾을 수 없습니다." };
  }

  try {
    let idBigint: bigint;
    try {
      idBigint = BigInt(id);
    } catch {
      return { ok: false, message: "환자를 찾을 수 없습니다." };
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from(patientTable)
      .select(PATIENT_SELECT_PUBLIC)
      .eq("id", idBigint as unknown as number)
      .maybeSingle();

    if (error) {
      return { ok: false, message: error.message };
    }
    if (!data) {
      return { ok: false, message: "환자를 찾을 수 없습니다." };
    }
    const patient = mapPatientRow(data);
    if (!patient) {
      return { ok: false, message: "환자를 찾을 수 없습니다." };
    }
    return { ok: true, patient };
  } catch (e) {
    const message = e instanceof Error ? e.message : "조회에 실패했습니다.";
    return { ok: false, message };
  }
}

export async function createPatient(formData: FormData): Promise<
  | { ok: true; patient: PatientRow }
  | { ok: false; message: string }
> {
  const name = String(formData.get("name") ?? "").trim();
  const chart_no = String(formData.get("chart_no") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const rrnFront = String(formData.get("resident_no_front") ?? "").trim();
  const rrnBack = String(formData.get("resident_no_back") ?? "").trim();

  if (!name) {
    return { ok: false, message: "이름을 입력해 주세요." };
  }

  const phone = phoneRaw || null;
  const chartNo = chart_no || null;

  let resident_no: string | null = null;
  if (rrnFront || rrnBack) {
    const merged = mergeResidentNoParts(rrnFront, rrnBack);
    if (!merged) {
      return {
        ok: false,
        message: "주민등록번호는 앞 6자리와 뒤 7자리를 모두 올바르게 입력해 주세요.",
      };
    }
    resident_no = merged;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from(patientTable)
      .insert({
        name,
        chart_no: chartNo,
        phone,
        resident_no,
      })
      .select(PATIENT_SELECT_PUBLIC)
      .single();

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath("/");
    const patient = mapPatientRow(data);
    if (!patient) {
      return { ok: false, message: "등록 응답을 해석할 수 없습니다." };
    }
    return { ok: true, patient };
  } catch (e) {
    const message = e instanceof Error ? e.message : "등록에 실패했습니다.";
    return { ok: false, message };
  }
}

export async function updatePatient(formData: FormData): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const patientId = String(formData.get("patient_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const chart_no = String(formData.get("chart_no") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const rrnFront = String(formData.get("resident_no_front") ?? "").trim();
  const rrnBack = String(formData.get("resident_no_back") ?? "").trim();

  if (!patientId) {
    return { ok: false, message: "환자 ID가 없습니다." };
  }
  if (!name) {
    return { ok: false, message: "이름을 입력해 주세요." };
  }

  let idBigint: bigint;
  try {
    idBigint = BigInt(patientId);
  } catch {
    return { ok: false, message: "환자 ID가 올바르지 않습니다." };
  }

  const phone = phoneRaw || null;
  const chartNo = chart_no || null;

  let resident_no: string | null = null;
  if (rrnFront || rrnBack) {
    const merged = mergeResidentNoParts(rrnFront, rrnBack);
    if (!merged) {
      return {
        ok: false,
        message: "주민등록번호는 앞 6자리와 뒤 7자리를 모두 올바르게 입력해 주세요.",
      };
    }
    resident_no = merged;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const patch: Record<string, unknown> = {
      name,
      chart_no: chartNo,
      phone,
    };
    if (rrnFront || rrnBack) {
      patch.resident_no = resident_no;
    } else {
      patch.resident_no = null;
    }

    const { error } = await supabase
      .from(patientTable)
      .update(patch)
      .eq("id", idBigint as unknown as number);

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath("/");
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return { ok: false, message };
  }
}
