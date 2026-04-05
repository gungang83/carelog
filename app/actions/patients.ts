"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { patientTable } from "@/lib/supabase/config";
import type { PatientRow } from "@/lib/types/database";
import { revalidatePath } from "next/cache";

function escapeIlike(q: string) {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function searchPatients(
  rawQuery: string,
): Promise<{ ok: true; patients: PatientRow[] } | { ok: false; message: string }> {
  const q = rawQuery.trim();
  if (!q) {
    return { ok: true, patients: [] };
  }
  try {
    // 검색은 name, chart_no, phone 필드를 대상으로 수행
    const supabase = await createServerSupabaseClient();
    const term = `%${escapeIlike(q)}%`;
    const quoted = `"${term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    const { data, error } = await supabase
      .from(patientTable)
      .select("id, name, chart_no, phone, created_at")
      .or(`name.ilike.${quoted},chart_no.ilike.${quoted},phone.ilike.${quoted}`)
      .order("name", { ascending: true })
      .limit(50);

    if (error) {
      return { ok: false, message: error.message };
    }
    const patients = (data ?? [])
      .map((row) => {
        const r = row as any;
        // PK 컬럼명이 환경에 따라 조금 다를 수 있어(예: "ID" vs "id") 최대한 안전하게 추출합니다.
        const rawId = r?.id ?? r?.ID ?? r?.patient_id ?? r?.patientId;
        if (rawId == null) return null;
        const id = String(rawId).trim();
        // bigint(id)는 URL/쿼리로 전달되기 전에 숫자 문자열인지 강제합니다.
        if (!/^\d+$/.test(id)) return null;
        return {
          ...r,
          id,
          chart_no: r?.chart_no ?? null,
          phone: r?.phone ?? null,
        } as PatientRow;
      })
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
      .select("id, name, chart_no, phone, created_at")
      // bigint 컬럼일 경우 number로 명시적으로 맞춰줍니다.
      .eq("id", idBigint as any)
      .maybeSingle();

    if (error) {
      return { ok: false, message: error.message };
    }
    if (!data) {
      return { ok: false, message: "환자를 찾을 수 없습니다." };
    }
    return {
      ok: true,
      patient: {
        ...(data as any),
        id: (() => {
          const r = data as any;
          const rawId = r?.id ?? r?.ID ?? r?.patient_id ?? r?.patientId;
          return rawId == null ? "" : String(rawId);
        })(),
        chart_no: (data as any).chart_no ?? null,
        phone: (data as any).phone ?? null,
      } as PatientRow,
    };
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

  if (!name) {
    return { ok: false, message: "이름을 입력해 주세요." };
  }

  const phone = phoneRaw || null;
  const chartNo = chart_no || null;

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from(patientTable)
      .insert({ name, chart_no: chartNo, phone })
      .select("id, name, chart_no, phone, created_at")
      .single();

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath("/");
    return { ok: true, patient: data as PatientRow };
  } catch (e) {
    const message = e instanceof Error ? e.message : "등록에 실패했습니다.";
    return { ok: false, message };
  }
}
