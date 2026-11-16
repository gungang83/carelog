// 플랫폼(케어로그 전체) 설정 — platform_settings 키/값. 슈퍼어드민 화면에서 바꾼다.
//   서버 전용(service_role). 60초 캐시, 저장하면 캐시 갱신. 테이블이 없으면(SQL 전) null.
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const cache = new Map<string, { at: number; value: unknown }>();

export async function getPlatformSetting<T = unknown>(key: string, fresh = false): Promise<T | null> {
  const c = cache.get(key);
  if (!fresh && c && Date.now() - c.at < 60_000) return c.value as T | null;
  let value: unknown = null;
  try {
    const { data, error } = await createAdminSupabaseClient().from("platform_settings").select("value").eq("key", key).maybeSingle();
    if (!error) value = data?.value ?? null;
  } catch {
    /* 기본값 */
  }
  cache.set(key, { at: Date.now(), value });
  return value as T | null;
}

/** 표가 준비됐는지(SQL 실행 여부) */
export async function platformSettingsReady(): Promise<boolean> {
  try {
    const { error } = await createAdminSupabaseClient().from("platform_settings").select("key").limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function setPlatformSetting(key: string, value: unknown, by: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } =
    value === null
      ? await admin.from("platform_settings").delete().eq("key", key)
      : await admin.from("platform_settings").upsert({ key, value, updated_by: by, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  cache.set(key, { at: Date.now(), value });
}
