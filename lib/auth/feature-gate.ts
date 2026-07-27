import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitutionId, getMyAuthorInfo } from "@/lib/auth/institution";
import { roleHasFeature, type FeatureId, FEATURE_META } from "@/lib/permissions";

// spec 029 — 서버 기능 권한 판정: 개인 오버라이드 > 역할 기본값(코드).
// 서버액션 가드 공용(기존 requireOwnerAdmin 대체).

export type FeatureGuard =
  | { ok: true; institutionId: string; userId: string; memberId: string; role: string; name: string }
  | { ok: false; message: string };

export async function requireFeature(featureId: FeatureId): Promise<FeatureGuard> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const { data: member } = await supabase
    .from("institution_members")
    .select("id, role, is_active")
    .eq("user_id", user.id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!member || !member.is_active) {
    return { ok: false, message: "기관 멤버가 아닙니다." };
  }

  // 개인 오버라이드(있으면 우선) → 역할 기본값
  let allowed = roleHasFeature(member.role, featureId);
  try {
    const admin = createAdminSupabaseClient();
    const { data: ov } = await admin
      .from("permission_overrides")
      .select("allowed")
      .eq("member_id", member.id)
      .eq("feature_id", featureId)
      .maybeSingle();
    if (ov) allowed = ov.allowed;
  } catch {
    // 테이블 미생성 등 — 역할 기본값으로 진행
  }

  if (!allowed) {
    const label = FEATURE_META.find((f) => f.id === featureId)?.label ?? featureId;
    return { ok: false, message: `'${label}' 권한이 없습니다. 관리자에게 요청해 주세요.` };
  }

  const { author_name } = await getMyAuthorInfo();
  return {
    ok: true,
    institutionId,
    userId: user.id,
    memberId: member.id,
    role: member.role,
    name: author_name ?? user.email ?? "관리자",
  };
}

/** UI 노출용 — 내 기능 허용 여부 일괄 조회(가드는 항상 서버액션에서 별도 수행). */
export async function getMyFeatureMap(): Promise<Record<string, boolean>> {
  const map: Record<string, boolean> = {};
  for (const f of FEATURE_META) {
    const r = await requireFeature(f.id);
    map[f.id] = r.ok;
  }
  return map;
}
