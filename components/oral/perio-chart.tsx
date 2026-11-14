"use client";

// spec 040 — 치주 차트 그림(4줄: 상악 협측·구개측, 하악 설측·협측).
// 치아는 치아 도식 라이브러리(spec 037) 2D 정면 모양 — 로컬 y=0 이 CEJ, mm 단위라 잇몸선·포켓을 실제 비율로 그린다.
//   잇몸선(빨강) = CEJ에서 퇴축만큼 뿌리 쪽 · 포켓 바닥(파랑) = 잇몸선에서 PD만큼 더 · 그 사이 = 파란 주머니.
// 인라인 속성만 쓴다(그대로 PNG로 구워 상담 기록에 담기 위해).

import { forwardRef, useMemo } from "react";
import { dims, isPatientRight, isUpper, toothShape, type Fdi } from "@/lib/dental/teeth";
import {
  MOB_LABEL,
  indexOf,
  pdColor,
  pdNum,
  rowTeeth,
  siteVal,
  surfaceVal,
  toothVal,
  type Cursor,
  type PerioData,
  type Pos,
  type Side,
} from "@/lib/oral/perio";

const K = 6; // px per mm
const GAP = 6; // 치아 사이(px)
const ROOT_SHOW = 15; // 뿌리 쪽으로 보여 줄 길이(mm)
const CROWN_SHOW = 11.5;
const NUM_BAND = 30;
const LABEL_BAND = 18;
const PAD_X = 34;

type RowSpec = { key: string; upper: boolean; side: Side; rootUp: boolean; title: string };
const ROWS: RowSpec[] = [
  { key: "UB", upper: true, side: "B", rootUp: true, title: "상악 협측" },
  { key: "UL", upper: true, side: "L", rootUp: false, title: "상악 구개측" },
  { key: "LL", upper: false, side: "L", rootUp: true, title: "하악 설측" },
  { key: "LB", upper: false, side: "B", rootUp: false, title: "하악 협측" },
];
const POS_X: Record<Pos, number> = { D: 0.3, C: 0, M: -0.3 }; // 로컬 x(×근원심 폭) — +x = 원심

export type PerioChartProps = {
  data: PerioData;
  cursor?: Cursor | null;
  /** 말로 입력·검토 전 칸 강조 */
  onSiteClick?: (t: Fdi, s: Side, p: Pos) => void;
  title?: string;
};

type Geo = {
  width: number;
  height: number;
  rows: { spec: RowSpec; top: number; cej: number; toothTop: number; toothBottom: number; numY: number; labelY: number }[];
  x: Record<Fdi, number>;
};

function layout(thirdMolars: boolean): Geo {
  const upper = rowTeeth(true, thirdMolars);
  const lower = rowTeeth(false, thirdMolars);
  const rowW = (teeth: Fdi[]) => teeth.reduce((s, t) => s + dims(t).md * K + GAP, 0);
  const inner = Math.max(rowW(upper), rowW(lower));
  const width = Math.ceil(inner + PAD_X * 2);
  const x: Record<Fdi, number> = {};
  for (const teeth of [upper, lower]) {
    let cx = width / 2 - rowW(teeth) / 2;
    for (const t of teeth) {
      const w = dims(t).md * K;
      x[t] = Math.round((cx + w / 2 + GAP / 2) * 100) / 100;
      cx += w + GAP;
    }
  }
  const toothH = (ROOT_SHOW + CROWN_SHOW) * K;
  const rows: Geo["rows"] = [];
  let y = 26;
  ROWS.forEach((spec, i) => {
    if (i === 2) y += 26; // 상·하악 사이
    if (spec.rootUp) {
      const labelY = y + 12;
      const toothTop = y + LABEL_BAND;
      const cej = toothTop + ROOT_SHOW * K;
      const toothBottom = toothTop + toothH;
      rows.push({ spec, top: y, cej, toothTop, toothBottom, numY: toothBottom + 4, labelY });
      y = toothBottom + NUM_BAND;
    } else {
      const numY = y;
      const toothTop = y + NUM_BAND;
      const cej = toothTop + CROWN_SHOW * K;
      const toothBottom = toothTop + toothH;
      rows.push({ spec, top: y, cej, toothTop, toothBottom, numY, labelY: toothBottom + 13 });
      y = toothBottom + LABEL_BAND + 4;
    }
  });
  return { width, height: Math.ceil(y + 6), rows, x };
}

export const PerioChart = forwardRef<SVGSVGElement, PerioChartProps>(function PerioChart({ data, cursor, onSiteClick, title }, ref) {
  const geo = useMemo(() => layout(data.thirdMolars), [data.thirdMolars]);
  const ix = useMemo(() => indexOf(data), [data]);
  const font = "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      width={geo.width}
      height={geo.height}
      fontFamily={font}
      style={{ maxWidth: "100%", height: "auto", userSelect: "none" }}
    >
      <rect x={0} y={0} width={geo.width} height={geo.height} fill="#ffffff" />
      {title && (
        <text x={geo.width / 2} y={16} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0f172a">
          {title}
        </text>
      )}
      {geo.rows.map(({ spec, cej, toothTop, toothBottom, numY, labelY }) => {
        const teeth = rowTeeth(spec.upper, data.thirdMolars);
        const sy = spec.rootUp ? K : -K; // 로컬 +y(치관) → 화면
        const toY = (localY: number) => cej + localY * sy;
        const rootEdgeY = spec.rootUp ? toothTop : toothBottom;
        const clipId = `clip-${spec.key}`;
        const siteX = (t: Fdi, p: Pos) => geo.x[t] + POS_X[p] * dims(t).md * K * (isPatientRight(t) ? -1 : 1);

        // 잇몸선·포켓 — 결손 치아에서 끊는다
        const groups: { t: Fdi; p: Pos; gm: number; bottom: number | null }[][] = [];
        let cur: (typeof groups)[number] = [];
        for (const t of teeth) {
          if (toothVal(ix, "state", t) === "missing") {
            if (cur.length) groups.push(cur);
            cur = [];
            continue;
          }
          const order: Pos[] = isPatientRight(t) ? ["D", "C", "M"] : ["M", "C", "D"];
          for (const p of order) {
            const rec = siteVal(ix, "rec", t, spec.side, p);
            const r = typeof rec === "number" ? rec : 0;
            const pdv = siteVal(ix, "pd", t, spec.side, p);
            const n = pdv === "F" ? dims(t).root : pdNum(pdv);
            cur.push({ t, p, gm: -r, bottom: n === null ? null : -r - n });
          }
        }
        if (cur.length) groups.push(cur);

        return (
          <g key={spec.key}>
            <defs>
              <clipPath id={clipId}>
                <rect x={0} y={toothTop} width={geo.width} height={toothBottom - toothTop} />
              </clipPath>
            </defs>
            <text x={6} y={(toothTop + toothBottom) / 2} fontSize={10} fill="#64748b" transform={`rotate(-90 6 ${(toothTop + toothBottom) / 2})`} textAnchor="middle" dy={8}>
              {spec.title}
            </text>
            <g clipPath={`url(#${clipId})`}>
              {/* 치아 */}
              {teeth.map((t) => {
                const shape = toothShape(t, "facial");
                const sx = (isPatientRight(t) ? -1 : 1) * K;
                const state = toothVal(ix, "state", t);
                const missing = state === "missing";
                const implant = state === "implant";
                return (
                  <g key={t} transform={`matrix(${sx} 0 0 ${sy} ${geo.x[t]} ${cej})`} opacity={missing ? 0.18 : 1}>
                    {shape.root && (
                      <path
                        d={shape.root}
                        fill={implant ? "#cbd5e1" : "#f1e3c8"}
                        stroke="#94a3b8"
                        strokeWidth={0.18}
                        strokeDasharray={implant ? "0.6 0.4" : undefined}
                        opacity={0.9}
                      />
                    )}
                    <path d={shape.crown} fill={implant ? "#e2e8f0" : "#fffdf7"} stroke="#94a3b8" strokeWidth={0.18} />
                  </g>
                );
              })}
              {/* 잇몸(분홍, 반투명) — 잇몸선에서 뿌리 쪽 끝까지 뿌리를 덮는다. 퇴축되면 덮이지 않은 뿌리가 드러나 보인다 */}
              {groups.map((g, gi) => {
                const pts = g.map((s) => `${siteX(s.t, s.p).toFixed(1)},${toY(s.gm).toFixed(1)}`);
                const first = g[0];
                const last = g[g.length - 1];
                const x0 = geo.x[first.t] - (dims(first.t).md * K) / 2 - GAP / 2;
                const x1 = geo.x[last.t] + (dims(last.t).md * K) / 2 + GAP / 2;
                const y0 = toY(first.gm);
                const y1 = toY(last.gm);
                return (
                  <polygon
                    key={`gum-${gi}`}
                    points={`${x0},${y0} ${pts.join(" ")} ${x1},${y1} ${x1},${rootEdgeY} ${x0},${rootEdgeY}`}
                    fill="#f9a8d4"
                    opacity={0.42}
                  />
                );
              })}
              {/* 잇몸 주머니(파랑) + 잇몸선(빨강) */}
              {groups.map((g, gi) => {
                const top = g.map((s) => `${siteX(s.t, s.p).toFixed(1)},${toY(s.gm).toFixed(1)}`);
                const segs: string[] = [];
                // 포켓은 잰 부위끼리만 잇는다
                let run: typeof g = [];
                const flush = () => {
                  if (run.length === 1) {
                    // 한 부위만 잰 곳은 좁은 띠로
                    const s0 = run[0];
                    const x = siteX(s0.t, s0.p);
                    const w = Math.max(3, dims(s0.t).md * K * 0.1);
                    segs.push(`${(x - w).toFixed(1)},${toY(s0.gm).toFixed(1)} ${(x + w).toFixed(1)},${toY(s0.gm).toFixed(1)} ${x.toFixed(1)},${toY(s0.bottom!).toFixed(1)}`);
                  } else if (run.length) {
                    const a = run.map((s) => `${siteX(s.t, s.p).toFixed(1)},${toY(s.gm).toFixed(1)}`);
                    const b = [...run].reverse().map((s) => `${siteX(s.t, s.p).toFixed(1)},${toY(s.bottom!).toFixed(1)}`);
                    segs.push([...a, ...b].join(" "));
                  }
                  run = [];
                };
                for (const s of g) {
                  if (s.bottom === null) flush();
                  else run.push(s);
                }
                flush();
                return (
                  <g key={`pk-${gi}`}>
                    {segs.map((pts, i) => (
                      <polygon key={i} points={pts} fill="#3b82f6" opacity={0.35} stroke="#2563eb" strokeWidth={1.2} />
                    ))}
                    <polyline points={top.join(" ")} fill="none" stroke="#e11d48" strokeWidth={1.6} strokeLinejoin="round" />
                  </g>
                );
              })}
              {/* CEJ 기준선(점선) */}
              <line x1={PAD_X - 6} x2={geo.width - PAD_X + 6} y1={cej} y2={cej} stroke="#94a3b8" strokeWidth={0.6} strokeDasharray="3 3" />
            </g>
            {/* 숫자·출혈·라벨·동요·치태 */}
            {teeth.map((t) => {
              const missing = toothVal(ix, "state", t) === "missing";
              const order: Pos[] = isPatientRight(t) ? ["D", "C", "M"] : ["M", "C", "D"];
              const mob = Number(toothVal(ix, "mob", t) ?? 0);
              const implant = toothVal(ix, "state", t) === "implant";
              const showToothInfo = spec.side === "B";
              return (
                <g key={`n-${t}`}>
                  <text x={geo.x[t]} y={labelY} textAnchor="middle" fontSize={10} fontWeight={600} fill={missing ? "#cbd5e1" : "#334155"}>
                    {t}
                    {implant ? "ⁱ" : ""}
                  </text>
                  {showToothInfo && mob > 0 && (
                    <text x={geo.x[t] + 13} y={labelY} fontSize={9} fontWeight={700} fill="#b91c1c">
                      {MOB_LABEL[mob]}
                    </text>
                  )}
                  {showToothInfo && !missing && (
                    <g transform={`translate(${geo.x[t] - 21} ${labelY - 8})`}>
                      {(["M", "D", "B", "L"] as const).map((f, i) =>
                        surfaceVal(ix, t, f) === true ? (
                          <rect key={f} x={(i % 2) * 4} y={Math.floor(i / 2) * 4} width={3.4} height={3.4} fill="#a16207" />
                        ) : null,
                      )}
                    </g>
                  )}
                  {!missing &&
                    order.map((p) => {
                      const pdv = siteVal(ix, "pd", t, spec.side, p);
                      const rec = siteVal(ix, "rec", t, spec.side, p);
                      const bop = siteVal(ix, "bop", t, spec.side, p) === true;
                      const x = siteX(t, p);
                      const y0 = spec.rootUp ? numY + 11 : numY + NUM_BAND - 6;
                      const yRec = spec.rootUp ? y0 + 11 : y0 - 12;
                      const isCursor = cursor && cursor.t === t && cursor.s === spec.side && cursor.p === p;
                      return (
                        <g key={p}>
                          {isCursor && <rect x={x - 6} y={Math.min(y0, yRec) - 10} width={12} height={24} rx={3} fill="#e0f2fe" stroke="#0284c7" strokeWidth={1} />}
                          {pdv !== undefined && (
                            <text x={x} y={y0} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={pdColor(pdNum(pdv))}>
                              {String(pdv)}
                            </text>
                          )}
                          {typeof rec === "number" && rec !== 0 && (
                            <text x={x} y={yRec} textAnchor="middle" fontSize={7.5} fill="#be185d">
                              {rec}
                            </text>
                          )}
                          {bop && <circle cx={x} cy={spec.rootUp ? y0 - 11 : y0 + 4} r={2.4} fill="#dc2626" />}
                        </g>
                      );
                    })}
                  {/* 클릭 영역 */}
                  {onSiteClick &&
                    !missing &&
                    order.map((p) => {
                      const w = (dims(t).md * K) / 3;
                      return (
                        <rect
                          key={`hit-${p}`}
                          x={siteX(t, p) - w / 2}
                          y={Math.min(numY, toothTop)}
                          width={w}
                          height={Math.max(toothBottom, numY + NUM_BAND) - Math.min(numY, toothTop)}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          onClick={() => onSiteClick(t, spec.side, p)}
                        />
                      );
                    })}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
});

/** 위·아래턱·면으로 화면 줄을 찾는다(편집기에서 커서 표시용) */
export function rowTitle(t: Fdi, s: Side): string {
  return ROWS.find((r) => r.upper === isUpper(t) && r.side === s)?.title ?? "";
}
