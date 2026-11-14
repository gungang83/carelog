"use client";

// Carelog 치아 엔진 — 정면 치열 차트 화면 부품. 치아 모양(teeth.ts)·배치(chart.ts)를 그리고,
// 기능은 층(under/over/free)만 얹는다. 포인터는 치아·부위·깊이(mm)로 풀어서 넘겨준다(onPointer).
// 치주 차트(spec 040)가 첫 사용처 — 기공지 치아 선택·상담 설명 그림도 이 위에 층만 바꿔 쓴다.

import { forwardRef, useCallback, type ReactNode } from "react";
import { toothShape, type Fdi } from "@/lib/dental/teeth";
import { chartHit, toothMatrix, type ChartGeo, type ChartHit, type ChartRow } from "@/lib/dental/chart";

export type ToothLook = { missing?: boolean; implant?: boolean; dim?: boolean; crownFill?: string; rootFill?: string };

export type ChartPointer = {
  type: "move" | "down" | "up" | "leave";
  hit: ChartHit | null;
  pointerType: string;
  /** 누른 채로 움직이는 중 */
  pressed: boolean;
};

type Props = {
  geo: ChartGeo;
  look?: (t: Fdi) => ToothLook;
  /** 치아 아래(잇몸 뒤 그림자 등) — 줄 영역으로 잘림 */
  under?: (row: ChartRow) => ReactNode;
  /** 치아 위(잇몸·주머니·눈금) — 줄 영역으로 잘림 */
  over?: (row: ChartRow) => ReactNode;
  /** 잘리지 않는 층(숫자 띠·라벨·칩) */
  free?: (row: ChartRow) => ReactNode;
  /** 맨 위(돋보기 등) */
  top?: ReactNode;
  /** 치아 번호 라벨 숨김 */
  hideLabels?: boolean;
  skip?: (t: Fdi) => boolean;
  onPointer?: (e: ChartPointer) => void;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};

const FONT = "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

export const DentalChart = forwardRef<SVGSVGElement, Props>(function DentalChart(
  { geo, look, under, over, free, top, hideLabels, skip, onPointer, className, style, title },
  ref,
) {
  const resolve = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): ChartHit | null => {
      const ctm = e.currentTarget.getScreenCTM();
      if (!ctm) return null;
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      return chartHit(geo, pt.x, pt.y, skip);
    },
    [geo, skip],
  );
  const emit = (type: ChartPointer["type"], e: React.PointerEvent<SVGSVGElement>) =>
    onPointer?.({ type, hit: type === "leave" ? null : resolve(e), pointerType: e.pointerType, pressed: e.buttons > 0 });

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      width={geo.width}
      height={geo.height}
      fontFamily={FONT}
      className={className}
      style={{ userSelect: "none", ...style }}
      onPointerMove={(e) => emit("move", e)}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") e.currentTarget.setPointerCapture(e.pointerId);
        emit("down", e);
      }}
      onPointerUp={(e) => emit("up", e)}
      onPointerLeave={(e) => emit("leave", e)}
      onPointerCancel={(e) => emit("leave", e)}
    >
      <rect x={0} y={0} width={geo.width} height={geo.height} fill="#ffffff" />
      {title && (
        <text x={geo.width / 2} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0f172a">
          {title}
        </text>
      )}
      {geo.rows.map((row) => {
        const clip = `dc-clip-${row.spec.key}`;
        return (
          <g key={row.spec.key}>
            <defs>
              <clipPath id={clip}>
                <rect x={0} y={row.toothTop} width={geo.width} height={row.toothBottom - row.toothTop} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clip})`}>
              {under?.(row)}
              {row.teeth.map((t) => {
                // 안쪽 줄은 안쪽(구개·설측)에서 본 모양 — 상악 대구치는 구개근이 앞에 온다
                const s = toothShape(t, row.spec.side === "L" ? "lingual" : "facial");
                const l = look?.(t) ?? {};
                return (
                  <g key={t} transform={`matrix(${toothMatrix(geo, row, t).join(" ")})`} opacity={l.missing ? 0.14 : l.dim ? 0.45 : 1}>
                    {s.rootBack && (
                      <path d={s.rootBack} fill={l.rootFill ?? "#f1e3c8"} fillOpacity={0.5} stroke="#94a3b8" strokeOpacity={0.5} strokeWidth={0.15} />
                    )}
                    {s.root && (
                      <path
                        d={s.root}
                        fill={l.rootFill ?? (l.implant ? "#cbd5e1" : "#f1e3c8")}
                        stroke="#94a3b8"
                        strokeWidth={0.18}
                        strokeDasharray={l.implant ? "0.6 0.4" : undefined}
                      />
                    )}
                    <path d={s.crown} fill={l.crownFill ?? (l.implant ? "#e2e8f0" : "#fffdf7")} stroke="#94a3b8" strokeWidth={0.18} />
                    {s.details.map((d, i) => (
                      <path key={i} d={d} fill="none" stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" />
                    ))}
                  </g>
                );
              })}
              {over?.(row)}
            </g>
            {!hideLabels &&
              row.teeth.map((t) => (
                <text key={`l-${t}`} x={geo.x[t]} y={row.labelY} textAnchor="middle" fontSize={10} fontWeight={600} fill={look?.(t)?.missing ? "#cbd5e1" : "#475569"}>
                  {t}
                </text>
              ))}
            {free?.(row)}
          </g>
        );
      })}
      {top}
    </svg>
  );
});
