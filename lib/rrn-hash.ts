import { createHash } from "node:crypto";

/**
 * 타 기관·내부 매칭용 해시. 운영 시 `RESIDENT_NO_HASH_PEPPER`를 반드시 설정하세요.
 */
export function hashResidentNoForMatching(normalized13: string): string {
  const pepper = process.env.RESIDENT_NO_HASH_PEPPER ?? "";
  return createHash("sha256")
    .update(`${pepper}::carelog_rrn_v1::${normalized13}`, "utf8")
    .digest("hex");
}
