// spec 015 — 사용량 조회 기간 해석(KST). 프리셋(days) 또는 커스텀(from/to) 지원.
//   credit_log(timestamptz)용 UTC 경계 + menu_usage_daily(day date)용 KST 일자 둘 다 제공.

export interface UsageRange {
  days: number | null; // 프리셋이면 일수, 커스텀이면 null
  dateFrom: string; // YYYY-MM-DD (KST) 시작일
  dateTo: string; // YYYY-MM-DD (KST) 종료일(포함)
  sinceIso: string; // UTC: dateFrom 00:00 KST
  untilIso: string; // UTC: dateTo 24:00 KST(=다음날 00:00, 미포함 상한)
}

function kstToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}
function shift(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  d.setTime(d.getTime() + n * 86400000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}
const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function resolveRange(params: URLSearchParams): UsageRange {
  const from = params.get("from");
  let to = params.get("to");

  if (isDate(from)) {
    if (!isDate(to)) to = from; // 단일 일자(특정 일)
    // 시작>종료면 스왑
    const [a, b] = from <= to ? [from, to] : [to, from];
    return {
      days: null,
      dateFrom: a,
      dateTo: b,
      sinceIso: new Date(`${a}T00:00:00+09:00`).toISOString(),
      untilIso: new Date(new Date(`${b}T00:00:00+09:00`).getTime() + 86400000).toISOString(),
    };
  }

  // 프리셋
  const days = Math.min(Math.max(parseInt(params.get("days") || "30", 10) || 30, 1), 3650);
  const dateTo = kstToday();
  const dateFrom = shift(dateTo, -(days - 1));
  return {
    days,
    dateFrom,
    dateTo,
    sinceIso: new Date(`${dateFrom}T00:00:00+09:00`).toISOString(),
    untilIso: new Date(new Date(`${dateTo}T00:00:00+09:00`).getTime() + 86400000).toISOString(),
  };
}
