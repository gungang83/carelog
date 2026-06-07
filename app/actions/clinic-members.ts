"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyInstitutionId } from "@/lib/auth/institution";
import type { ClinicMemberRow } from "@/lib/types/database";

/**
 * 워크스페이스 클리닉 멤버(참여자) 디렉터리.
 * 체어(chairs)와 동일 패턴. 이름은 추후 EO에서 이관 예정.
 */

/** 활성 멤버 목록 — 직원 모두 조회 가능(히어로 참여자 선택용). */
export async function getClinicMembers(): Promise<ClinicMemberRow[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const institutionId = await getMyInstitutionId();
    if (!institutionId) return [];

    const { data } = await supabase
      .from("clinic_members")
      .select("*")
      .eq("institution_id", institutionId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    return (data ?? []) as ClinicMemberRow[];
  } catch {
    // 마이그레이션 미적용 등으로 테이블이 없으면 빈 목록(홈/설정이 깨지지 않도록)
    return [];
  }
}

type UpsertResult =
  | { ok: true; memberId: string }
  | { ok: false; message: string };

/** 추가/수정/활성토글 — admin/owner만. */
export async function upsertClinicMember(params: {
  id?: string;
  name: string;
  role?: string | null;
  displayOrder: number;
  isActive: boolean;
}): Promise<UpsertResult> {
  const supabase = await createServerSupabaseClient();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const { data: member } = await supabase
    .from("institution_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!member || !["admin", "owner"].includes(member.role)) {
    return { ok: false, message: "멤버 관리는 관리자만 가능합니다." };
  }

  const payload = {
    institution_id: institutionId,
    name: params.name.trim(),
    role: params.role?.trim() || null,
    display_order: params.displayOrder,
    is_active: params.isActive,
  };

  if (params.id) {
    const { data, error } = await supabase
      .from("clinic_members")
      .update(payload)
      .eq("id", params.id)
      .eq("institution_id", institutionId)
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, message: error?.message ?? "수정에 실패했습니다." };
    }
    revalidatePath("/");
    revalidatePath("/settings");
    return { ok: true, memberId: data.id };
  }

  const { data, error } = await supabase
    .from("clinic_members")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, message: error?.message ?? "추가에 실패했습니다." };
  }
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true, memberId: data.id };
}
