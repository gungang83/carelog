"use client";

// spec 039 — 그리기 엔진 화면(공용). 예전 ImageAnnotator(이미지 주석)·SketchPad(기공지 손그림)를 대체한다.
// 그린 것은 원본 위 "층"에 항목(DrawItem)으로 쌓인다 → 저장 시 보기용 PNG + 편집용 기록(DrawDoc)을 함께 돌려준다.
// 다시 열면(doc) 예전 표시를 하나씩 지우거나 이어 그릴 수 있다. 원본 이미지는 건드리지 않는다.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  drawUnit,
  newDoc,
  newItemId,
  type DrawBaseKind,
  type DrawDoc,
  type DrawItem,
  type DrawPaper,
} from "@/lib/draw/doc";
import { drawBase, drawItem, drawItems, flattenDoc, hitItem, toolDef, TOOLS } from "@/lib/draw/render";

export type DrawResult = {
  /** 보기용 그림(PNG) */
  file: File;
  /** 편집용 기록 — base.ref가 비어 있으면 저장하는 쪽이 원본(base)을 올리고 채운다 */
  doc: DrawDoc;
  /** 아직 저장소에 없는 원본(붙여넣은 사진·치아 스냅샷 등). 원본이 이미 있거나(종이 포함) 없으면 null */
  base: Blob | null;
};

type Props = {
  /** 바탕 이미지(원본). 종이(blank)면 생략 */
  image?: Blob | null;
  /** 다시 열기 — 저장해 둔 편집용 기록 */
  doc?: DrawDoc | null;
  /** 새로 열 때 바탕 정보 — ref(원본 위치)를 알면 넘긴다(원본을 다시 올리지 않음) */
  base?: { kind?: DrawBaseKind; ref?: string; paper?: DrawPaper; w?: number; h?: number };
  title?: string;
  saveLabel?: string;
  /** 보기용 그림 파일 이름(확장자 제외) */
  fileName?: string;
  /** 그린 게 없으면 저장 비활성(손그림처럼 빈 종이는 의미 없을 때) */
  requireInk?: boolean;
  onSave: (r: DrawResult) => void;
  onClose: () => void;
};

type Mode = string | "eraser" | "pan";

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
/** 원본이 아무리 커도 이 크기로(업로드 압축 spec 017과 같은 기준) */
const MAX_DIM = 1600;
const BLANK = { w: 1600, h: 1200 };

const r1 = (v: number) => Math.round(v * 10) / 10;

async function loadImage(blob: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("이미지를 열지 못했습니다."));
        img.src = url;
      });
      return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export function DrawEditor({
  image,
  doc: initialDoc,
  base: baseHint,
  title = "이미지 주석",
  saveLabel = "저장",
  fileName,
  requireInk,
  onSave,
  onClose,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseCanvas = useRef<HTMLCanvasElement>(null);
  const inkCanvas = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<CanvasImageSource | null>(null);

  const [doc, setDoc] = useState<DrawDoc | null>(null);
  const [items, setItems] = useState<DrawItem[]>([]);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<Mode>("pen");
  const [color, setColor] = useState("#dc2626");
  const [width, setWidth] = useState(5);
  const [saving, setSaving] = useState(false);
  const [fit, setFit] = useState({ w: 0, h: 0 }); // 화면 표시 크기(줌 1 기준)
  const [draft, setDraft] = useState<{ x: number; y: number; value: string } | null>(null);

  // 되돌리기 — 항목 목록 스냅샷
  const undoStack = useRef<DrawItem[][]>([]);
  const redoStack = useRef<DrawItem[][]>([]);
  const [, setStackTick] = useState(0);
  const itemsRef = useRef<DrawItem[]>([]);
  itemsRef.current = items;

  // 줌/팬 (CSS transform — 좌표는 getBoundingClientRect로 실시간 계산)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const clampZoom = (z: number) => Math.min(Math.max(z, 1), 5);

  // 진행 중인 입력
  const current = useRef<DrawItem | null>(null);
  const erasing = useRef<{ before: DrawItem[] } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d0: number; z0: number } | null>(null);
  const panStart = useRef<{ cx: number; cy: number; px: number; py: number } | null>(null);
  const raf = useRef(0);

  // ── 바탕 불러오기 ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const img = image ? await loadImage(image) : null;
        if (cancelled) return;
        imgRef.current = img;
        let d: DrawDoc;
        if (initialDoc) {
          d = { ...initialDoc, items: [...initialDoc.items] };
        } else if (img) {
          const s = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
          d = newDoc({
            kind: baseHint?.kind ?? "image",
            ...(baseHint?.ref ? { ref: baseHint.ref } : {}),
            w: Math.round(img.width * s),
            h: Math.round(img.height * s),
          });
        } else {
          d = newDoc({ kind: "blank", paper: baseHint?.paper ?? "plain", w: baseHint?.w ?? BLANK.w, h: baseHint?.h ?? BLANK.h });
        }
        setDoc(d);
        setItems(d.items);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "이미지를 열지 못했습니다.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // 열 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unit = doc ? drawUnit(doc.base) : 1;

  // ── 화면 맞춤 크기 ────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !doc) return;
    const measure = () => {
      const pad = 32;
      const aw = Math.max(50, el.clientWidth - pad);
      const ah = Math.max(50, el.clientHeight - pad);
      const s = Math.min(aw / doc.base.w, ah / doc.base.h, 1.5);
      setFit({ w: Math.round(doc.base.w * s), h: Math.round(doc.base.h * s) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  // ── 그리기 ────────────────────────────────────────────────────
  useEffect(() => {
    const c = baseCanvas.current;
    if (!c || !doc) return;
    c.width = doc.base.w;
    c.height = doc.base.h;
    const ctx = c.getContext("2d");
    if (ctx) drawBase(ctx, doc.base, imgRef.current);
  }, [doc]);

  const paintInk = useCallback(() => {
    const c = inkCanvas.current;
    if (!c || !doc) return;
    if (c.width !== doc.base.w) c.width = doc.base.w;
    if (c.height !== doc.base.h) c.height = doc.base.h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawItems(ctx, itemsRef.current, unit);
    if (current.current) drawItem(ctx, current.current, unit);
  }, [doc, unit]);

  useEffect(() => {
    paintInk();
  }, [items, paintInk]);

  const schedulePaint = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(paintInk);
  };

  // ── 기록 변경(되돌리기 단위) ──────────────────────────────────
  const commit = useCallback((next: DrawItem[], before: DrawItem[] = itemsRef.current) => {
    undoStack.current.push(before);
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    setItems(next);
    setStackTick((t) => t + 1);
  }, []);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(itemsRef.current);
    setItems(prev);
    setStackTick((t) => t + 1);
  }, []);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(itemsRef.current);
    setItems(next);
    setStackTick((t) => t + 1);
  }, []);

  // ── 좌표 ──────────────────────────────────────────────────────
  const toBase = (clientX: number, clientY: number) => {
    const c = inkCanvas.current!;
    const r = c.getBoundingClientRect();
    return { x: (clientX - r.left) * (c.width / r.width), y: (clientY - r.top) * (c.height / r.height), scale: c.width / r.width };
  };

  const eraseAt = (x: number, y: number, scale: number) => {
    const ctx = inkCanvas.current?.getContext("2d");
    if (!ctx) return;
    const id = hitItem(ctx, itemsRef.current, x, y, 8 * scale);
    if (id) setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const fontSize = (width * 5 + 12) * unit;

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!doc) return;
    // 뒤따르는 마우스 기본 동작(포커스 이동·글자 선택)을 막는다 — 안 막으면 텍스트 입력칸이 열리자마자 닫힌다
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // 두 손가락 = 확대(진행 중 획은 버림)
      current.current = null;
      if (erasing.current) {
        setItems(erasing.current.before);
        erasing.current = null;
      }
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: zoom };
      schedulePaint();
      return;
    }
    if (mode === "pan") {
      panStart.current = { cx: e.clientX, cy: e.clientY, px: pan.x, py: pan.y };
      return;
    }
    const { x, y, scale } = toBase(e.clientX, e.clientY);
    if (mode === "eraser") {
      erasing.current = { before: itemsRef.current };
      eraseAt(x, y, scale);
      return;
    }
    const def = toolDef(mode);
    if (!def) return;
    if (def.input === "text") {
      setDraft({ x, y, value: "" });
      return;
    }
    current.current = {
      id: newItemId(),
      tool: def.id,
      pts: def.input === "freehand" ? [r1(x), r1(y)] : [r1(x), r1(y), r1(x), r1(y)],
      style: { color, width: r1(width * unit) },
    };
    schedulePaint();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const nz = clampZoom(pinch.current.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d0));
      setZoom(nz);
      if (nz === 1) setPan({ x: 0, y: 0 });
      return;
    }
    if (panStart.current) {
      const p = panStart.current;
      setPan({ x: p.px + (e.clientX - p.cx), y: p.py + (e.clientY - p.cy) });
      return;
    }
    const { x, y, scale } = toBase(e.clientX, e.clientY);
    if (erasing.current) {
      eraseAt(x, y, scale);
      return;
    }
    const cur = current.current;
    if (!cur) return;
    const def = toolDef(cur.tool);
    if (def?.input === "freehand") {
      const n = cur.pts.length;
      // 너무 가까운 점은 건너뜀(기록 크기·떨림 줄이기)
      if (Math.hypot(x - cur.pts[n - 2], y - cur.pts[n - 1]) < 1.5 * scale) return;
      cur.pts.push(r1(x), r1(y));
    } else {
      cur.pts[2] = r1(x);
      cur.pts[3] = r1(y);
    }
    schedulePaint();
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      return;
    }
    if (panStart.current) {
      panStart.current = null;
      return;
    }
    if (erasing.current) {
      const before = erasing.current.before;
      erasing.current = null;
      if (itemsRef.current.length !== before.length) commit(itemsRef.current, before);
      return;
    }
    const cur = current.current;
    current.current = null;
    if (!cur) return;
    const def = toolDef(cur.tool);
    // 거의 안 움직인 도형은 버림(실수 클릭)
    if (def?.input === "drag" && Math.hypot(cur.pts[2] - cur.pts[0], cur.pts[3] - cur.pts[1]) < 3 * unit) {
      schedulePaint();
      return;
    }
    commit([...itemsRef.current, { ...cur, at: new Date().toISOString() }]);
  };

  const commitDraft = () => {
    if (!draft) return;
    const value = draft.value.trim();
    if (value) {
      commit([
        ...itemsRef.current,
        {
          id: newItemId(),
          tool: "text",
          // 입력칸 위치에 글자가 오도록 기준선을 글자 크기만큼 내린다
          pts: [r1(draft.x), r1(draft.y + fontSize)],
          style: { color, width: r1(fontSize) },
          text: value,
          at: new Date().toISOString(),
        },
      ]);
    }
    setDraft(null);
  };

  const clearAll = () => {
    if (itemsRef.current.length) commit([]);
  };

  const handleSave = async () => {
    if (!doc || saving) return;
    setSaving(true);
    try {
      const out: DrawDoc = { ...doc, items: itemsRef.current };
      const png = await flattenDoc(out, imgRef.current);
      const name = `${fileName ?? (doc.base.kind === "blank" ? "sketch" : "annotated")}_${Date.now()}.png`;
      const needsBase = !out.base.ref && out.base.kind !== "blank" && image ? image : null;
      onSave({ file: new File([png], name, { type: "image/png" }), doc: out, base: needsBase });
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // ── 단축키 · 휠 확대 ──────────────────────────────────────────
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [undo, redo]);

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

  const zoomBy = (f: number) =>
    setZoom((z) => {
      const nz = clampZoom(z * f);
      if (nz === 1) setPan({ x: 0, y: 0 });
      return nz;
    });

  // 입력칸 위치(화면)
  const draftStyle = (() => {
    if (!draft || !doc || !inkCanvas.current || !wrapRef.current) return null;
    const r = inkCanvas.current.getBoundingClientRect();
    const wr = wrapRef.current.getBoundingClientRect();
    const k = r.width / doc.base.w;
    return {
      left: r.left - wr.left + draft.x * k + wrapRef.current.scrollLeft,
      top: r.top - wr.top + draft.y * k + wrapRef.current.scrollTop,
      fontSize: `${Math.max(12, fontSize * k)}px`,
      color,
    };
  })();

  const modes: { id: Mode; label: string }[] = [
    ...TOOLS.map((t) => ({ id: t.id, label: t.label })),
    { id: "eraser", label: "지우개" },
    { id: "pan", label: "✋ 이동" },
  ];
  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;
  const saveDisabled = !doc || saving || (requireInk && items.length === 0);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/80 p-4">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "95vh" }}>
        {/* header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sky-100 px-5 py-3">
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          <div className="flex flex-wrap justify-end gap-2">
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
              onClick={redo}
              disabled={!canRedo}
              className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-sky-50 disabled:opacity-40"
            >
              ↪ 다시
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
              onClick={() => void handleSave()}
              disabled={saveDisabled}
              className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
            >
              {saving ? "저장 중…" : saveLabel}
            </button>
          </div>
        </div>

        {/* toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-sky-100 bg-slate-50 px-4 py-2">
          <div className="flex flex-wrap gap-1">
            {modes.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                title={m.id === "eraser" ? "누른 획을 통째로 지웁니다" : undefined}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  mode === m.id ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-sky-50"
                }`}
              >
                {m.label}
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              disabled={items.length === 0}
              className="rounded px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-sky-50 disabled:opacity-40"
            >
              모두 지우기
            </button>
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
                <span className="block rounded-full bg-slate-700" style={{ width: w * 2, height: w * 2 }} />
              </button>
            ))}
          </div>

          <span className="h-4 w-px bg-slate-200" />

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
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
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
        <div ref={wrapRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-200">
          {loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : !doc ? (
            <p className="text-sm text-slate-500">여는 중…</p>
          ) : (
            <div
              className="relative shrink-0"
              style={{
                width: fit.w,
                height: fit.h,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              <canvas ref={baseCanvas} className="absolute inset-0 h-full w-full rounded shadow-lg" />
              <canvas
                ref={inkCanvas}
                data-testid="draw-ink"
                className="absolute inset-0 h-full w-full"
                style={{ touchAction: "none", cursor: mode === "pan" ? "grab" : mode === "text" ? "text" : "crosshair" }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              />
            </div>
          )}

          {draft && draftStyle && (
            <input
              autoFocus
              type="text"
              value={draft.value}
              style={{ position: "absolute", ...draftStyle }}
              className="min-w-32 border border-sky-400 bg-white/85 px-1 py-0.5 font-bold outline-none"
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
