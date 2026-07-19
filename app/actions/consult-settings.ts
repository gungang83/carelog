"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitutionId } from "@/lib/auth/institution";
import {
  DEFAULT_CONSULT_SETTINGS,
  parseConsultSettings,
  type ConsultSettings,
} from "@/lib/consult-settings";

// spec 027 — 상담 세션 안전망 설정 읽기(멤버)·수정(owner/admin).

/** 현재 기관 설정(기본값 병합). 실패 시 기본값 — 가드는 항상 동작한다. */
export async function getConsultSettings(): Promise<ConsultSettings> {
  try {
    const institutionId = await getMyInstitutionId();
    if (!institutionId) return DEFAULT_CONSULT_SETTINGS;
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("institutions")
      .select("consult_settings")
      .eq("id", institutionId)
      .maybeSingle();
    return parseConsultSettings(data?.consult_settings);
  } catch {
    return DEFAULT_CONSULT_SETTINGS;
  }
}

export async function updateConsultSettings(
  input: Partial<ConsultSettings>,
): Promise<{ ok: true; settings: ConsultSettings } | { ok: false; message: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const { data: member } = await supabase
    .from("institution_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("institution_id", institutionId)
    .eq("is_active", true)
    .maybeSingle();
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return { ok: false, message: "기관 대표 또는 관리자만 설정할 수 있습니다." };
  }

  const current = await getConsultSettings();
  const next = parseConsultSettings({ ...current, ...input });

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("institutions")
    .update({ consult_settings: next })
    .eq("id", institutionId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/settings");
  return { ok: true, settings: next };
}
