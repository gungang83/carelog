"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitutionId, getMyAuthorInfo } from "@/lib/auth/institution";
import {
  FEATURE_META,
  roleHasFeature,
  type FeatureId,
  type MemberRole,
} from "@/lib/permissions";

// spec 029 — 기능 권한 관리(설정 → 기능 권한, owner/admin 전용).
// 개인 오버라이드(permission_overrides): 행 없음=역할 기본값 / allowed true=허용 / false=차단.

export type MemberPermissionRow = {
  memberId: string;
  email: string;
  displayName: string | null;
  role: MemberRole;
  isActive: boolean;
  features: Record<string, { state: "default" | "allow" | "deny"; roleDefault: boolean }>;
};

async function requireAdmin(): Promise<
  { ok: true; institutionId: string; name: string } | { ok: false; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };
  const { data: me } = await supabase
    .from("institution_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("institution_id", institutionId)
    .eq("is_active", true)
    .maybeSingle();
  if (!me || (me.role !== "owner" && me.role !== "admin")) {
    return { ok: false, message: "기관 대표 또는 관리자만 권한을 관리할 수 있습니다." };
  }
  const { author_name } = await getMyAuthorInfo();
  return { ok: true, institutionId, name: author_name ?? user.email ?? "관리자" };
}

/** 직원별 기능 권한 현황(오버라이드 병합). */
export async function listMemberFeaturePermissions(): Promise<MemberPermissionRow[]> {
  const guard = await requireAdmin();
  if (!guard.ok) return [];
  const admin = createAdminSupabaseClient();

  const [{ data: members }, { data: overrides }, { data: usersData }] = await Promise.all([
    admin
      .from("institution_members")
      .select("id, user_id, role, is_active, display_name")
      .eq("institution_id", guard.institutionId)
      .order("joined_at", { ascending: true }),
    admin
      .from("permission_overrides")
      .select("member_id, feature_id, allowed")
      .eq("institution_id", guard.institutionId),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const emailMap = new Map(usersData?.users.map((u) => [u.id, u.email ?? ""]) ?? []);
  const ovMap = new Map(
    ((overrides ?? []) as { member_id: string; feature_id: string; allowed: boolean }[]).map((o) => [
      `${o.member_id}:${o.feature_id}`,
      o.allowed,
    ]),
  );

  return ((members ?? []) as {
    id: string;
    user_id: string;
    role: string;
    is_active: boolean;
    display_name: string | null;
  }[]).map((m) => {
    const features: MemberPermissionRow["features"] = {};
    for (const f of FEATURE_META) {
      const ov = ovMap.get(`${m.id}:${f.id}`);
      features[f.id] = {
        state: ov === undefined ? "default" : ov ? "allow" : "deny",
        roleDefault: roleHasFeature(m.role, f.id),
      };
    }
    return {
      memberId: m.id,
      email: emailMap.get(m.user_id) ?? "(이메일 없음)",
      displayName: m.display_name,
      role: m.role as MemberRole,
      isActive: m.is_active,
      features,
    };
  });
}

/** 오버라이드 설정: 'default'=행 삭제(역할 기본값으로) / 'allow' / 'deny'. */
export async function setFeatureOverride(
  memberId: string,
  featureId: FeatureId,
  state: "default" | "allow" | "deny",
): Promise<{ ok: true } | { ok: false; message: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();

  const { data: target } = await admin
    .from("institution_members")
    .select("id")
    .eq("id", memberId)
    .eq("institution_id", guard.institutionId)
    .maybeSingle();
  if (!target) return { ok: false, message: "직원을 찾을 수 없습니다." };

  if (state === "default") {
    const { error } = await admin
      .from("permission_overrides")
      .delete()
      .eq("member_id", memberId)
      .eq("feature_id", featureId);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await admin.from("permission_overrides").upsert(
      {
        institution_id: guard.institutionId,
        member_id: memberId,
        feature_id: featureId,
        allowed: state === "allow",
        granted_by: guard.name,
      },
      { onConflict: "member_id,feature_id" },
    );
    if (error) return { ok: false, message: error.message };
  }
  revalidatePath("/settings");
  return { ok: true };
}
