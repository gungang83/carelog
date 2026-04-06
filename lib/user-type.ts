/**
 * 계정 유형. DB `users.user_type` 기본값과 맞춥니다.
 * Supabase Auth 연동 시 `users.id`를 `auth.users`와 연결하는 식으로 확장하세요.
 */
export const DEFAULT_USER_TYPE = "individual" as const;

export type KnownUserType =
  | typeof DEFAULT_USER_TYPE
  | "clinic"
  | "staff";

const KNOWN = new Set<string>([
  DEFAULT_USER_TYPE,
  "clinic",
  "staff",
]);

export function normalizeUserType(raw: string | null | undefined): string {
  const t = (raw ?? "").trim().toLowerCase();
  if (t && KNOWN.has(t)) return t;
  return DEFAULT_USER_TYPE;
}
