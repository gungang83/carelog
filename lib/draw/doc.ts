// spec 039 — 그리기 엔진의 편집용 기록(DrawDoc).
// 보기용 PNG와 함께 저장해, 다시 열면 그린 것 하나하나를 고치거나 지울 수 있게 한다.
// ★호환 규칙: 버전(v)을 올려도 예전 기록은 upgradeDoc에서 계속 읽는다. 원본(base.ref)은 절대 수정하지 않는다.

export const DRAW_DOC_VERSION = 1 as const;

export type DrawBaseKind = "image" | "xray" | "blank" | "teeth2d" | "teeth3d";
export type DrawPaper = "plain" | "grid" | "lined";

export type DrawBase = {
  kind: DrawBaseKind;
  /** 원본 위치(공개 URL 또는 비공개 저장소 경로). 없으면 아직 올리지 않은 원본 — 저장하는 쪽이 올리고 채운다. */
  ref?: string;
  /** 좌표계 = 원본 픽셀 크기(그린 좌표는 해상도와 무관하게 이 기준) */
  w: number;
  h: number;
  /** 엑스레이 보기 조정(원본 무변경) — spec 039 2단계 */
  view?: { brightness?: number; contrast?: number; invert?: boolean };
  /** blank일 때 종이 */
  paper?: DrawPaper;
};

export type DrawItem = {
  id: string;
  /** 도구 이름(lib/draw/render.ts 등록부) */
  tool: string;
  /** [x1,y1,x2,y2,…] — 원본 픽셀 좌표 */
  pts: number[];
  /** width = 선 굵기(원본 px). text는 글자 크기 */
  style: { color: string; width: number; opacity?: number };
  text?: string;
  stamp?: string;
  /** 그린 시각 */
  at?: string;
};

export type DrawDoc = {
  v: typeof DRAW_DOC_VERSION;
  base: DrawBase;
  /** 이후 "model"(3D 표면 좌표) — spec 039 4단계 */
  space: "image";
  items: DrawItem[];
  /** 엑스레이 실측 보정 — spec 039 2단계 */
  calib?: { mmPerPx: number; by: string };
};

/** 편집용 기록 파일 이름 규칙: 보기용 그림 옆에 `<이름>.draw.json` */
export const DRAW_DOC_SUFFIX = ".draw.json";

export function newDoc(base: DrawBase): DrawDoc {
  return { v: DRAW_DOC_VERSION, base, space: "image", items: [] };
}

/** 그리기 단위 — 900px 화면 기준 굵기·글자 크기를 원본 크기에 맞춰 키운다(예전 도구와 같은 느낌). */
export function drawUnit(base: Pick<DrawBase, "w" | "h">): number {
  return Math.max(base.w, base.h) / 900;
}

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** 저장된 기록(JSON)을 지금 버전으로 읽는다. 알아볼 수 없으면 null(호출 측은 보기용 그림 위에 덧그리기로 대체). */
export function upgradeDoc(raw: unknown): DrawDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  // v1 — 이후 버전이 생기면 여기서 단계별로 올려 읽는다(if (r.v === 1) r = v1to2(r) …)
  if (r.v !== 1) return null;
  const base = r.base as DrawBase | undefined;
  if (!base || !isNum(base.w) || !isNum(base.h) || base.w <= 0 || base.h <= 0) return null;
  const items = Array.isArray(r.items) ? (r.items as DrawItem[]) : [];
  return {
    v: DRAW_DOC_VERSION,
    base: { ...base },
    space: "image",
    items: items.filter(
      (it) =>
        it &&
        typeof it.tool === "string" &&
        Array.isArray(it.pts) &&
        it.pts.every(isNum) &&
        it.style &&
        typeof it.style.color === "string" &&
        isNum(it.style.width),
    ),
    ...(r.calib ? { calib: r.calib as DrawDoc["calib"] } : {}),
  };
}

export function newItemId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}
