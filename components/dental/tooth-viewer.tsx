"use client";

// spec 037 — 상담 중 치아 그림(전체화면). 쓸 때마다 2D·3D를 골라 환자에게 보여주고, 치아를 눌러 색으로 표시한 뒤
// [기록에 담기] → 지금 화면 PNG + 표시한 치아 텍스트를 상담 기록에 넣는다. 2D·3D가 같은 표시 상태를 공유한다.
// [✏️ 그려서 담기] → 지금 화면을 스냅샷으로 찍어 그림 도구(펜·화살표·텍스트)로 그린 뒤 담는다. 기공지 첨부에도 같은 화면을 쓴다.

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { facialLayout, occlusalLayout, toothLabel, type Fdi, type ToothView } from "@/lib/dental/teeth";
import { DentalTeeth, type ToothPaint } from "@/components/dental/dental-teeth";
import type { Capture3D } from "@/components/dental/dental-3d";
import { readViewMode, writeViewMode, type ViewMode as Mode } from "@/lib/dental/view-mode";
import { ImageAnnotator } from "@/components/image-annotator";

// three.js는 3D를 고를 때만 불러온다
const Dental3D = dynamic(() => import("@/components/dental/dental-3d").then((m) => m.Dental3D), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-slate-400">3D 불러오는 중…</div>,
});

/** 외부 3D 모델 — 던디대 치의학부 "Permanent Dentition"(CC BY 4.0). 파일을 넣으면 READY를 켠다(spec 037 §2.5). */
const DUNDEE = { ready: false, url: "/dental-3d/dundee-permanent-dentition.glb" };

const COLORS = [
  { color: "#ef4444", name: "빨강" },
  { color: "#f59e0b", name: "주황" },
  { color: "#3b82f6", name: "파랑" },
  { color: "#22c55e", name: "초록" },
  { color: "#64748b", name: "회색" },
];

const MODE_KEY = "carelog.toothViewer.mode";

function todayLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function svgToPng(svg: SVGSVGElement, w: number, h: number): Promise<Blob | null> {
  // 크기 속성이 없으면 이미지가 기본 크기(300×150)로 잡혀 여백이 생기므로 명시한다
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
  const canvas = document.createElement("canvas");
  canvas.width = w * 2;
  canvas.height = h * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob(res, "image/png"));
}

export function ToothViewer({
  onDone,
  onClose,
  doneLabel = "기록에 담기",
}: {
  /** 기록에 담기 — 지금 화면 PNG(그렸으면 그린 그림) + 표시한 치아 텍스트 */
  onDone: (image: File, text: string) => Promise<void> | void;
  onClose: () => void;
  /** 완료 버튼 문구 — 기공지에선 "첨부하기" */
  doneLabel?: string;
}) {
  const [mode, setModeState] = useState<Mode>(() => readViewMode(MODE_KEY));
  const [view2d, setView2d] = useState<ToothView>("occlusal");
  const [third, setThird] = useState(false);
  const [dundee, setDundee] = useState(false);
  const [current, setCurrent] = useState(COLORS[0].color);
  const [marks, setMarks] = useState<Record<Fdi, string>>({});
  const [busy, setBusy] = useState(false);
  /** 그려서 담기 — 찍은 스냅샷(그림 도구로 연다) */
  const [snapshot, setSnapshot] = useState<File | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const captureRef = useRef<Capture3D | null>(null);

  const setMode = (m: Mode) => {
    setModeState(m);
    writeViewMode(MODE_KEY, m);
  };

  const layout = useMemo(
    () => (view2d === "occlusal" ? occlusalLayout({ withThirdMolars: third }) : facialLayout({ withThirdMolars: third })),
    [view2d, third],
  );

  const toggle = useCallback(
    (fdi: Fdi) =>
      setMarks((m) => {
        const next = { ...m };
        if (next[fdi] === current) delete next[fdi];
        else next[fdi] = current;
        return next;
      }),
    [current],
  );

  const paint2d = useMemo(
    () => Object.fromEntries(Object.entries(marks).map(([t, c]) => [t, { crownFill: c } satisfies ToothPaint])),
    [marks],
  );
  const marked = Object.keys(marks);

  const text = () => {
    const lines = COLORS.map((c) => {
      const teeth = Object.keys(marks)
        .filter((t) => marks[t] === c.color)
        .sort();
      return teeth.length ? `${c.name}: ${teeth.map((t) => `#${t}(${toothLabel(t).split(" · ")[1] ?? ""})`).join(", ")}` : "";
    }).filter(Boolean);
    return [`[치아 표시 — ${todayLabel()} · ${marked.length}개]`, ...lines].join("\n");
  };

  /** 지금 보이는 화면(2D·3D)을 PNG로 */
  const capture = async (): Promise<File> => {
    const blob =
      mode === "3d"
        ? await captureRef.current?.()
        : svgRef.current
          ? await svgToPng(svgRef.current, layout.width, layout.height)
          : null;
    if (!blob) throw new Error("화면을 이미지로 만들지 못했습니다.");
    return new File([blob], `teeth_${Date.now()}.png`, { type: "image/png" });
  };

  const finish = async (file: File) => {
    await onDone(file, marked.length > 0 ? text() : "");
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      alert(e instanceof Error ? e.message : "담지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const seg = (active: boolean) =>
    `rounded-lg px-3 py-1 text-sm font-semibold transition ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-50">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <h2 className="mr-1 text-base font-bold text-slate-900">🦷 치아 그림</h2>
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
          <button type="button" className={seg(mode === "2d")} onClick={() => setMode("2d")}>
            2D
          </button>
          <button type="button" className={seg(mode === "3d")} onClick={() => setMode("3d")}>
            3D
          </button>
        </div>
        {mode === "2d" ? (
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button type="button" className={seg(view2d === "occlusal")} onClick={() => setView2d("occlusal")}>
              교합면
            </button>
            <button type="button" className={seg(view2d === "facial")} onClick={() => setView2d("facial")}>
              정면
            </button>
          </div>
        ) : (
          DUNDEE.ready && (
            <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button type="button" className={seg(!dundee)} onClick={() => setDundee(false)}>
                기본 모델
              </button>
              <button type="button" className={seg(dundee)} onClick={() => setDundee(true)}>
                정밀 모델
              </button>
            </div>
          )
        )}
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={third} onChange={(e) => setThird(e.target.checked)} />
          사랑니
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setMarks({})}
            disabled={marked.length === 0}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            표시 지우기
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            닫기
          </button>
          <button
            type="button"
            onClick={() => void run(async () => setSnapshot(await capture()))}
            disabled={busy}
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-40"
            title="지금 보이는 화면을 찍어 그 위에 그립니다"
          >
            ✏️ 그려서 {doneLabel.replace(/^기록에 /, "")}
          </button>
          <button
            type="button"
            onClick={() => void run(async () => finish(await capture()))}
            disabled={busy}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
          >
            {busy ? "처리 중…" : doneLabel}
          </button>
        </div>
      </div>

      {/* 표시 색 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <span className="text-xs text-slate-500">표시 색</span>
        {COLORS.map((c) => (
          <button
            key={c.color}
            type="button"
            onClick={() => setCurrent(c.color)}
            title={c.name}
            className={`size-8 rounded-full border-2 transition ${current === c.color ? "border-slate-900 ring-2 ring-slate-900/20" : "border-white shadow"}`}
            style={{ backgroundColor: c.color }}
          />
        ))}
        <span className="ml-2 text-xs text-slate-500">
          치아를 누르면 표시 · 같은 색으로 다시 누르면 해제
          {marked.length > 0 && ` — ${[...marked].sort().join(", ")}`}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        {mode === "3d" ? (
          <div className="flex h-full w-full max-w-5xl flex-col gap-1">
            <Dental3D
              key={dundee ? "dundee" : "carelog"}
              modelUrl={dundee ? DUNDEE.url : undefined}
              withThirdMolars={third}
              paint={marks}
              onToothClick={toggle}
              captureRef={captureRef}
              className="min-h-0 flex-1"
            />
            {dundee && (
              <p className="text-center text-[10px] text-slate-400">
                3D 모델: “Permanent Dentition” © University of Dundee, School of Dentistry — CC BY 4.0
              </p>
            )}
          </div>
        ) : (
          <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="h-full max-h-[78vh] w-full max-w-4xl select-none rounded-2xl border border-slate-200 bg-white"
            fontFamily="system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
          >
            <rect x={0} y={0} width={layout.width} height={layout.height} fill="#ffffff" />
            <DentalTeeth layout={layout} paint={paint2d} onToothClick={toggle} />
          </svg>
        )}
      </div>
      {/* 스냅샷 위에 그리기 — 저장하면 그린 그림이 담긴다 */}
      {snapshot && (
        <ImageAnnotator
          file={snapshot}
          saveLabel={doneLabel}
          onClose={() => setSnapshot(null)}
          onSave={(f) =>
            void run(async () => {
              await finish(f);
              setSnapshot(null);
            })
          }
        />
      )}
    </div>
  );
}
