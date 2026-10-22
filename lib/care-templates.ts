// spec 036 — 기록 템플릿(데이터 정의). 1호 = 치간칫솔 사이즈 차트.
// 처방은 상담 기록의 참고자료(대표 확정 2026-10-22): 결과는 이미지+텍스트 블록으로 기록에 담기고,
// 텍스트는 EMR 차트에 그대로 붙여넣을 수 있는 형식으로 만든다. 주문·결제·재고 연동 없음.

export type BrushSize = { id: string; label: string; color: string };

/** 기본 사이즈 목록 — 병원별 설정으로 옮길 수 있게 데이터로 둔다(코드에 분기 없음). */
export const DEFAULT_BRUSH_SIZES: BrushSize[] = [
  { id: "cps06", label: "CPS 06", color: "#2563eb" },
  { id: "cps07", label: "CPS 07", color: "#dc2626" },
  { id: "cps08", label: "CPS 08", color: "#db2777" },
  { id: "cps09", label: "CPS 09", color: "#eab308" },
  { id: "cps011", label: "CPS 011", color: "#16a34a" },
];

/** 화면 왼쪽 → 오른쪽(환자 우측 → 좌측) 순서. 7-7 기준 14개 치아. */
export const UPPER_TEETH = ["17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27"];
export const LOWER_TEETH = ["47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37"];

/** 치아 사이 위치 id — "17-16" 형식(인접한 두 치아). 상하악 각 13곳, 총 26곳. */
export function gapIds(teeth: string[]): string[] {
  return teeth.slice(0, -1).map((t, i) => `${t}-${teeth[i + 1]}`);
}

export type InterdentalResult = Record<string, string>; // gapId → BrushSize.id

/** 사이즈별 부위 목록(사이즈 정의 순서 유지). 비어 있는 사이즈는 제외. */
export function summarize(result: InterdentalResult, sizes: BrushSize[]) {
  const order = [...gapIds(UPPER_TEETH), ...gapIds(LOWER_TEETH)];
  return sizes
    .map((s) => ({ size: s, gaps: order.filter((g) => result[g] === s.id) }))
    .filter((r) => r.gaps.length > 0);
}

/** 기록·EMR 차트에 붙여넣을 텍스트 블록. */
export function interdentalText(result: InterdentalResult, sizes: BrushSize[], date: string): string {
  const rows = summarize(result, sizes);
  const total = rows.reduce((n, r) => n + r.gaps.length, 0);
  return [
    `[치간칫솔 처방 — ${date} · ${total}곳]`,
    ...rows.map((r) => `${r.size.label} (${r.gaps.length}곳): ${r.gaps.join(", ")}`),
  ].join("\n");
}
