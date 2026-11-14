"use client";

// spec 040 — 잇몸 기록 층(layer). 치아 엔진(DentalChart) 위에 잇몸·주머니·눈금·숫자만 얹는다.
//   잇몸 = 뿌리를 덮는 반투명 분홍(퇴축되면 뿌리가 드러남) · 잇몸선 = 빨강 · 주머니 = 깊이 색 막대(자라나는 움직임)
//   마우스를 올리면 그 부위에 mm 눈금이 펼쳐지고, 포인터 높이 = 깊이 미리보기.

import { forwardRef, useMemo } from "react";
import { DentalChart, type ChartPointer } from "@/components/dental/dental-chart";
import { dims, isUpper, type Fdi } from "@/lib/dental/teeth";
import { mmToY, siteX, sitesLeftToRight, type ChartGeo, type ChartHit, type ChartRow } from "@/lib/dental/chart";
import {
  MOB_LABEL,
  entryKey,
  indexOf,
  pdColor,
  pdNum,
  siteVal,
  surfaceVal,
  toothVal,
  type Cursor,
  type MeasureId,
  type MeasureValue,
  type PerioData,
  type Pos,
  type Surface,
} from "@/lib/oral/perio";

export type PerioHover = { hit: ChartHit; value: MeasureValue | null } | null;

type Props = {
  geo: ChartGeo;
  data: PerioData;
  mode: MeasureId;
  cursor?: Cursor | null;
  hover?: PerioHover;
  /** 방금 바뀐 칸(톡 튀는 움직임) */
  flash?: string | null;
  touch?: boolean;
  exporting?: boolean;
  onPointer?: (e: ChartPointer) => void;
  title?: string;
};

/** 정면 줄의 부위 → 치태 면(D·M은 그대로, 가운데는 그 줄의 면) */
export const plaqueSurface = (p: Pos, side: "B" | "L"): Surface => (p === "C" ? side : p);

export const PerioChart = forwardRef<SVGSVGElement, Props>(function PerioChart(
  { geo, data, mode, cursor, hover, flash, touch, exporting, onPointer, title },
  ref,
) {
  const ix = useMemo(() => indexOf(data), [data]);
  const missing = (t: Fdi) => toothVal(ix, "state", t) === "missing";
  const k = geo.k;
  const live = !exporting;

  const recAt = (t: Fdi, row: ChartRow, p: Pos) => {
    if (live && mode === "rec" && hover?.hit.t === t && hover.hit.p === p && hover.hit.row === row && typeof hover.value === "number") return hover.value;
    const r = siteVal(ix, "rec", t, row.spec.side, p);
    return typeof r === "number" ? r : 0;
  };

  const over = (row: ChartRow) => {
    const side = row.spec.side;
    const edge = row.spec.rootUp ? row.toothTop : row.toothBottom;
    // 잇몸선 — 결손 치아에서 끊는다
    const groups: { t: Fdi; p: Pos }[][] = [];
    let cur: { t: Fdi; p: Pos }[] = [];
    for (const t of row.teeth) {
      if (missing(t)) {
        if (cur.length) groups.push(cur);
        cur = [];
        continue;
      }
      for (const p of sitesLeftToRight(t)) cur.push({ t, p });
    }
    if (cur.length) groups.push(cur);
    const gy = (t: Fdi, p: Pos) => mmToY(row, -recAt(t, row, p));
    const hv = live && hover && hover.hit.row === row ? hover : null;

    return (
      <>
        {groups.map((g, i) => {
          const first = g[0];
          const last = g[g.length - 1];
          const x0 = geo.x[first.t] - (dims(first.t).md * k) / 2 - 3;
          const x1 = geo.x[last.t] + (dims(last.t).md * k) / 2 + 3;
          const pts = g.map((s) => `${siteX(geo, s.t, s.p)},${gy(s.t, s.p).toFixed(1)}`).join(" ");
          return (
            <g key={`gum-${i}`}>
              <polygon points={`${x0},${gy(first.t, first.p).toFixed(1)} ${pts} ${x1},${gy(last.t, last.p).toFixed(1)} ${x1},${edge} ${x0},${edge}`} fill="#f9a8d4" opacity={0.4} />
              <polyline points={pts} fill="none" stroke="#e11d48" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        <line x1={0} x2={geo.width} y1={row.cej} y2={row.cej} stroke="#94a3b8" strokeWidth={0.6} strokeDasharray="3 3" />

        {/* 주머니 막대 — 잇몸선에서 깊이만큼(깊이 색) */}
        {row.teeth.flatMap((t) =>
          missing(t)
            ? []
            : sitesLeftToRight(t).map((p) => {
                const v = siteVal(ix, "pd", t, side, p);
                const n = v === "F" ? dims(t).root : pdNum(v);
                if (n === null || n === 0) return null;
                const y0 = gy(t, p);
                const y1 = mmToY(row, -recAt(t, row, p) - n);
                const w = Math.max(5, dims(t).md * k * 0.2);
                const key = entryKey({ m: "pd", t, s: side, p });
                return (
                  <rect
                    key={`${key}-${String(v)}`}
                    className={live ? "perio-grow" : undefined}
                    style={{ transformOrigin: row.spec.rootUp ? "50% 100%" : "50% 0%" }}
                    x={siteX(geo, t, p) - w / 2}
                    y={Math.min(y0, y1)}
                    width={w}
                    height={Math.abs(y1 - y0)}
                    rx={w / 2}
                    fill={pdColor(pdNum(v))}
                    opacity={0.62}
                  />
                );
              }),
        )}

        {/* 마우스를 올린 부위 — 기둥 강조 + mm 눈금(포인터 근처 숫자가 커진다) + 미리보기 */}
        {hv && (mode === "pd" || mode === "rec") && (() => {
          const { t, p } = hv.hit;
          const x = siteX(geo, t, p);
          const w = (dims(t).md * k) / 3;
          const gm = -recAt(t, row, p);
          const marks = mode === "pd" ? [...Array(16).keys()] : [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
          const cur = typeof hv.value === "number" ? hv.value : hv.value === "F" ? 16 : null;
          const yOf = (n: number) => (mode === "pd" ? mmToY(row, gm - n) : mmToY(row, -n));
          const prevN = mode === "pd" && cur !== null ? (hv.value === "F" ? dims(t).root : cur) : null;
          return (
            <g pointerEvents="none">
              <rect x={x - w / 2} y={row.toothTop} width={w} height={row.toothBottom - row.toothTop} fill="#0ea5e9" opacity={0.08} />
              {prevN !== null && prevN > 0 && (
                <rect
                  x={x - Math.max(5, dims(t).md * k * 0.2) / 2}
                  y={Math.min(mmToY(row, gm), mmToY(row, gm - prevN))}
                  width={Math.max(5, dims(t).md * k * 0.2)}
                  height={Math.abs(mmToY(row, gm - prevN) - mmToY(row, gm))}
                  rx={3}
                  fill={pdColor(prevN)}
                  opacity={0.35}
                  stroke={pdColor(prevN)}
                  strokeDasharray="3 2"
                />
              )}
              {marks.map((n) => {
                const y = yOf(n);
                if (y < row.toothTop || y > row.toothBottom) return null;
                const d = cur === null ? 9 : Math.abs(n - cur);
                const size = 7 + Math.max(0, 6 - d * 2.4);
                const on = cur === n;
                // 숫자는 지금 값 + 3mm 간격만(지금 값 바로 옆은 비움) — 1mm마다 다 쓰면 겹친다
                const showNum = on || (n % 3 === 0 && d >= 2);
                return (
                  <g key={n}>
                    <line x1={x + w / 2 - (n % 3 === 0 ? 6 : 3)} x2={x + w / 2} y1={y} y2={y} stroke="#0284c7" strokeWidth={on ? 1.8 : 0.8} />
                    {showNum && (
                      <text x={x + w / 2 + 3} y={y + size / 3} fontSize={size} fontWeight={on ? 800 : 600} fill={on ? "#0369a1" : "#64748b"} opacity={d > 2 ? 0.55 : 1}>
                        {n}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })()}
      </>
    );
  };

  const free = (row: ChartRow) => {
    const side = row.spec.side;
    const bandMid = (row.bandTop + row.bandBottom) / 2;
    const pdY = row.spec.rootUp ? row.bandTop + 13 : row.bandBottom - 7;
    const recY = row.spec.rootUp ? pdY + 11 : pdY - 12;
    const dropY = row.spec.rootUp ? row.bandBottom - 4 : row.bandTop + 4;
    const hv = live && hover && hover.hit.row === row ? hover : null;
    return (
      <>
        {/* 턱 머리표 — 위턱 / 아래턱 */}
        {row.jawHeaderY !== undefined && (
          <g>
            <line x1={6} x2={geo.width - 6} y1={row.jawHeaderY + 4} y2={row.jawHeaderY + 4} stroke="#e2e8f0" strokeWidth={1} />
            <rect x={6} y={row.jawHeaderY - 13} width={74} height={22} rx={11} fill="#0f172a" />
            <path
              d={row.spec.upper ? "M15 3 Q22 -9 29 3" : "M15 -7 Q22 5 29 -7"}
              transform={`translate(0 ${row.jawHeaderY})`}
              fill="none"
              stroke="#ffffff"
              strokeWidth={2.2}
              strokeLinecap="round"
            />
            <text x={54} y={row.jawHeaderY + 3} textAnchor="middle" fontSize={11} fontWeight={800} fill="#ffffff">
              {row.spec.upper ? "위턱" : "아래턱"}
            </text>
          </g>
        )}
        {/* 줄 표시 — 바깥(협측) / 안쪽(구개·설측) */}
        <g transform={`translate(6 ${(row.toothTop + row.toothBottom) / 2 - 26})`}>
          <rect width={38} height={52} rx={10} fill={side === "B" ? "#e0f2fe" : "#ede9fe"} />
          <text x={19} y={21} textAnchor="middle" fontSize={11} fontWeight={800} fill={side === "B" ? "#0369a1" : "#6d28d9"}>
            {side === "B" ? "바깥" : "안쪽"}
          </text>
          <text x={19} y={40} textAnchor="middle" fontSize={13} fontWeight={900} fill={side === "B" ? "#0284c7" : "#7c3aed"}>
            {side === "B" ? "B" : row.spec.upper ? "P" : "L"}
          </text>
        </g>
        {row.teeth.map((t) => {
          if (missing(t)) return null;
          const mob = Number(toothVal(ix, "mob", t) ?? 0);
          const implant = toothVal(ix, "state", t) === "implant";
          return (
            <g key={`f-${t}`}>
              {sitesLeftToRight(t).map((p) => {
                const pdv = siteVal(ix, "pd", t, side, p);
                const rec = siteVal(ix, "rec", t, side, p);
                const bop = siteVal(ix, "bop", t, side, p) === true;
                const plq = surfaceVal(ix, t, plaqueSurface(p, side)) === true;
                const x = siteX(geo, t, p);
                const kPd = entryKey({ m: "pd", t, s: side, p });
                const kRec = entryKey({ m: "rec", t, s: side, p });
                const kBop = entryKey({ m: "bop", t, s: side, p });
                return (
                  <g key={p}>
                    {pdv !== undefined && (
                      <text key={`${kPd}-${String(pdv)}`} className={live && flash === kPd ? "perio-pop" : undefined} x={x} y={pdY} textAnchor="middle" fontSize={10.5} fontWeight={800} fill={pdColor(pdNum(pdv))}>
                        {String(pdv)}
                      </text>
                    )}
                    {typeof rec === "number" && rec !== 0 && (
                      <text key={`${kRec}-${rec}`} className={live && flash === kRec ? "perio-pop" : undefined} x={x} y={recY} textAnchor="middle" fontSize={8} fontWeight={600} fill="#be185d">
                        {rec}
                      </text>
                    )}
                    {bop && <circle key={kBop} className={live && flash === kBop ? "perio-drop" : undefined} cx={x} cy={dropY} r={2.8} fill="#dc2626" />}
                    {plq && <rect x={x - 3} y={bandMid - 3} width={6} height={6} rx={1.5} fill="#ca8a04" opacity={0.85} />}
                  </g>
                );
              })}
              {mob > 0 && (
                <g key={`mob-${t}-${mob}`} className={live && flash === entryKey({ m: "mob", t }) ? "perio-pop" : undefined}>
                  <rect x={geo.x[t] - 11} y={row.labelY - 10} width={22} height={12} rx={6} fill="#fee2e2" transform={`translate(${(dims(t).md * k) / 2 - 8} 0)`} />
                  <text x={geo.x[t] + (dims(t).md * k) / 2 - 8} y={row.labelY - 1} textAnchor="middle" fontSize={8} fontWeight={800} fill="#b91c1c">
                    {MOB_LABEL[mob]}
                  </text>
                </g>
              )}
              {implant && (
                <text x={geo.x[t]} y={bandMid + 3} textAnchor="middle" fontSize={7} fontWeight={700} fill="#64748b" opacity={0.7}>
                  IMP
                </text>
              )}
            </g>
          );
        })}

        {/* 다음 칸 — 숨 쉬는 링 */}
        {live && cursor && cursor.s === side && isUpper(cursor.t) === row.spec.upper && row.teeth.includes(cursor.t) && !missing(cursor.t) && (
          <g pointerEvents="none">
            <circle cx={siteX(geo, cursor.t, cursor.p)} cy={mmToY(row, -recAt(cursor.t, row, cursor.p))} r={6} fill="none" stroke="#0284c7" strokeWidth={2} className="perio-pulse" />
            <circle cx={siteX(geo, cursor.t, cursor.p)} cy={mmToY(row, -recAt(cursor.t, row, cursor.p))} r={3.2} fill="#0284c7" />
          </g>
        )}

        {/* 치아 단위 모드(동요·결손·출혈·치태) — 올린 곳에 다음 값 미리보기 */}
        {hv && mode !== "pd" && mode !== "rec" && (() => {
          const { t, p } = hv.hit;
          const x = mode === "mob" || mode === "state" ? geo.x[t] : siteX(geo, t, p);
          const label =
            mode === "mob"
              ? MOB_LABEL[(Number(toothVal(ix, "mob", t) ?? 0) + 1) % 4]
              : mode === "state"
                ? (({ undefined: "결손", missing: "임플란트", implant: "있음" }) as Record<string, string>)[String(toothVal(ix, "state", t))]
                : mode === "bop"
                  ? siteVal(ix, "bop", t, side, p) === true
                    ? "−"
                    : "●"
                  : surfaceVal(ix, t, plaqueSurface(p, side)) === true
                    ? "−"
                    : "■";
          const w = mode === "mob" || mode === "state" ? dims(t).md * k : (dims(t).md * k) / 3;
          return (
            <g pointerEvents="none">
              <rect x={x - w / 2} y={row.toothTop} width={w} height={row.toothBottom - row.toothTop} fill="#0ea5e9" opacity={0.08} rx={4} />
              <g transform={`translate(${x} ${bandMid})`}>
                <rect x={-17} y={-9} width={34} height={18} rx={9} fill="#0f172a" opacity={0.82} />
                <text y={4} textAnchor="middle" fontSize={10} fontWeight={800} fill={mode === "bop" ? "#fca5a5" : mode === "plq" ? "#fde68a" : "#ffffff"}>
                  {label}
                </text>
              </g>
            </g>
          );
        })()}
      </>
    );
  };

  // 값 풍선 — 포인터 옆(터치는 손가락 위)에 큰 숫자
  const bubble =
    live && hover && (mode === "pd" || mode === "rec") && hover.value !== null ? (
      <g pointerEvents="none" transform={`translate(${hover.hit.x + (touch ? 0 : 26)} ${hover.hit.y - (touch ? 46 : 0)})`}>
        <g key={String(hover.value)} className="perio-pop">
          <circle r={15} fill={mode === "pd" ? pdColor(pdNum(hover.value)) : "#be185d"} opacity={0.94} />
          <text y={5} textAnchor="middle" fontSize={14} fontWeight={800} fill="#ffffff">
            {String(hover.value)}
          </text>
        </g>
      </g>
    ) : null;

  return (
    <DentalChart
      ref={ref}
      geo={geo}
      title={title}
      look={(t) => {
        const st = toothVal(ix, "state", t);
        return { missing: st === "missing", implant: st === "implant" };
      }}
      skip={mode === "state" ? undefined : missing}
      over={over}
      free={free}
      top={bubble}
      onPointer={onPointer}
      className="h-auto w-full"
      style={{ touchAction: "pan-x", cursor: mode === "pd" || mode === "rec" ? "ns-resize" : "pointer" }}
    />
  );
});
