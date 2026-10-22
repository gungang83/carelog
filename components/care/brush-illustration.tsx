// spec 036 — 치간칫솔 사이즈별 그림. 실제 사진(size.imageUrl — 판매처 사진)이 들어오기 전까지 쓰는 Carelog 자체 그림.
// 손잡이 = 사이즈 색, 와이어 굵기·모 직경 = 규격 비율(mm). 모 직경이 미확인인 사이즈는 와이어 굵기로 근사해 그린다(그림용).
// 제조사 사진·도면을 따라 그리지 않았다.

import type { BrushSize } from "@/lib/care-templates";

const MM = 4; // 1mm = 4 (그림 단위)
export const BRUSH_W = 100;
export const BRUSH_H = 28;

/** 다른 SVG 안에 끼우는 그림(원점 = 왼쪽 위, 크기 BRUSH_W × BRUSH_H) */
export function BrushGlyph({ size }: { size: BrushSize }) {
  const cy = BRUSH_H / 2;
  const wire = Math.max(1, (size.wireMm ?? 0.6) * MM);
  const dia = Math.min(BRUSH_H - 2, (size.brushMm ?? (size.wireMm ?? 0.6) * 4.5) * MM);
  const bx0 = 64;
  const bx1 = 94;
  const tufts = Array.from({ length: 11 }, (_, i) => bx0 + 2 + (i * (bx1 - bx0 - 4)) / 10);
  return (
    <g>
      {/* 손잡이(사이즈 색) */}
      <rect x={1} y={cy - 5} width={50} height={10} rx={5} fill={size.color} stroke="rgba(0,0,0,0.18)" />
      <rect x={6} y={cy - 2} width={22} height={4} rx={2} fill="rgba(255,255,255,0.35)" />
      {/* 목 */}
      <path d={`M 51 ${cy - 3} L 60 ${cy - 1.6} L 60 ${cy + 1.6} L 51 ${cy + 3} Z`} fill="#cbd5e1" />
      {/* 와이어 */}
      <line x1={60} y1={cy} x2={bx1 + 3} y2={cy} stroke="#64748b" strokeWidth={wire} strokeLinecap="round" />
      {/* 모 — 원통형 */}
      <rect x={bx0} y={cy - dia / 2} width={bx1 - bx0} height={dia} rx={Math.min(dia / 2, 4)} fill="#f8fafc" stroke="#94a3b8" strokeWidth={0.8} />
      {tufts.map((x) => (
        <line key={x} x1={x} y1={cy - dia / 2 + 1} x2={x} y2={cy + dia / 2 - 1} stroke="#cbd5e1" strokeWidth={0.8} />
      ))}
      <line x1={bx0} y1={cy} x2={bx1} y2={cy} stroke="#64748b" strokeWidth={Math.max(0.8, wire * 0.8)} />
    </g>
  );
}

/** 단독 그림(팔레트 카드용). 사진이 있으면 사진. */
export function BrushIllustration({ size, className }: { size: BrushSize; className?: string }) {
  if (size.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={size.imageUrl} alt={size.label} className={`${className ?? ""} object-contain`} />;
  }
  return (
    <svg viewBox={`0 0 ${BRUSH_W} ${BRUSH_H}`} className={className} role="img" aria-label={size.label}>
      <BrushGlyph size={size} />
    </svg>
  );
}
