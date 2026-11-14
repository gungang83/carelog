// Carelog 치아 엔진 — 정면(facial) 치열 차트의 배치·좌표·적중(hit) 계산. 순수 TS(화면 무관).
// 치주 차트(spec 040)가 첫 사용처이고, 기공지 치아 선택·상담 그림 등 다른 기능도 이 엔진 위에 층(layer)만 얹어 쓴다.
// 좌표 약속은 teeth.ts와 같다: 치아 로컬 y=0 = CEJ, +y = 치관(교합) 방향, 단위 mm. 화면 왼쪽 = 환자 우측.

import { archTeeth, dims, isPatientRight, type Fdi, type Matrix } from "@/lib/dental/teeth";

export type SitePos = "D" | "C" | "M"; // 원심 · 중앙 · 근심
export type FaceSide = "B" | "L"; // 협측 / 구개·설측

export type ChartRowSpec = {
  key: string;
  upper: boolean;
  side: FaceSide;
  /** 뿌리가 화면 위쪽인가(상악 협측·하악 설측 줄) */
  rootUp: boolean;
};

/** 치주 차트 표준 4줄: 상악 협측 · 상악 구개측 · 하악 설측 · 하악 협측(교합면이 줄 사이에서 마주 보게) */
export const PERIO_ROWS: ChartRowSpec[] = [
  { key: "UB", upper: true, side: "B", rootUp: true },
  { key: "UL", upper: true, side: "L", rootUp: false },
  { key: "LL", upper: false, side: "L", rootUp: true },
  { key: "LB", upper: false, side: "B", rootUp: false },
];

export type ChartOpts = {
  rows: ChartRowSpec[];
  thirdMolars?: boolean;
  /** px per mm */
  k?: number;
  /** 치아 사이(px) */
  gap?: number;
  padX?: number;
  /** 뿌리 쪽으로 보여 줄 길이(mm) */
  rootShow?: number;
  crownShow?: number;
  /** 치관 쪽 숫자 띠(px) */
  band?: number;
  /** 뿌리 쪽 끝 라벨 띠(px) */
  label?: number;
  rowGap?: number;
  jawGap?: number;
  top?: number;
};

export type ChartRow = {
  spec: ChartRowSpec;
  teeth: Fdi[];
  top: number;
  bottom: number;
  /** CEJ 화면 y */
  cej: number;
  toothTop: number;
  toothBottom: number;
  /** 치관 쪽 숫자 띠 */
  bandTop: number;
  bandBottom: number;
  /** 라벨(치아 번호) 기준선 y */
  labelY: number;
  /** 로컬 +y(치관) → 화면 y 부호·배율 */
  sy: number;
};

export type ChartGeo = {
  width: number;
  height: number;
  k: number;
  rows: ChartRow[];
  /** 치아 중심 x */
  x: Record<Fdi, number>;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function chartLayout(o: ChartOpts): ChartGeo {
  const k = o.k ?? 6;
  const gap = o.gap ?? 6;
  const padX = o.padX ?? 30;
  const rootShow = o.rootShow ?? 15;
  const crownShow = o.crownShow ?? 11.5;
  const band = o.band ?? 34;
  const label = o.label ?? 18;
  const rowGap = o.rowGap ?? 0;
  const jawGap = o.jawGap ?? 22;
  const third = o.thirdMolars ?? false;

  const jaws = [true, false].filter((u) => o.rows.some((r) => r.upper === u));
  const rowW = (teeth: Fdi[]) => teeth.reduce((s, t) => s + dims(t).md * k + gap, 0);
  const inner = Math.max(...jaws.map((u) => rowW(archTeeth(u, third))));
  const width = Math.ceil(inner + padX * 2);
  const x: Record<Fdi, number> = {};
  for (const u of jaws) {
    const teeth = archTeeth(u, third);
    let cx = width / 2 - rowW(teeth) / 2;
    for (const t of teeth) {
      const w = dims(t).md * k;
      x[t] = r2(cx + w / 2 + gap / 2);
      cx += w + gap;
    }
  }

  const toothH = (rootShow + crownShow) * k;
  const rows: ChartRow[] = [];
  let y = o.top ?? 8;
  o.rows.forEach((spec, i) => {
    if (i > 0 && spec.upper !== o.rows[i - 1].upper) y += jawGap;
    else if (i > 0) y += rowGap;
    const teeth = archTeeth(spec.upper, third);
    if (spec.rootUp) {
      const toothTop = y + label;
      const cej = toothTop + rootShow * k;
      const toothBottom = toothTop + toothH;
      rows.push({ spec, teeth, top: y, cej, toothTop, toothBottom, bandTop: toothBottom, bandBottom: toothBottom + band, labelY: y + 13, sy: k, bottom: toothBottom + band });
      y = toothBottom + band;
    } else {
      const bandTop = y;
      const toothTop = y + band;
      const cej = toothTop + crownShow * k;
      const toothBottom = toothTop + toothH;
      rows.push({ spec, teeth, top: y, cej, toothTop, toothBottom, bandTop, bandBottom: toothTop, labelY: toothBottom + 13, sy: -k, bottom: toothBottom + label });
      y = toothBottom + label;
    }
  });
  return { width, height: Math.ceil(y + 6), k, rows, x };
}

/** 치아 정면 모양을 줄에 놓는 행렬(로컬 mm → 화면) */
export function toothMatrix(geo: ChartGeo, row: ChartRow, t: Fdi): Matrix {
  return [(isPatientRight(t) ? -1 : 1) * geo.k, 0, 0, row.sy, geo.x[t], row.cej];
}

/** 부위 x — D/M은 근원심 폭의 ±30% */
export function siteX(geo: ChartGeo, t: Fdi, p: SitePos): number {
  const f = p === "D" ? 0.3 : p === "M" ? -0.3 : 0;
  return r2(geo.x[t] + f * dims(t).md * geo.k * (isPatientRight(t) ? -1 : 1));
}

/** 화면 왼→오른쪽 순서의 부위 */
export function sitesLeftToRight(t: Fdi): SitePos[] {
  return isPatientRight(t) ? ["D", "C", "M"] : ["M", "C", "D"];
}

/** CEJ 기준 mm(+ = 치관 쪽, − = 뿌리 쪽) ↔ 화면 y */
export const mmToY = (row: ChartRow, mm: number) => row.cej + mm * row.sy;
export const yToMm = (row: ChartRow, y: number) => (y - row.cej) / row.sy;

export type ChartZone = "crown" | "root" | "band" | "label";

export type ChartHit = {
  row: ChartRow;
  t: Fdi;
  p: SitePos;
  zone: ChartZone;
  /** CEJ 기준 mm(+ 치관 · − 뿌리) */
  mm: number;
  x: number;
  y: number;
};

/** 화면 점 → 치아·부위·깊이. skip(t)=true 인 치아(결손 등)는 적중하지 않는다 */
export function chartHit(geo: ChartGeo, x: number, y: number, skip?: (t: Fdi) => boolean): ChartHit | null {
  const row = geo.rows.find((r) => y >= r.top && y <= r.bottom);
  if (!row) return null;
  let best: { t: Fdi; d: number } | null = null;
  for (const t of row.teeth) {
    if (skip?.(t)) continue;
    const d = Math.abs(x - geo.x[t]);
    if (d <= (dims(t).md * geo.k) / 2 + 6 && (!best || d < best.d)) best = { t, d };
  }
  if (!best) return null;
  const t = best.t;
  const half = (dims(t).md * geo.k) / 2;
  // 치아 폭을 3등분 — 화면 왼쪽부터
  const rel = (x - (geo.x[t] - half)) / (half * 2);
  const lr = sitesLeftToRight(t);
  const p = lr[Math.max(0, Math.min(2, Math.floor(rel * 3)))];
  const mm = yToMm(row, y);
  const zone: ChartZone =
    y >= row.bandTop && y <= row.bandBottom ? "band" : y < row.toothTop || y > row.toothBottom ? "label" : mm >= 0 ? "crown" : "root";
  return { row, t, p, zone, mm, x, y };
}
