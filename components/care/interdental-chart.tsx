"use client";

// spec 036 A단계 — 치간칫솔 사이즈 차트(전체화면). 환자에게 화면을 보여주며 치아 사이를 눌러 사이즈 지정.
// 치열 도식은 Carelog 치아 라이브러리(lib/dental/teeth.ts — 직접 그린 해부학적 SVG, 외부 저작물 미사용). 결과 = PNG 이미지 + 텍스트 블록.
// 2D·3D는 쓸 때마다 선택(spec 037). 3D에선 치아 사이 점이 입체 위치(협측 치경부)에 뜨고, 담을 때 지금 3D 화면 + 범례를 한 장으로 합친다.

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import {
  BRUSH_LINES,
  resolveKey,
  sizeSpec,
  summarize,
  interdentalText,
  type InterdentalResult,
} from "@/lib/care-templates";
import { dims, occlusalLayout } from "@/lib/dental/teeth";
import { DentalTeeth } from "@/components/dental/dental-teeth";
import type { Capture3D } from "@/components/dental/dental-3d";
import { BRUSH_W, BrushGlyph, BrushIllustration } from "@/components/care/brush-illustration";
import { readViewMode, writeViewMode, type ViewMode } from "@/lib/dental/view-mode";

// three.js는 3D를 고를 때만 불러온다
const Dental3D = dynamic(() => import("@/components/dental/dental-3d").then((m) => m.Dental3D), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-slate-400">3D 불러오는 중…</div>,
});
const MODE_KEY = "carelog.interdental.mode";

// 치열 도식 = Carelog 치아 라이브러리(lib/dental/teeth.ts) 교합면 7-7. 오른쪽에 범례 칸(PNG에도 함께 찍힘).
const LAYOUT = occlusalLayout({ scale: 5, pad: 64 });
const LEGEND_W = 300;
const W = LAYOUT.width + LEGEND_W;
const H = Math.max(LAYOUT.height, 560);
const CX = LAYOUT.width / 2;
const MARKER_R = 10;

// 서버·브라우저 삼각함수 끝자리 차이로 하이드레이션이 어긋나지 않게 반올림
const r2 = (n: number) => Math.round(n * 100) / 100;
const cyOf = (fdi: string) => LAYOUT.teeth.find((t) => t.fdi === fdi)?.cy ?? 0;
// 상·하악 이름은 각 아치 안쪽(입천장·혀 자리)에
const UPPER_LABEL_Y = r2(cyOf("11") + (cyOf("17") - cyOf("11")) * 0.45);
const LOWER_LABEL_Y = r2(cyOf("41") + (cyOf("47") - cyOf("41")) * 0.45);
const MID_Y = r2(LAYOUT.midY);

/** 치아 사이 지점 → 아치 바깥(입술·볼 쪽)으로 이웃 치아 두께만큼 밀어낸 표시 위치. */
const MARKERS = LAYOUT.gaps.map((g) => {
  const [a, b] = g.id.split("-");
  const off = (Math.max(dims(a).bl, dims(b).bl) / 2) * 5 + MARKER_R + 4;
  return { id: g.id, x: r2(g.x + g.nx * off), y: r2(g.y + g.ny * off) };
});

/** SVG 요소 → 이미지(크기 속성 명시 — 없으면 기본 300×150으로 잡혀 여백이 생긴다) */
async function svgImage(svg: SVGSVGElement, w: number, h: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("이미지 변환 실패"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  });
  return img;
}

async function blobImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("이미지 변환 실패"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function todayLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function InterdentalChart({
  onDone,
  onClose,
}: {
  /** 기록에 담기 — PNG 이미지 + 텍스트 블록 */
  onDone: (image: File, text: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<InterdentalResult>({});
  const [lineId, setLineId] = useState<string>(BRUSH_LINES[0]?.id ?? "");
  const line = BRUSH_LINES.find((l) => l.id === lineId) ?? BRUSH_LINES[0];
  // 현재 칠할 값 = "제품군id:사이즈id" · 빈 문자열 = 지우개
  const [current, setCurrent] = useState<string>(line ? `${line.id}:${line.sizes[0]?.id}` : "");
  const [busy, setBusy] = useState(false);
  const [mode, setModeState] = useState<ViewMode>(() => readViewMode(MODE_KEY));
  const svgRef = useRef<SVGSVGElement>(null);
  const legendRef = useRef<SVGSVGElement>(null);
  const captureRef = useRef<Capture3D | null>(null);

  const setMode = (m: ViewMode) => {
    setModeState(m);
    writeViewMode(MODE_KEY, m);
  };

  const selectLine = (id: string) => {
    setLineId(id);
    const l = BRUSH_LINES.find((x) => x.id === id);
    if (l && current !== "") setCurrent(`${l.id}:${l.sizes[0]?.id}`);
  };

  const rows = summarize(result);
  const total = rows.reduce((n, r) => n + r.gaps.length, 0);

  const gapColors = useMemo(
    () => Object.fromEntries(Object.entries(result).map(([gap, key]) => [gap, resolveKey(key)?.size.color])),
    [result],
  );

  const toggleGap = (gap: string) =>
    setResult((prev) => {
      const next = { ...prev };
      if (!current || next[gap] === current) delete next[gap];
      else next[gap] = current;
      return next;
    });

  const renderMarkers = () =>
    MARKERS.map((m) => {
      const s = result[m.id] ? resolveKey(result[m.id])?.size : undefined;
      return (
        <g key={m.id} onClick={() => toggleGap(m.id)} style={{ cursor: "pointer" }}>
          <circle cx={m.x} cy={m.y} r={MARKER_R + 5} fill="transparent" />
          <circle
            cx={m.x}
            cy={m.y}
            r={MARKER_R}
            fill={s ? s.color : "#ffffff"}
            stroke={s ? s.color : "#94a3b8"}
            strokeWidth={2}
            strokeDasharray={s ? undefined : "3 3"}
          />
          {s && (
            <path
              d={`M ${m.x - 4.5} ${m.y} l 3 3 l 6 -6.5`}
              fill="none"
              stroke="#ffffff"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>
      );
    });

  const exportPng = async (): Promise<File> => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");
    if (mode === "3d") {
      // 지금 3D 화면 + 오른쪽 범례를 한 장으로
      const shot = await captureRef.current?.();
      if (!shot || !legendRef.current) throw new Error("3D 화면을 이미지로 만들지 못했습니다.");
      const view = await blobImage(shot);
      const legend = await svgImage(legendRef.current, LEGEND_W, H);
      const leftW = Math.round((H * scale * view.width) / view.height);
      canvas.width = leftW + LEGEND_W * scale;
      canvas.height = H * scale;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(view, 0, 0, leftW, canvas.height);
      ctx.drawImage(legend, leftW, 0, LEGEND_W * scale, canvas.height);
    } else {
      if (!svgRef.current) throw new Error("차트를 찾을 수 없습니다.");
      const img = await svgImage(svgRef.current, W, H);
      canvas.width = W * scale;
      canvas.height = H * scale;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (!blob) throw new Error("이미지 변환 실패");
    return new File([blob], `interdental_${Date.now()}.png`, { type: "image/png" });
  };

  const handleDone = async () => {
    if (total === 0) return;
    setBusy(true);
    try {
      const file = await exportPng();
      await onDone(file, interdentalText(result, todayLabel()));
    } catch (e) {
      alert(e instanceof Error ? e.message : "기록에 담지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  // 범례(이미지에도 함께 찍히도록 SVG 안에 그린다) — 사이즈별 그림 포함, 줄 수가 많으면 촘촘하게
  const rowH = rows.length > 6 ? 50 : 66;
  const renderLegend = (x0: number) => (
    <g>
      <text x={x0 + 8} y={44} fontSize={16} fontWeight={700} fill="#0f172a">
        치간칫솔 처방
      </text>
      <text x={x0 + 8} y={64} fontSize={11} fill="#94a3b8">
        {todayLabel()} · {total}곳
      </text>
      {rows.length > 0 ? (
        rows.map((r, i) => (
          <g key={r.key} transform={`translate(${x0 + 8}, ${88 + i * rowH})`}>
            <g transform={`translate(0, 0) scale(${60 / BRUSH_W})`}>
              <BrushGlyph size={r.size} />
            </g>
            <text x={68} y={13} fontSize={15} fontWeight={700} fill="#0f172a">
              {r.size.label} <tspan fontSize={12} fontWeight={500} fill="#64748b">· {r.gaps.length}곳</tspan>
            </text>
            <text x={68} y={30} fontSize={11} fill="#64748b">
              {r.line.brand} {r.line.name}
            </text>
            {rowH > 55 && (
              <text x={0} y={50} fontSize={10} fill="#94a3b8">
                {r.gaps.length > 7 ? `${r.gaps.slice(0, 7).join(", ")} 외 ${r.gaps.length - 7}` : r.gaps.join(", ")}
              </text>
            )}
          </g>
        ))
      ) : (
        <text x={x0 + 8} y={100} fontSize={13} fill="#cbd5e1">
          아직 지정한 곳이 없습니다
        </text>
      )}
    </g>
  );

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-50">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <h2 className="mr-2 text-base font-bold text-slate-900">치간칫솔 사이즈 차트</h2>
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
          {(["2d", "3d"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1 text-sm font-semibold transition ${
                mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        {/* 제품군 선택 — 라이브러리(lib/care-templates.ts, 정본은 EO 상품 예정) */}
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {BRUSH_LINES.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => selectLine(l.id)}
              className={`rounded-lg px-3 py-1 text-sm font-semibold transition ${
                lineId === l.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {l.brand} {l.name}
            </button>
          ))}
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

      {/* 사이즈 팔레트 — 그림(사진)·색·규격 */}
      {line && (
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2">
          {line.sizes.map((s) => {
            const key = `${line.id}:${s.id}`;
            const active = current === key;
            const spec = sizeSpec(s);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCurrent(key)}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                  active ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                {/* 사이즈별 그림(사진이 들어오면 사진) */}
                <BrushIllustration size={s} className="h-9 w-[86px] shrink-0 rounded-md bg-slate-50" />
                <span className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800">
                    {s.label}
                    {s.verified === false && (
                      <span className="ml-1 text-[10px] font-medium text-amber-600" title="일부 규격(색 등)이 아직 제조사 자료로 확인되지 않았습니다">
                        확인 필요
                      </span>
                    )}
                  </span>
                  {spec && <span className="text-[11px] text-slate-500">{spec}</span>}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setCurrent("")}
            className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              current === "" ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            지우개
          </button>
        </div>
      )}

      <p className="px-4 pt-2 text-center text-xs text-slate-500">
        사이즈를 고른 뒤 치아 사이 점을 누르세요 · 같은 사이즈로 다시 누르면 지워집니다 · 제품군을 바꿔 섞어 지정할 수 있습니다
      </p>

      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        {mode === "3d" ? (
          <div className="flex h-full w-full max-w-6xl gap-3">
            <Dental3D showGaps gapColors={gapColors} onGapClick={toggleGap} captureRef={captureRef} className="min-h-0 flex-1" />
            <svg
              ref={legendRef}
              xmlns="http://www.w3.org/2000/svg"
              viewBox={`0 0 ${LEGEND_W} ${H}`}
              className="hidden h-full w-[300px] shrink-0 rounded-2xl border border-slate-200 bg-white md:block"
              fontFamily="system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
            >
              <rect x={0} y={0} width={LEGEND_W} height={H} fill="#ffffff" />
              {renderLegend(4)}
            </svg>
          </div>
        ) : (
          <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${W} ${H}`}
            className="h-full max-h-[78vh] w-full max-w-5xl select-none rounded-2xl border border-slate-200 bg-white"
            fontFamily="system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
          >
            <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
            <text x={CX} y={UPPER_LABEL_Y} textAnchor="middle" fontSize={14} fill="#94a3b8" fontWeight={600}>
              상악 UPPER
            </text>
            <text x={CX - 78} y={MID_Y + 6} textAnchor="middle" fontSize={16} fontWeight={700} fill="#1e3a8a">
              ← 우(R)
            </text>
            <text x={CX + 78} y={MID_Y + 6} textAnchor="middle" fontSize={16} fontWeight={700} fill="#1e3a8a">
              좌(L) →
            </text>
            <text x={CX} y={MID_Y + 24} textAnchor="middle" fontSize={10} fill="#94a3b8">
              환자 기준 · 마주 본 화면
            </text>
            <text x={CX} y={LOWER_LABEL_Y} textAnchor="middle" fontSize={14} fill="#94a3b8" fontWeight={600}>
              하악 LOWER
            </text>
            <DentalTeeth layout={LAYOUT} labelSize={10} />
            {renderMarkers()}
            <line x1={LAYOUT.width} y1={24} x2={LAYOUT.width} y2={H - 24} stroke="#e2e8f0" />
            {renderLegend(LAYOUT.width + 12)}
          </svg>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-2 text-center text-sm text-slate-700">
        {total > 0 ? (
          <>
            처방 요약 <b>{total}곳</b> ·{" "}
            {rows.map((r) => `${r.line.brand} ${r.size.label} ${r.gaps.length}곳`).join(" · ")}
          </>
        ) : (
          <span className="text-slate-400">치아 사이를 눌러 사이즈를 지정하세요</span>
        )}
      </div>
    </div>
  );
}
