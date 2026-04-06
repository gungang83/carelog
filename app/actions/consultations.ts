"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  consultationBucket,
  consultationTable,
} from "@/lib/supabase/config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveConsultation(
  patientId: string,
  content: string,
  formData: FormData,
): Promise<{ ok: false; message: string } | never> {
  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, message: "상담 내용을 입력해 주세요." };
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
      // JSON 파싱 실패 시에도 상담 저장은 진행(빈 배열로 저장)
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
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from(consultationTable)
      .select(
        "id, patient_id, content, image_urls, prescriptions, station_name, created_at",
      )
      .eq("patient_id", patientId)
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
