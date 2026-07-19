"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitutionId } from "@/lib/auth/institution";
import type { TreatmentItem } from "@/lib/treatment-items";

// spec 028 치료 항목 사전 — 조회(멤버) + 관리(owner·admin). 견적 자체는 DB 저장 없음.

const COLS = "id, institution_id, name, price, display_order, active, created_at";

type Ok = { ok: true } | { ok: false; message: string };

async function requireOwnerAdmin(): Promise<
  { ok: true; institutionId: string } | { ok: false; message: string }
> {
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
    return { ok: false, message: "기관 대표 또는 관리자만 치료 항목을 관리할 수 있습니다." };
  }
  return { ok: true, institutionId };
}

/** 견적 빌더용: 현재 기관 활성 항목. 모든 직원. */
export async function getTreatmentItems(): Promise<TreatmentItem[]> {
  try {
    const institutionId = await getMyInstitutionId();
    if (!institutionId) return [];
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("treatment_items")
      .select(COLS)
      .eq("institution_id", institutionId)
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    return (data ?? []) as TreatmentItem[];
  } catch {
    return [];
  }
}

/** 관리용: 비활성 포함. owner/admin. */
export async function listTreatmentItemsForManage(): Promise<TreatmentItem[]> {
  const guard = await requireOwnerAdmin();
  if (!guard.ok) return [];
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("treatment_items")
    .select(COLS)
    .eq("institution_id", guard.institutionId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as TreatmentItem[];
}

export async function createTreatmentItem(input: {
  name: string;
  price: number;
}): Promise<{ ok: true; item: TreatmentItem } | { ok: false; message: string }> {
  const guard = await requireOwnerAdmin();
  if (!guard.ok) return guard;
  const name = input.name.trim();
  if (!name) return { ok: false, message: "항목명을 입력해 주세요." };
  const price = Math.trunc(Number(input.price) || 0);

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("treatment_items")
    .insert({ institution_id: guard.institutionId, name, price })
    .select(COLS)
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "등록에 실패했습니다." };
  revalidatePath("/settings");
  return { ok: true, item: data as TreatmentItem };
}

export async function updateTreatmentItem(
  id: string,
  patch: { name?: string; price?: number; active?: boolean; display_order?: number },
): Promise<Ok> {
  const guard = await requireOwnerAdmin();
  if (!guard.ok) return guard;
  if (patch.name !== undefined && !patch.name.trim()) {
    return { ok: false, message: "항목명을 입력해 주세요." };
  }
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("treatment_items")
    .update({
      ...patch,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.price !== undefined ? { price: Math.trunc(Number(patch.price) || 0) } : {}),
    })
    .eq("id", id)
    .eq("institution_id", guard.institutionId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteTreatmentItem(id: string): Promise<Ok> {
  const guard = await requireOwnerAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("treatment_items")
    .delete()
    .eq("id", id)
    .eq("institution_id", guard.institutionId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
