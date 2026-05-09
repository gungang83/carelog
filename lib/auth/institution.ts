import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { InstitutionRow } from "@/lib/types/database";

/** 현재 로그인한 사용자의 institution_id를 반환. 로그인 안 됐거나 소속 없으면 null. */
export const getMyInstitutionId = cache(async (): Promise<string | null> => {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("institution_members")
      .select("institution_id")
      .eq("user_id", user.id)
      .maybeSingle();

    return data?.institution_id ?? null;
  } catch {
    return null;
  }
});

/** 현재 로그인한 사용자의 기관 정보와 역할을 반환. */
export const getMyInstitution = cache(async (): Promise<{
  institution: InstitutionRow;
  role: "owner" | "admin" | "staff";
} | null> => {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("institution_members")
      .select("role, institutions(id, name, type, created_at)")
      .eq("user_id", user.id)
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
