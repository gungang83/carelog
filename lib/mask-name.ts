/**
 * 참여자 이름 마스킹 — 환자 화면/기록 노출용.
 * 3자 이상: 앞 2자 + "*" (예: 송정훈 → 송정*)
 * 2자: 앞 1자 + "*" (예: 김민 → 김*)
 * 1자: 그대로
 */
export function maskName(name: string): string {
  const n = name.trim();
  if (n.length <= 1) return n;
  const shown = n.length <= 2 ? 1 : 2;
  return n.slice(0, shown) + "*";
}
