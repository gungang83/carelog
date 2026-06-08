"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Tool = "pen" | "line" | "arrow" | "rect" | "text" | "eraser" | "pan";

const COLORS = [
  { value: "#dc2626", label: "빨강" },
  { value: "#2563eb", label: "파랑" },
  { value: "#16a34a", label: "초록" },
  { value: "#d97706", label: "주황" },
  { value: "#7c3aed", label: "보라" },
  { value: "#0f172a", label: "검정" },
  { value: "#ffffff", label: "흰색" },
];

const WIDTHS = [2, 5, 10];

const TOOL_LABELS: Record<Tool, string> = {
  pen: "펜",
  line: "직선",
  arrow: "화살표",
  rect: "사각형",
  text: "텍스트",
  eraser: "지우개",
  pan: "✋ 이동",
};

type TextDraft = {
  canvasX: number;
  canvasY: number;
  offsetX: number;
  offsetY: number;
  value: string;
};

type Props = {
  file: File;
  onClose: () => void;
  onSave: (file: File) => void;
};

export function ImageAnnotator({ file, onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#dc2626");
  const [width, setWidth] = useState(3);
  const [draft, setDraft] = useState<TextDraft | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  // 줌/팬 (CSS transform — 그리기 좌표는 getBoundingClientRect로 실시간 계산되어 그대로 유지)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panning = useRef(false);
  const panStart = useRef({ cx: 0, cy: 0, px: 0, py: 0 });
  const pinch = useRef<{ d0: number; z0: number } | null>(null);

  const drawing = useRef(false);
  const startPt = useRef({ x: 0, y: 0 });
  const snap = useRef<ImageData | null>(null);
  const history = useRef<ImageData[]>([]);

  const clampZoom = (z: number) => Math.min(Math.max(z, 1), 5);
  const zoomBy = (factor: number) =>
    setZoom((z) => {
      const nz = clampZoom(z * factor);
      if (nz === 1) setPan({ x: 0, y: 0 });
      return nz;
    });
  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const startPan = (cx: number, cy: number) => {
    panning.current = true;
    panStart.current = { cx, cy, px: pan.x, py: pan.y };
  };
  const movePan = (cx: number, cy: number) => {
    if (!panning.current) return;
    setPan({
      x: panStart.current.px + (cx - panStart.current.cx),
      y: panStart.current.py + (cy - panStart.current.cy),
    });
  };
  const touchDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  // ── load image ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = Math.min(900 / img.naturalWidth, 640 / img.naturalHeight, 1);
      canvas.width = Math.round(img.naturalWidth * r);
      canvas.height = Math.round(img.naturalHeight * r);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      history.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
      setCanUndo(false);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // ── helpers ──────────────────────────────────────────────────
  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (c.width / r.width),
      y: (clientY - r.top) * (c.height / r.height),
    };
  }, []);

  const toOffset = useCallback((cx: number, cy: number) => {
    const c = canvasRef.current!;
    const wrap = wrapRef.current!;
    const cr = c.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    return {
      ox: cr.left - wr.left + (cx / c.width) * cr.width,
      oy: cr.top - wr.top + (cy / c.height) * cr.height,
    };
  }, []);

  const applyStyle = useCallback(
    (ctx: CanvasRenderingContext2D, t: Tool) => {
      ctx.strokeStyle = t === "eraser" ? "#ffffff" : color;
      ctx.fillStyle = color;
      ctx.lineWidth = t === "eraser" ? width * 6 : width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    },
    [color, width],
  );

  const pushHistory = useCallback(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    if (history.current.length >= 20) history.current.shift();
    history.current.push(ctx.getImageData(0, 0, c.width, c.height));
    setCanUndo(history.current.length > 1);
  }, []);

  const undo = useCallback(() => {
    if (history.current.length <= 1) return;
    history.current.pop();
    const c = canvasRef.current!;
    c.getContext("2d")!.putImageData(history.current[history.current.length - 1], 0, 0);
    setCanUndo(history.current.length > 1);
  }, []);

  const drawArrow = useCallback(
    (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
      const a = Math.atan2(y2 - y1, x2 - x1);
      const h = Math.max(width * 5, 12);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - h * Math.cos(a - Math.PI / 6), y2 - h * Math.sin(a - Math.PI / 6));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - h * Math.cos(a + Math.PI / 6), y2 - h * Math.sin(a + Math.PI / 6));
      ctx.stroke();
    },
    [width],
  );

  // ── draw events (shared by mouse & touch) ────────────────────
  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      const { x, y } = toCanvas(clientX, clientY);
      if (tool === "text") {
        const { ox, oy } = toOffset(x, y);
        setDraft({ canvasX: x, canvasY: y, offsetX: ox, offsetY: oy, value: "" });
        return;
      }
      drawing.current = true;
      startPt.current = { x, y };
      const c = canvasRef.current!;
      const ctx = c.getContext("2d")!;
      snap.current = ctx.getImageData(0, 0, c.width, c.height);
      if (tool === "pen" || tool === "eraser") {
        applyStyle(ctx, tool);
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    },
    [tool, toCanvas, toOffset, applyStyle],
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!drawing.current) return;
      const { x, y } = toCanvas(clientX, clientY);
      const c = canvasRef.current!;
      const ctx = c.getContext("2d")!;
      applyStyle(ctx, tool);
      if (tool === "pen" || tool === "eraser") {
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (snap.current) {
        ctx.putImageData(snap.current, 0, 0);
        const { x: sx, y: sy } = startPt.current;
        if (tool === "line") {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(x, y);
          ctx.stroke();
        } else if (tool === "arrow") {
          drawArrow(ctx, sx, sy, x, y);
        } else if (tool === "rect") {
          ctx.beginPath();
          ctx.strokeRect(sx, sy, x - sx, y - sy);
        }
      }
    },
    [tool, toCanvas, applyStyle, drawArrow],
  );

  const handleEnd = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    snap.current = null;
    pushHistory();
  }, [pushHistory]);

  const commitDraft = useCallback(() => {
    if (!draft) return;
    if (draft.value.trim()) {
      const c = canvasRef.current!;
      const ctx = c.getContext("2d")!;
      ctx.font = `bold ${width * 5 + 12}px system-ui, sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(draft.value, draft.canvasX, draft.canvasY);
      pushHistory();
    }
    setDraft(null);
  }, [draft, color, width, pushHistory]);

  const handleSave = () => {
    canvasRef.current!.toBlob((blob) => {
      if (!blob) return;
      const base = file.name.replace(/\.[^.]+$/, "");
      onSave(new File([blob], `${base}_annotated.png`, { type: "image/png" }));
    }, "image/png");
  };

  // Ctrl+Z shortcut
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [undo]);

  // 휠 줌 (passive:false 네이티브 리스너 — preventDefault 위해)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => {
        const nz = clampZoom(z * (e.deltaY < 0 ? 1.12 : 0.89));
        if (nz === 1) setPan({ x: 0, y: 0 });
        return nz;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4">
      <div
        className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "95vh" }}
      >
        {/* header */}
        <div className="flex shrink-0 items-center justify-between border-b border-sky-100 px-5 py-3">
          <span className="text-sm font-semibold text-slate-800">이미지 주석</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-sky-50 disabled:opacity-40"
            >
              ↩ 실행취소
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-sky-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
            >
              저장
            </button>
          </div>
        </div>

        {/* toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-sky-100 bg-slate-50 px-4 py-2">
          <div className="flex flex-wrap gap-1">
            {(["pen", "line", "arrow", "rect", "text", "eraser", "pan"] as Tool[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTool(t)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  tool === t ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-sky-50"
                }`}
              >
                {TOOL_LABELS[t]}
              </button>
            ))}
          </div>

          <span className="h-4 w-px bg-slate-200" />

          <div className="flex gap-1.5">
            {COLORS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                title={label}
                onClick={() => setColor(value)}
                style={{ backgroundColor: value }}
                className={`h-6 w-6 rounded-full border-2 transition ${
                  color === value ? "scale-110 border-sky-500 shadow" : "border-slate-200"
                }`}
              />
            ))}
          </div>

          <span className="h-4 w-px bg-slate-200" />

          <div className="flex items-center gap-2">
            {WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWidth(w)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                  width === w ? "bg-sky-100 ring-2 ring-sky-400" : "hover:bg-slate-100"
                }`}
              >
                <span
                  className="block rounded-full bg-slate-700"
                  style={{ width: w * 2, height: w * 2 }}
                />
              </button>
            ))}
          </div>

          <span className="h-4 w-px bg-slate-200" />

          {/* 줌 컨트롤 (버튼/휠/핀치, ✋이동 툴로 팬) */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => zoomBy(0.8)}
              aria-label="축소"
              className="flex h-7 w-7 items-center justify-center rounded text-base font-bold text-slate-600 hover:bg-slate-100"
            >
              −
            </button>
            <button
              type="button"
              onClick={resetZoom}
              className="min-w-12 rounded px-1.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => zoomBy(1.25)}
              aria-label="확대"
              className="flex h-7 w-7 items-center justify-center rounded text-base font-bold text-slate-600 hover:bg-slate-100"
            >
              ＋
            </button>
          </div>
        </div>

        {/* canvas area */}
        <div
          ref={wrapRef}
          className="relative flex flex-1 items-center justify-center overflow-auto bg-slate-200 p-4"
        >
          <canvas
            ref={canvasRef}
            className="rounded shadow-lg"
            style={{
              maxHeight: "calc(95vh - 148px)",
              maxWidth: "100%",
              cursor:
                tool === "pan"
                  ? "grab"
                  : tool === "text"
                    ? "text"
                    : "crosshair",
              touchAction: "none",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
            onMouseDown={(e) => {
              if (tool === "pan") return startPan(e.clientX, e.clientY);
              handleStart(e.clientX, e.clientY);
            }}
            onMouseMove={(e) => {
              if (panning.current) return movePan(e.clientX, e.clientY);
              handleMove(e.clientX, e.clientY);
            }}
            onMouseUp={() => {
              if (panning.current) {
                panning.current = false;
                return;
              }
              handleEnd();
            }}
            onMouseLeave={() => {
              if (panning.current) {
                panning.current = false;
                return;
              }
              handleEnd();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              if (e.touches.length === 2) {
                pinch.current = { d0: touchDist(e.touches), z0: zoom };
                return;
              }
              if (tool === "pan") {
                return startPan(e.touches[0].clientX, e.touches[0].clientY);
              }
              handleStart(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              if (pinch.current && e.touches.length === 2) {
                const nz = clampZoom(
                  pinch.current.z0 * (touchDist(e.touches) / pinch.current.d0),
                );
                setZoom(nz);
                if (nz === 1) setPan({ x: 0, y: 0 });
                return;
              }
              if (panning.current) {
                return movePan(e.touches[0].clientX, e.touches[0].clientY);
              }
              handleMove(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchEnd={() => {
              if (pinch.current) {
                pinch.current = null;
                return;
              }
              if (panning.current) {
                panning.current = false;
                return;
              }
              handleEnd();
            }}
          />

          {draft && (
            <input
              autoFocus
              type="text"
              value={draft.value}
              style={{
                position: "absolute",
                left: draft.offsetX,
                top: draft.offsetY,
                fontSize: `${width * 5 + 12}px`,
              }}
              className="min-w-32 border border-sky-400 bg-white/85 px-1 py-0.5 outline-none"
              placeholder="입력 후 Enter"
              onChange={(e) => setDraft((d) => (d ? { ...d, value: e.target.value } : null))}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDraft();
                if (e.key === "Escape") setDraft(null);
              }}
              onBlur={commitDraft}
            />
          )}
        </div>
      </div>
    </div>
  );
}
