import { cache } from "react";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { InstitutionRow } from "@/lib/types/database";

export const ACTIVE_INSTITUTION_COOKIE = "carelog_active_institution";

/**
 * 현재 세션 사용자 — 요청당 1회만 검증(React cache).
 * getUser()는 Supabase Auth에 토큰 검증을 왕복하므로, 대시보드 진입 시 여러 함수가
 * 각자 호출하던 중복을 dedupe해 로그인 직후 첫 화면 지연을 줄인다(카드 479B).
 */
export const getSessionUser = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export type InstitutionWithRole = {
  institution: InstitutionRow;
  role: "owner" | "admin" | "staff";
  is_active: boolean;
};

/** 현재 로그인한 사용자의 모든 기관 목록을 반환. */
export const getMyInstitutions = cache(async (): Promise<InstitutionWithRole[]> => {
  try {
    const user = await getSessionUser();
    if (!user) return [];
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("institution_members")
      .select("role, is_active, institutions(id, name, type, created_at)")
      .eq("user_id", user.id);

    if (error || !data) return [];

    return data
      .map((row) => ({
        institution: row.institutions as unknown as InstitutionRow,
        role: row.role as "owner" | "admin" | "staff",
        is_active: row.is_active,
      }))
      .filter((r) => r.institution != null);
  } catch {
    return [];
  }
});

/**
 * 현재 활성 기관 ID 반환.
 * 쿠키에 유효한 institution_id가 있고 해당 기관의 is_active=true 멤버이면 쿠키값 반환.
 * 없으면 첫 번째 기관 반환.
 */
export const getMyInstitutionId = cache(async (): Promise<string | null> => {
  try {
    const user = await getSessionUser();
    if (!user) return null;
    const supabase = await createServerSupabaseClient();

    const cookieStore = await cookies();
    const activeCookie = cookieStore.get(ACTIVE_INSTITUTION_COOKIE)?.value;

    if (activeCookie) {
      const { data } = await supabase
        .from("institution_members")
        .select("institution_id, is_active")
        .eq("user_id", user.id)
        .eq("institution_id", activeCookie)
        .maybeSingle();

      if (data && data.is_active) {
        return data.institution_id;
      }
    }

    // 쿠키 없거나 유효하지 않으면 첫 번째 활성 기관
    const { data: firstMember } = await supabase
      .from("institution_members")
      .select("institution_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    return firstMember?.institution_id ?? null;
  } catch {
    return null;
  }
});

/**
 * 현재 세션 사용자의 상담 작성자 귀속 정보(계약 §2.3).
 * institution_members의 eo_employee_id·display_name을 읽어 상담 레코드에 기록한다.
 * display_name이 없으면(공용계정/구버전 SSO) 이메일로 폴백한다.
 */
export const getMyAuthorInfo = cache(async (): Promise<{
  author_employee_id: string | null;
  author_name: string | null;
}> => {
  try {
    const institutionId = await getMyInstitutionId();
    if (!institutionId) return { author_employee_id: null, author_name: null };

    const user = await getSessionUser();
    if (!user) return { author_employee_id: null, author_name: null };
    const supabase = await createServerSupabaseClient();

    const { data } = await supabase
      .from("institution_members")
      .select("eo_employee_id, display_name")
      .eq("user_id", user.id)
      .eq("institution_id", institutionId)
      .maybeSingle();

    return {
      author_employee_id: (data?.eo_employee_id as string | null) ?? null,
      author_name:
        (data?.display_name as string | null) ?? user.email ?? null,
    };
  } catch {
    return { author_employee_id: null, author_name: null };
  }
});

/** 현재 로그인한 사용자의 기관 정보와 역할을 반환. */
export const getMyInstitution = cache(async (): Promise<{
  institution: InstitutionRow;
  role: "owner" | "admin" | "staff";
} | null> => {
  try {
    const institutionId = await getMyInstitutionId();
    if (!institutionId) return null;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("institution_members")
      .select("role, institutions(id, name, type, created_at)")
      .eq("user_id", user.id)
      .eq("institution_id", institutionId)
      .maybeSingle();

    if (!data) return null;

    const inst = data.institutions as unknown as InstitutionRow;
    if (!inst) return null;

    return {
      institution: inst,
      role: data.role as "owner" | "admin" | "staff",
    };
  } catch {
    return null;
  }
});
