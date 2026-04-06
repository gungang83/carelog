"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { usersTable } from "@/lib/supabase/config";
import { normalizeUserType } from "@/lib/user-type";

/**
 * `users` 테이블에 계정 유형을 반영합니다. (로그인 연동 전까지는 관리·설정 화면 등에서 UUID를 넘겨 호출할 수 있습니다.)
 */
export async function upsertUserUserType(
  userId: string,
  rawUserType: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = userId.trim();
  if (!id) {
    return { ok: false, message: "사용자 ID가 필요합니다." };
  }
  const user_type = normalizeUserType(rawUserType);

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from(usersTable).upsert(
      { id, user_type },
      { onConflict: "id" },
    );
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return { ok: false, message };
  }
}
