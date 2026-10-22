// spec 036 — 기록 템플릿(데이터 정의). 1호 = 치간칫솔 사이즈 차트.
// 처방은 상담 기록의 참고자료(대표 확정 2026-10-22): 결과는 이미지+텍스트 블록으로 기록에 담기고,
// 텍스트는 EMR 차트에 그대로 붙여넣을 수 있는 형식으로 만든다. 주문·결제·재고 연동 없음.
//
// ── 치간칫솔 라이브러리 ──
// ★정본은 EO 상품(spec-120 대표상품+옵션축+SKU)이 될 예정 — 이 파일은 그 모양에 맞춘 읽기 전용 임시본.
//   Carelog에는 편집 화면을 두지 않는다(고칠 곳이 하나여야 두 벌로 갈라지지 않는다).
//   size.label = EO 옵션값과 글자 하나까지 같아야 나중에 SKU에 연결된다(EO 계약: option_values 키·값 정확 일치).
// 규격 출처는 각 제품군 source에 기록. 확인이 덜 된 값은 비워 두고 verified=false로 표시한다.

export type BrushSize = {
  id: string;
  /** 사이즈 이름 — EO 옵션값과 동일하게 */
  label: string;
  color: string;
  /** 색 이름(제조사 표기) */
  colorName?: string;
  /** ISO 16409 사이즈 번호 */
  iso?: number;
  /** 와이어(철심) 굵기 mm */
  wireMm?: number;
  /** 모 직경(효과 직경) mm */
  brushMm?: number;
  /** 통과 구경 PHD mm */
  phdMm?: number;
  /** 사이즈별 사진 — 판매처(수완) 상품 사진을 쓸 예정. 제조사 이미지는 저작권 때문에 넣지 않는다 */
  imageUrl?: string;
  /** 이 사이즈 값 중 확인이 덜 된 것이 있으면 false */
  verified?: boolean;
};

export type BrushLine = {
  id: string;
  brand: string;
  name: string;
  /** EO 옵션축 이름(spec-120 option_types[].name) */
  optionAxis: string;
  sizes: BrushSize[];
  source: string;
};

export const BRUSH_LINES: BrushLine[] = [
  {
    id: "curaprox-cps-prime",
    brand: "큐라프록스",
    name: "CPS prime",
    optionAxis: "사이즈",
    source: "판매처 공개 상세(oralscience.com·galaxus) 2026-10-22 — 와이어·모 직경. 색: 06 파랑·07 빨강·09 노랑 확인, 08·011 미확인",
    sizes: [
      { id: "cps06", label: "CPS 06", color: "#2563eb", colorName: "파랑", wireMm: 0.6, brushMm: 2.2, verified: true },
      { id: "cps07", label: "CPS 07", color: "#dc2626", colorName: "빨강", wireMm: 0.7, brushMm: 2.5, verified: true },
      { id: "cps08", label: "CPS 08", color: "#db2777", wireMm: 0.8, brushMm: 3.2, verified: false },
      { id: "cps09", label: "CPS 09", color: "#eab308", colorName: "노랑", wireMm: 0.9, brushMm: 4.0, verified: true },
      { id: "cps011", label: "CPS 011", color: "#16a34a", wireMm: 1.1, brushMm: 5.0, verified: false },
    ],
  },
  {
    id: "tepe-original",
    brand: "TePe",
    name: "Original",
    optionAxis: "사이즈",
    source: "TePe 전문가용 사이즈 가이드(ISO 사이즈·색·와이어) 2026-10-22. PHD는 공식 자료 확인 전이라 비움",
    sizes: [
      { id: "tepe0", label: "ISO 0 핑크", color: "#f472b6", colorName: "핑크", iso: 0, wireMm: 0.4, verified: true },
      { id: "tepe1", label: "ISO 1 오렌지", color: "#f97316", colorName: "오렌지", iso: 1, wireMm: 0.45, verified: true },
      { id: "tepe2", label: "ISO 2 레드", color: "#dc2626", colorName: "레드", iso: 2, wireMm: 0.5, verified: true },
      { id: "tepe3", label: "ISO 3 블루", color: "#2563eb", colorName: "블루", iso: 3, wireMm: 0.6, verified: true },
      { id: "tepe4", label: "ISO 4 옐로", color: "#eab308", colorName: "옐로", iso: 4, wireMm: 0.7, verified: true },
      { id: "tepe5", label: "ISO 5 그린", color: "#16a34a", colorName: "그린", iso: 5, wireMm: 0.8, verified: true },
      { id: "tepe6", label: "ISO 6 퍼플", color: "#7c3aed", colorName: "퍼플", iso: 6, wireMm: 1.1, verified: true },
      { id: "tepe7", label: "ISO 7 그레이", color: "#6b7280", colorName: "그레이", iso: 7, wireMm: 1.3, verified: true },
      { id: "tepe8", label: "ISO 8 블랙", color: "#111827", colorName: "블랙", iso: 8, wireMm: 1.5, verified: true },
    ],
  },
];

/** 사이즈 규격 한 줄 요약(화면·기록 공용). 없는 값은 생략. */
export function sizeSpec(s: BrushSize): string {
  const parts: string[] = [];
  if (s.iso !== undefined) parts.push(`ISO ${s.iso}`);
  if (s.wireMm !== undefined) parts.push(`와이어 ${s.wireMm}mm`);
  if (s.brushMm !== undefined) parts.push(`모 직경 ${s.brushMm}mm`);
  if (s.phdMm !== undefined) parts.push(`통과 구경 ${s.phdMm}mm`);
  return parts.join(" · ");
}

/** 화면 왼쪽 → 오른쪽(환자 우측 → 좌측) 순서. 7-7 기준 14개 치아. */
export const UPPER_TEETH = ["17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27"];
export const LOWER_TEETH = ["47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37"];

/** 치아 사이 위치 id — "17-16" 형식(인접한 두 치아). 상하악 각 13곳, 총 26곳. */
export function gapIds(teeth: string[]): string[] {
  return teeth.slice(0, -1).map((t, i) => `${t}-${teeth[i + 1]}`);
}

/** 선택 키 = "제품군id:사이즈id" — 한 환자에게 두 제품군을 섞어 처방해도 구분된다. */
export type InterdentalResult = Record<string, string>; // gapId → `${lineId}:${sizeId}`

export type ResolvedSize = { key: string; line: BrushLine; size: BrushSize };

export function resolveKey(key: string): ResolvedSize | undefined {
  const [lineId, sizeId] = key.split(":");
  const line = BRUSH_LINES.find((l) => l.id === lineId);
  const size = line?.sizes.find((s) => s.id === sizeId);
  return line && size ? { key, line, size } : undefined;
}

/** 사이즈별 부위 목록(라이브러리 순서 유지). 비어 있는 사이즈는 제외. */
export function summarize(result: InterdentalResult) {
  const order = [...gapIds(UPPER_TEETH), ...gapIds(LOWER_TEETH)];
  const rows: (ResolvedSize & { gaps: string[] })[] = [];
  for (const line of BRUSH_LINES) {
    for (const size of line.sizes) {
      const key = `${line.id}:${size.id}`;
      const gaps = order.filter((g) => result[g] === key);
      if (gaps.length > 0) rows.push({ key, line, size, gaps });
    }
  }
  return rows;
}

/** 기록·EMR 차트에 붙여넣을 텍스트 블록. */
export function interdentalText(result: InterdentalResult, date: string): string {
  const rows = summarize(result);
  const total = rows.reduce((n, r) => n + r.gaps.length, 0);
  return [
    `[치간칫솔 처방 — ${date} · ${total}곳]`,
    ...rows.map((r) => {
      const spec = sizeSpec(r.size);
      return `${r.line.brand} ${r.line.name} · ${r.size.label}${spec ? ` (${spec})` : ""} — ${r.gaps.length}곳: ${r.gaps.join(", ")}`;
    }),
  ].join("\n");
}
