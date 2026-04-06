/** 브라우저·서버 공통 RRN 유틸 (Node 전용 모듈 없음) */

export function residentDigitsOnly(input: string) {
  return input.replace(/\D/g, "");
}

export function normalizeFullResidentNo(input: string): string | null {
  const d = residentDigitsOnly(input);
  return d.length === 13 ? d : null;
}

export function mergeResidentNoParts(front: string, back: string): string | null {
  const f = residentDigitsOnly(front);
  const b = residentDigitsOnly(back);
  if (f.length !== 6 || b.length !== 7) return null;
  return `${f}${b}`;
}

export function formatResidentNoForList(stored: string | null | undefined): string | null {
  if (stored == null || !String(stored).trim()) return null;
  const d = normalizeFullResidentNo(String(stored)) ?? null;
  if (!d) return null;
  return `${d.slice(0, 6)}-${d.slice(6, 7)}******`;
}

export function residentNoSearchPatterns(trimmedQuery: string): string[] {
  const digits = residentDigitsOnly(trimmedQuery);
  if (!digits.length) return [];
  const set = new Set<string>([digits]);
  if (digits.length >= 6) set.add(digits.slice(0, 6));
  if (digits.length >= 7) set.add(digits.slice(0, 7));
  return [...set];
}
