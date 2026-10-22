"use client";

// spec 036 A단계 — 치간칫솔 사이즈 차트(전체화면). 환자에게 화면을 보여주며 치아 사이를 눌러 사이즈 지정.
// 치열 도식은 Carelog 치아 라이브러리(lib/dental/teeth.ts — 직접 그린 해부학적 SVG, 외부 저작물 미사용). 결과 = PNG 이미지 + 텍스트 블록.

import { useRef, useState } from "react";
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

// 치열 도식 = Carelog 치아 라이브러리(lib/dental/teeth.ts) 교합면 7-7. 오른쪽에 범례 칸(PNG에도 함께 찍힘).
const LAYOUT = occlusalLayout({ scale: 5, pad: 64 });
const LEGEND_W = 300;
const W = LAYOUT.width + LEGEND_W;
const H = Math.max(LAYOUT.height, 560);
const CX = LAYOUT.width / 2;
const MARKER_R = 10;

const cyOf = (fdi: string) => LAYOUT.teeth.find((t) => t.fdi === fdi)?.cy ?? 0;
// 상·하악 이름은 각 아치 안쪽(입천장·혀 자리)에
const UPPER_LABEL_Y = cyOf("11") + (cyOf("17") - cyOf("11")) * 0.45;
const LOWER_LABEL_Y = cyOf("41") + (cyOf("47") - cyOf("41")) * 0.45;

/** 치아 사이 지점 → 아치 바깥(입술·볼 쪽)으로 이웃 치아 두께만큼 밀어낸 표시 위치. */
const MARKERS = LAYOUT.gaps.map((g) => {
  const [a, b] = g.id.split("-");
  const off = (Math.max(dims(a).bl, dims(b).bl) / 2) * 5 + MARKER_R + 4;
  return { id: g.id, x: g.x + g.nx * off, y: g.y + g.ny * off };
});

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
  const svgRef = useRef<SVGSVGElement>(null);

  const selectLine = (id: string) => {
    setLineId(id);
    const l = BRUSH_LINES.find((x) => x.id === id);
    if (l && current !== "") setCurrent(`${l.id}:${l.sizes[0]?.id}`);
  };

  const rows = summarize(result);
  const total = rows.reduce((n, r) => n + r.gaps.length, 0);

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
      await onDone(file, interdentalText(result, todayLabel()));
    } catch (e) {
      alert(e instanceof Error ? e.message : "기록에 담지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  // 범례(이미지에도 함께 찍히도록 SVG 안에 그린다) — 줄 수가 많으면 촘촘하게
  const LX = LAYOUT.width + 12;
  const rowH = rows.length > 6 ? 46 : 62;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-50">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <h2 className="mr-2 text-base font-bold text-slate-900">치간칫솔 사이즈 차트</h2>
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

      {/* 사이즈 팔레트 — 색·규격(·사진 예정) */}
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
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt="" className="size-9 rounded-md object-cover" />
                ) : (
                  <span className="inline-block size-6 rounded-full border border-black/10" style={{ backgroundColor: s.color }} />
                )}
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
          <text x={CX - 78} y={LAYOUT.midY + 6} textAnchor="middle" fontSize={16} fontWeight={700} fill="#1e3a8a">
            ← 우(R)
          </text>
          <text x={CX + 78} y={LAYOUT.midY + 6} textAnchor="middle" fontSize={16} fontWeight={700} fill="#1e3a8a">
            좌(L) →
          </text>
          <text x={CX} y={LAYOUT.midY + 24} textAnchor="middle" fontSize={10} fill="#94a3b8">
            환자 기준 · 마주 본 화면
          </text>
          <text x={CX} y={LOWER_LABEL_Y} textAnchor="middle" fontSize={14} fill="#94a3b8" fontWeight={600}>
            하악 LOWER
          </text>
          <DentalTeeth layout={LAYOUT} labelSize={10} />
          {renderMarkers()}
          <line x1={LAYOUT.width} y1={24} x2={LAYOUT.width} y2={H - 24} stroke="#e2e8f0" />
          <text x={LX + 8} y={44} fontSize={16} fontWeight={700} fill="#0f172a">
            치간칫솔 처방
          </text>
          <text x={LX + 8} y={64} fontSize={11} fill="#94a3b8">
            {todayLabel()} · {total}곳
          </text>
          {rows.length > 0 ? (
            rows.map((r, i) => (
              <g key={r.key} transform={`translate(${LX + 8}, ${92 + i * rowH})`}>
                <circle cx={9} cy={8} r={9} fill={r.size.color} />
                <text x={26} y={13} fontSize={15} fontWeight={700} fill="#0f172a">
                  {r.size.label} <tspan fontSize={12} fontWeight={500} fill="#64748b">· {r.gaps.length}곳</tspan>
                </text>
                <text x={26} y={30} fontSize={11} fill="#64748b">
                  {r.line.brand} {r.line.name}
                </text>
                {rowH > 50 && (
                  <text x={26} y={46} fontSize={10} fill="#94a3b8">
                    {r.gaps.length > 6 ? `${r.gaps.slice(0, 6).join(", ")} 외 ${r.gaps.length - 6}` : r.gaps.join(", ")}
                  </text>
                )}
              </g>
            ))
          ) : (
            <text x={LX + 8} y={100} fontSize={13} fill="#cbd5e1">
              아직 지정한 곳이 없습니다
            </text>
          )}
        </svg>
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
