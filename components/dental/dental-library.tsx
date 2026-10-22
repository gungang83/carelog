"use client";

// 치아 도식 라이브러리 보관함 — 방향(교합면·정면)·범위(7-7·8-8)·색을 바꿔 보고 SVG로 내려받는다.
// 치아를 누르면 그 치아만 강조색으로 칠한다(다시 누르면 해제).

import { useMemo, useRef, useState } from "react";
import { DEFAULT_STYLE, facialLayout, occlusalLayout, toothLabel, type ToothStyle, type ToothView } from "@/lib/dental/teeth";
import { DentalTeeth, type ToothPaint } from "@/components/dental/dental-teeth";

const COLOR_FIELDS: { key: keyof Omit<ToothStyle, "strokeWidth">; label: string }[] = [
  { key: "crownFill", label: "치관" },
  { key: "rootFill", label: "치근" },
  { key: "stroke", label: "윤곽선" },
  { key: "detailStroke", label: "구·융선" },
];

export function DentalLibrary() {
  const [view, setView] = useState<ToothView>("occlusal");
  const [third, setThird] = useState(false);
  const [labels, setLabels] = useState(true);
  const [style, setStyle] = useState<ToothStyle>(DEFAULT_STYLE);
  const [accent, setAccent] = useState("#fca5a5");
  const [marked, setMarked] = useState<string[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  const layout = useMemo(
    () => (view === "occlusal" ? occlusalLayout({ withThirdMolars: third }) : facialLayout({ withThirdMolars: third })),
    [view, third],
  );
  const paint = Object.fromEntries(marked.map((t) => [t, { crownFill: accent } satisfies ToothPaint]));

  const toggle = (fdi: string) => setMarked((m) => (m.includes(fdi) ? m.filter((x) => x !== fdi) : [...m, fdi]));

  const download = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `carelog-teeth-${view}-${third ? "8-8" : "7-7"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const seg = (active: boolean) =>
    `rounded-lg px-3 py-1 text-sm font-semibold transition ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button type="button" className={seg(view === "occlusal")} onClick={() => setView("occlusal")}>
            교합면
          </button>
          <button type="button" className={seg(view === "facial")} onClick={() => setView("facial")}>
            정면
          </button>
        </div>
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button type="button" className={seg(!third)} onClick={() => setThird(false)}>
            7-7
          </button>
          <button type="button" className={seg(third)} onClick={() => setThird(true)}>
            8-8 (사랑니)
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
          치식 번호
        </label>
        {COLOR_FIELDS.map((c) => (
          <label key={c.key} className="flex items-center gap-1.5 text-sm text-slate-600">
            <input
              type="color"
              value={style[c.key]}
              onChange={(e) => setStyle((s) => ({ ...s, [c.key]: e.target.value }))}
              className="size-7 cursor-pointer rounded border border-slate-200"
            />
            {c.label}
          </label>
        ))}
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="size-7 cursor-pointer rounded border border-slate-200" />
          강조
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => {
              setStyle(DEFAULT_STYLE);
              setMarked([]);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            초기화
          </button>
          <button type="button" onClick={download} className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700">
            SVG 내려받기
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        치아를 누르면 강조색으로 칠해집니다{marked.length > 0 && ` — ${marked.map(toothLabel).join(", ")}`}
      </p>

      <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-4">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          className="h-auto max-h-[70vh] w-full max-w-full"
          fontFamily="system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
        >
          <DentalTeeth layout={layout} style={style} paint={paint} labels={labels} onToothClick={toggle} />
        </svg>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">고정 파일(기본 색) — 바로 링크·다운로드</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            전악: <code>/dental-svg/arch/</code> occlusal-7-7 · occlusal-8-8 · facial-7-7 · facial-8-8 (뒤에 <code>-plain</code>이 붙은 파일은 번호 없음)
          </li>
          <li>
            치아 한 개: <code>/dental-svg/occlusal/16.svg</code> · <code>/dental-svg/facial/16.svg</code> 처럼 치식 번호(11~48)
          </li>
        </ul>
        <p className="mt-2 text-xs text-slate-400">
          모양을 고칠 땐 원본 <code>lib/dental/teeth.ts</code>를 고치고 <code>scripts/export-dental-svg.mts</code>로 다시 내보냅니다.
        </p>
      </div>
    </div>
  );
}
