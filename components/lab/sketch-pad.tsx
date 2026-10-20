"use client";

// spec 035 — 기공지 손그림 패드(종이의 "자유 지시 + 손그림" 대체). 펜 3색·굵기·되돌리기.
// 완료 시 PNG blob으로 반환 → 첨부(kind: sketch)로 업로드.

import { useEffect, useRef, useState } from "react";

const COLORS = ["#1e293b", "#dc2626", "#2563eb"] as const;

export function SketchPad({
  onDone,
  onCancel,
}: {
  onDone: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const strokes = useRef<ImageData[]>([]);
  const [color, setColor] = useState<string>(COLORS[0]);
  const [width, setWidth] = useState(3);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    strokes.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (strokes.current.length > 30) strokes.current.shift();
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = pos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setDirty(true);
  };

  const end = () => {
    drawing.current = false;
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const prev = strokes.current.pop();
    if (canvas && ctx && prev) ctx.putImageData(prev, 0, 0);
    if (strokes.current.length === 0) setDirty(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    strokes.current = [];
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setDirty(false);
  };

  const finish = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onDone(blob);
    }, "image/png");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl space-y-3 rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex-1 text-sm font-semibold text-slate-800">그림 지시 (손그림)</h3>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-indigo-500" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              aria-label={`펜 색 ${c}`}
            />
          ))}
          <select
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
          >
            <option value={2}>가는 펜</option>
            <option value={3}>보통</option>
            <option value={6}>굵은 펜</option>
          </select>
          <button type="button" onClick={undo} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
            ↩ 되돌리기
          </button>
          <button type="button" onClick={clear} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
            전체 지우기
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={1000}
          height={620}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full touch-none rounded-xl border border-slate-200"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            취소
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={!dirty}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            첨부에 담기
          </button>
        </div>
      </div>
    </div>
  );
}
