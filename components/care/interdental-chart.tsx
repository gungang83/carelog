"use client";

// spec 036 A단계 — 치간칫솔 사이즈 차트(전체화면). 환자에게 화면을 보여주며 치아 사이를 눌러 사이즈 지정.
// 치열 도식은 Carelog가 직접 그린 SVG(외부 저작물 미사용). 결과 = PNG 이미지 + 텍스트 블록.

import { useMemo, useRef, useState } from "react";
import {
  DEFAULT_BRUSH_SIZES,
  LOWER_TEETH,
  UPPER_TEETH,
  summarize,
  interdentalText,
  type BrushSize,
  type InterdentalResult,
} from "@/lib/care-templates";

const W = 800;
const H = 640;
const CX = W / 2;
const ARCH_A = 300; // 가로 반경
const ARCH_B = 170; // 세로 깊이
const PHI_MAX = (88 * Math.PI) / 180;
const UPPER_Y0 = 80; // 상악 전치 위치
const LOWER_Y0 = 470; // 하악 전치 위치
const LEGEND_Y = 560;
const TOOTH_GAP = 4;

type Pt = { x: number; y: number };

function toothRadius(fdi: string): number {
  const n = Number(fdi[1]);
  if (n >= 6) return 26; // 대구치
  if (n >= 4) return 22; // 소구치
  if (n === 3) return 20; // 견치
  return 18; // 절치
}

/** 타원 아치 위에 치아 크기만큼 간격을 두고 배치(어금니가 겹치지 않도록 호 길이 기준). */
function archPoints(teeth: string[], upper: boolean): Pt[] {
  const sign = upper ? 1 : -1;
  const y0 = upper ? UPPER_Y0 : LOWER_Y0;
  const at = (phi: number): Pt => ({
    x: CX + ARCH_A * Math.sin(phi),
    y: y0 + sign * ARCH_B * (1 - Math.cos(phi)),
  });
  // 호 길이 테이블(φ: -PHI_MAX → PHI_MAX)
  const N = 2000;
  const phis: number[] = [];
  const cum: number[] = [0];
  for (let i = 0; i <= N; i++) phis.push(-PHI_MAX + (2 * PHI_MAX * i) / N);
  for (let i = 1; i <= N; i++) {
    const a = at(phis[i - 1]);
    const b = at(phis[i]);
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  // 치아 중심의 목표 호 위치 — 정중선(11|21 사이)을 호 중앙에 맞춘다
  const widths = teeth.map((t) => toothRadius(t) * 2 + TOOTH_GAP);
  const total = widths.reduce((s, w) => s + w, 0);
  const start = cum[N] / 2 - total / 2;
  let acc = start;
  return widths.map((w) => {
    const target = acc + w / 2;
    acc += w;
    let lo = 0;
    let hi = N;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return at(phis[lo]);
  });
}

function todayLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function InterdentalChart({
  sizes = DEFAULT_BRUSH_SIZES,
  onDone,
  onClose,
}: {
  sizes?: BrushSize[];
  /** 기록에 담기 — PNG 이미지 + 텍스트 블록 */
  onDone: (image: File, text: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<InterdentalResult>({});
  const [current, setCurrent] = useState<string>(sizes[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const sizeById = useMemo(() => new Map(sizes.map((s) => [s.id, s])), [sizes]);

  const upperPts = useMemo(() => archPoints(UPPER_TEETH, true), []);
  const lowerPts = useMemo(() => archPoints(LOWER_TEETH, false), []);

  const rows = summarize(result, sizes);
  const total = rows.reduce((n, r) => n + r.gaps.length, 0);

  const toggleGap = (gap: string) =>
    setResult((prev) => {
      const next = { ...prev };
      if (!current || next[gap] === current) delete next[gap];
      else next[gap] = current;
      return next;
    });

  const renderArch = (teeth: string[], pts: Pt[], upper: boolean) => (
    <g>
      {teeth.map((t, i) => {
        const p = pts[i];
        const r = toothRadius(t);
        return (
          <g key={t}>
            <circle cx={p.x} cy={p.y} r={r} fill="#fffaf0" stroke="#cbd5e1" strokeWidth={2} />
            <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize={14} fontWeight={600} fill="#475569">
              {t}
            </text>
          </g>
        );
      })}
      {teeth.slice(0, -1).map((t, i) => {
        const a = pts[i];
        const b = pts[i + 1];
        const gap = `${t}-${teeth[i + 1]}`;
        // 치아 사이 지점에서 아치 바깥쪽(입술·볼 쪽)으로 밀어 치아와 겹치지 않게 — 아치 안쪽 기준점에서 바깥 방향
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const innerY = upper ? UPPER_Y0 + ARCH_B * 1.2 : LOWER_Y0 - ARCH_B * 1.2;
        const nx = mx - CX;
        const ny = my - innerY;
        const len = Math.hypot(nx, ny) || 1;
        const off = 28;
        const gx = mx + (nx / len) * off;
        const gy = my + (ny / len) * off;
        const s = result[gap] ? sizeById.get(result[gap]) : undefined;
        return (
          <g key={gap} onClick={() => toggleGap(gap)} style={{ cursor: "pointer" }}>
            <circle cx={gx} cy={gy} r={18} fill="transparent" />
            <circle
              cx={gx}
              cy={gy}
              r={12}
              fill={s ? s.color : "#ffffff"}
              stroke={s ? s.color : "#94a3b8"}
              strokeWidth={2}
              strokeDasharray={s ? undefined : "3 3"}
            />
            {s && (
              <path
                d={`M ${gx - 5} ${gy} l 3.5 3.5 l 6.5 -7`}
                fill="none"
                stroke="#ffffff"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>
        );
      })}
    </g>
  );

  const exportPng = async (): Promise<File> => {
    const svg = svgRef.current;
    if (!svg) throw new Error("차트를 찾을 수 없습니다.");
    const xml = new XMLSerializer().serializeToString(svg);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("이미지 변환 실패"));
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (!blob) throw new Error("이미지 변환 실패");
    return new File([blob], `interdental_${Date.now()}.png`, { type: "image/png" });
  };

  const handleDone = async () => {
    if (total === 0) return;
    setBusy(true);
    try {
      const file = await exportPng();
      await onDone(file, interdentalText(result, sizes, todayLabel()));
    } catch (e) {
      alert(e instanceof Error ? e.message : "기록에 담지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  // 범례(이미지에도 함께 찍히도록 SVG 안에 그린다)
  const legendW = rows.length > 0 ? W / Math.max(rows.length, 1) : W;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-50">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <h2 className="mr-2 text-base font-bold text-slate-900">치간칫솔 사이즈 차트</h2>
        <div className="flex flex-wrap gap-1.5">
          {sizes.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrent(s.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                current === s.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="inline-block size-3 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCurrent("")}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              current === "" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            지우개
          </button>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setResult({})}
            disabled={total === 0}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            전체 지우기
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            닫기
          </button>
          <button
            type="button"
            onClick={() => void handleDone()}
            disabled={busy || total === 0}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
          >
            {busy ? "담는 중…" : "기록에 담기"}
          </button>
        </div>
      </div>

      <p className="px-4 pt-2 text-center text-xs text-slate-500">
        위에서 사이즈를 고른 뒤 치아 사이 점을 누르세요 · 같은 사이즈로 다시 누르면 지워집니다
      </p>

      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${W} ${H}`}
          className="h-full max-h-[78vh] w-full max-w-4xl select-none rounded-2xl border border-slate-200 bg-white"
          fontFamily="system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
        >
          <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
          <text x={CX} y={30} textAnchor="middle" fontSize={15} fill="#94a3b8" fontWeight={600}>
            상악 UPPER
          </text>
          <text x={CX - 120} y={282} textAnchor="middle" fontSize={18} fontWeight={700} fill="#1e3a8a">
            ← 우(R)
          </text>
          <text x={CX + 120} y={282} textAnchor="middle" fontSize={18} fontWeight={700} fill="#1e3a8a">
            좌(L) →
          </text>
          <text x={CX} y={300} textAnchor="middle" fontSize={11} fill="#94a3b8">
            환자 기준 · 마주 본 화면
          </text>
          {renderArch(UPPER_TEETH, upperPts, true)}
          {renderArch(LOWER_TEETH, lowerPts, false)}
          <text x={CX} y={530} textAnchor="middle" fontSize={15} fill="#94a3b8" fontWeight={600}>
            하악 LOWER
          </text>
          {rows.length > 0 ? (
            rows.map((r, i) => (
              <g key={r.size.id} transform={`translate(${i * legendW + legendW / 2}, ${LEGEND_Y})`}>
                <circle cx={-46} cy={22} r={9} fill={r.size.color} />
                <text x={-32} y={28} fontSize={17} fontWeight={700} fill="#0f172a">
                  {r.size.label}
                </text>
                <text x={-32} y={50} fontSize={14} fill="#64748b">
                  {r.gaps.length}곳
                </text>
              </g>
            ))
          ) : (
            <text x={CX} y={LEGEND_Y + 30} textAnchor="middle" fontSize={14} fill="#cbd5e1">
              아직 지정한 곳이 없습니다
            </text>
          )}
        </svg>
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-2 text-center text-sm text-slate-700">
        {total > 0 ? (
          <>
            처방 요약 <b>{total}곳</b> ·{" "}
            {rows.map((r) => `${r.size.label} ${r.gaps.length}곳`).join(" · ")}
          </>
        ) : (
          <span className="text-slate-400">치아 사이를 눌러 사이즈를 지정하세요</span>
        )}
      </div>
    </div>
  );
}
