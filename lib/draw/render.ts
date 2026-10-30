// spec 039 — 그리기 엔진: 도구 등록부 · 그리기 · 고르기(지우개) · 보기용 PNG 굽기.
// 새 도구는 TOOLS에 한 줄 더하면 된다 — 화면(components/draw)과 쓰는 곳은 손대지 않는다.
// 모르는 도구 이름이 기록에 있으면 그리지 않고 건너뛴다(보기용 PNG가 원래 모습을 갖고 있음).

import { drawUnit, type DrawBase, type DrawDoc, type DrawItem } from "@/lib/draw/doc";

/** 그리는 방식: freehand(따라 긋기) · drag(시작점→끝점) · text(눌러 입력) */
export type ToolInput = "freehand" | "drag" | "text";

export type ToolDef = {
  id: string;
  label: string;
  input: ToolInput;
  draw: (ctx: CanvasRenderingContext2D, item: DrawItem, unit: number) => void;
  /** 점(x,y)이 이 항목 위인지 — 지우개용 */
  hit: (item: DrawItem, x: number, y: number, tol: number, ctx: CanvasRenderingContext2D) => boolean;
};

const TEXT_FONT = "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

function stroke(ctx: CanvasRenderingContext2D, item: DrawItem) {
  ctx.strokeStyle = item.style.color;
  ctx.fillStyle = item.style.color;
  ctx.lineWidth = item.style.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = item.style.opacity ?? 1;
}

function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function polyHit(pts: number[], x: number, y: number, tol: number) {
  if (pts.length === 2) return Math.hypot(x - pts[0], y - pts[1]) <= tol;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    if (segDist(x, y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) <= tol) return true;
  }
  return false;
}

const lineHit: ToolDef["hit"] = (it, x, y, tol) => polyHit(it.pts, x, y, tol + it.style.width / 2);

function arrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, unit: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = Math.max(w * 5, 12 * unit);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - h * Math.cos(a - Math.PI / 6), y2 - h * Math.sin(a - Math.PI / 6));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - h * Math.cos(a + Math.PI / 6), y2 - h * Math.sin(a + Math.PI / 6));
  ctx.stroke();
}

function textBox(ctx: CanvasRenderingContext2D, it: DrawItem) {
  ctx.font = `bold ${it.style.width}px ${TEXT_FONT}`;
  const w = ctx.measureText(it.text ?? "").width;
  // fillText 기준선(알파벳 기준) — 글자 높이만큼 위로
  return { x: it.pts[0], y: it.pts[1] - it.style.width, w, h: it.style.width * 1.25 };
}

export const TOOLS: ToolDef[] = [
  {
    id: "pen",
    label: "펜",
    input: "freehand",
    draw(ctx, it) {
      stroke(ctx, it);
      const p = it.pts;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      if (p.length === 2) ctx.lineTo(p[0] + 0.01, p[1]); // 점 하나도 보이게
      // 중간점 곡선 — 손떨림을 줄이고 매끈하게
      for (let i = 2; i + 3 < p.length; i += 2) {
        const mx = (p[i] + p[i + 2]) / 2;
        const my = (p[i + 1] + p[i + 3]) / 2;
        ctx.quadraticCurveTo(p[i], p[i + 1], mx, my);
      }
      if (p.length >= 4) ctx.lineTo(p[p.length - 2], p[p.length - 1]);
      ctx.stroke();
    },
    hit: lineHit,
  },
  {
    id: "line",
    label: "직선",
    input: "drag",
    draw(ctx, it) {
      stroke(ctx, it);
      const [x1, y1, x2, y2] = it.pts;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    },
    hit: lineHit,
  },
  {
    id: "arrow",
    label: "화살표",
    input: "drag",
    draw(ctx, it, unit) {
      stroke(ctx, it);
      const [x1, y1, x2, y2] = it.pts;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      arrowHead(ctx, x1, y1, x2, y2, it.style.width, unit);
    },
    hit: lineHit,
  },
  {
    id: "rect",
    label: "사각형",
    input: "drag",
    draw(ctx, it) {
      stroke(ctx, it);
      const [x1, y1, x2, y2] = it.pts;
      ctx.beginPath();
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    },
    hit(it, x, y, tol) {
      const [x1, y1, x2, y2] = it.pts;
      return polyHit([x1, y1, x2, y1, x2, y2, x1, y2, x1, y1], x, y, tol + it.style.width / 2);
    },
  },
  {
    id: "text",
    label: "텍스트",
    input: "text",
    draw(ctx, it) {
      stroke(ctx, it);
      ctx.font = `bold ${it.style.width}px ${TEXT_FONT}`;
      ctx.fillText(it.text ?? "", it.pts[0], it.pts[1]);
    },
    hit(it, x, y, tol, ctx) {
      const b = textBox(ctx, it);
      return x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol;
    },
  },
];

const BY_ID = new Map(TOOLS.map((t) => [t.id, t]));
export const toolDef = (id: string) => BY_ID.get(id);

/** 항목 하나 그리기(모르는 도구는 건너뜀) */
export function drawItem(ctx: CanvasRenderingContext2D, item: DrawItem, unit: number) {
  const def = BY_ID.get(item.tool);
  if (!def) return;
  ctx.save();
  def.draw(ctx, item, unit);
  ctx.restore();
}

export function drawItems(ctx: CanvasRenderingContext2D, items: DrawItem[], unit: number) {
  for (const it of items) drawItem(ctx, it, unit);
}

/** 점(x,y)에 닿는 맨 위 항목 id */
export function hitItem(ctx: CanvasRenderingContext2D, items: DrawItem[], x: number, y: number, tol: number) {
  for (let i = items.length - 1; i >= 0; i--) {
    const def = BY_ID.get(items[i].tool);
    if (def?.hit(items[i], x, y, tol, ctx)) return items[i].id;
  }
  return null;
}

/** 바탕 그리기 — 원본 이미지(있으면) 또는 종이 */
export function drawBase(ctx: CanvasRenderingContext2D, base: DrawBase, image: CanvasImageSource | null) {
  const { w, h } = base;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  if (image) {
    const v = base.view;
    if (v && (v.brightness || v.contrast || v.invert)) {
      ctx.filter = [
        v.brightness ? `brightness(${1 + v.brightness})` : "",
        v.contrast ? `contrast(${1 + v.contrast})` : "",
        v.invert ? "invert(1)" : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
    ctx.drawImage(image, 0, 0, w, h);
  } else if (base.paper === "grid" || base.paper === "lined") {
    const s = w / 1600; // 1600px 종이 기준 간격
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = Math.max(1, s);
    if (base.paper === "grid") {
      for (let x = 0; x <= w; x += 50 * s) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += 50 * s) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    } else {
      for (let y = 80 * s; y <= h; y += 70 * s) {
        ctx.beginPath();
        ctx.moveTo(40 * s, y);
        ctx.lineTo(w - 40 * s, y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** 보기용 그림(PNG) 굽기 — 바탕 + 그린 것 */
export async function flattenDoc(doc: DrawDoc, image: CanvasImageSource | null): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = doc.base.w;
  canvas.height = doc.base.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("그림을 만들 수 없습니다.");
  drawBase(ctx, doc.base, image);
  drawItems(ctx, doc.items, drawUnit(doc.base));
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("그림을 저장하지 못했습니다.");
  return blob;
}
