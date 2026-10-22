// 치아 도식 라이브러리(lib/dental/teeth.ts)를 React SVG로 그리는 공용 컴포넌트.
// 다른 SVG 안에 끼워 넣을 수 있게 <g>로 그린다(DentalTeeth). 단독으로 쓸 땐 DentalArchSvg.
// 치아별 색은 paint[FDI]로 덮어쓴다 — 상담자료·차트마다 색만 바꿔 재사용.

import {
  DEFAULT_STYLE,
  facialLayout,
  occlusalLayout,
  type Fdi,
  type Layout,
  type PlacedTooth,
  type ToothStyle,
  type ToothView,
} from "@/lib/dental/teeth";

export type ToothPaint = Partial<ToothStyle> & { opacity?: number };

function Tooth({
  tooth,
  style,
  label,
  labelSize,
  onClick,
}: {
  tooth: PlacedTooth;
  style: ToothStyle & { opacity?: number };
  label: boolean;
  labelSize: number;
  onClick?: (fdi: Fdi) => void;
}) {
  const { shape } = tooth;
  return (
    <g
      data-fdi={tooth.fdi}
      opacity={style.opacity}
      onClick={onClick ? () => onClick(tooth.fdi) : undefined}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <g transform={`matrix(${tooth.matrix.join(" ")})`}>
        {shape.root && (
          <path d={shape.root} fill={style.rootFill} stroke={style.stroke} strokeWidth={style.strokeWidth} vectorEffect="non-scaling-stroke" />
        )}
        <path d={shape.crown} fill={style.crownFill} stroke={style.stroke} strokeWidth={style.strokeWidth} vectorEffect="non-scaling-stroke" />
        {shape.details.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={style.detailStroke}
            strokeWidth={style.strokeWidth * 0.8}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      {label && (
        <text
          x={tooth.cx}
          y={tooth.cy + labelSize * 0.36}
          textAnchor="middle"
          fontSize={labelSize}
          fontWeight={600}
          fill="#475569"
          pointerEvents="none"
        >
          {tooth.fdi}
        </text>
      )}
    </g>
  );
}

/** 배치된 치아들을 <g>로 그린다(부모 SVG 좌표계 = layout 좌표계). */
export function DentalTeeth({
  layout,
  style = DEFAULT_STYLE,
  paint,
  labels = true,
  labelSize = 11,
  onToothClick,
}: {
  layout: Layout;
  style?: ToothStyle;
  /** 치아별 색 덮어쓰기 — { "16": { crownFill: "#fecaca" } } */
  paint?: Record<Fdi, ToothPaint | undefined>;
  labels?: boolean;
  labelSize?: number;
  onToothClick?: (fdi: Fdi) => void;
}) {
  return (
    <g>
      {layout.teeth.map((t) => (
        <Tooth
          key={t.fdi}
          tooth={t}
          style={{ ...style, ...paint?.[t.fdi] }}
          label={labels}
          labelSize={labelSize}
          onClick={onToothClick}
        />
      ))}
    </g>
  );
}

/** 전악 도식 단독 SVG. */
export function DentalArchSvg({
  view,
  withThirdMolars = false,
  scale,
  className,
  ...rest
}: {
  view: ToothView;
  withThirdMolars?: boolean;
  scale?: number;
  className?: string;
} & Omit<Parameters<typeof DentalTeeth>[0], "layout">) {
  const layout = view === "occlusal" ? occlusalLayout({ withThirdMolars, scale }) : facialLayout({ withThirdMolars, scale });
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className={className}
      fontFamily="system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
    >
      <DentalTeeth layout={layout} {...rest} />
    </svg>
  );
}
