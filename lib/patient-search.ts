/** ILIKE 메타문자 이스케이프 */
export function escapeIlike(q: string) {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** PostgREST .or()용 ilike 우항 (와일드카드 포함, 따옴표 이스케이프) */
export function ilikeOrFragment(innerWithWildcards: string) {
  const wrapped = `"${innerWithWildcards.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return `ilike.${wrapped}`;
}

/** 검색 결과 목록용 연락처 표시 (중간 자리 마스킹) */
export function formatPhoneForList(phone: string | null | undefined): string | null {
  const raw = phone?.trim();
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-***-${d.slice(-4)}`;
  return raw;
}

/** 전화번호 검색용: 입력에서 숫자만 추출 후 ilike 패턴 후보 */
export function phoneSearchFragments(trimmedQuery: string): string[] {
  const digits = trimmedQuery.replace(/\D/g, "");
  const out = new Set<string>();
  if (digits.length >= 4) out.add(digits.slice(-4));
  if (digits.length === 11) {
    out.add(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
    out.add(digits);
  } else if (digits.length === 10) {
    out.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
    out.add(digits);
  } else if (digits.length > 0 && digits.length < 10) {
    out.add(digits);
  }
  return [...out];
}
