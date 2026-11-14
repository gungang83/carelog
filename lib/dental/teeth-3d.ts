// spec 037 2단계 — 3D 치아(시제품). 2D 원본(lib/dental/teeth.ts)의 치수·교합면 윤곽·아치 배치를 그대로 써서
// 치아 32개를 입체로 만든다(외부 모델 없이). 외부 모델(GLB)을 쓸 때도 같은 이름 규칙(T11~T48)을 따른다.
//
// 만드는 법: 교합면 윤곽을 단면으로, 치근 끝 → 치경선 → 치관 최대풍융부 → 교합면까지 높이별로 크기를 바꿔 쌓는다(로프트).
// 단위 mm · 좌표: X = 환자 좌측(+) / 우측(−), Y = 위(+, 상악 쪽), Z = 앞(+, 입술 쪽). 교합평면 Y = 0, 정중 전치 Z ≈ 0.

import * as THREE from "three";
import { dims, isUpper, occlusalAnatomy, occlusalLayout, occlusalOutline, toothPos, type Fdi, type Occlusal, type P } from "./teeth";

/** 외부·자체 모델 공통 메시 이름 규칙 */
export const meshName = (fdi: Fdi) => `T${fdi}`;
export const fdiFromMeshName = (name: string): Fdi | null => {
  const m = /^T([1-4][1-8])$/.exec(name);
  return m ? m[1] : null;
};

/** 닫힌 Catmull-Rom 곡선을 고르게 샘플링 */
function sampleClosed(pts: P[], perSeg: number): P[] {
  const n = pts.length;
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      const c = (a: number, b: number, cc: number, d: number) =>
        0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

type Ring = { y: number; sx: number; sy: number };

/** 높이 c(0 = 치경선, 1 = 교두정)에서의 치관 단면 배율. 전치는 절단연으로 얇아지고 견치는 교두정으로 모인다. */
function crownScale(pos: number, neck: number, c: number): [number, number] {
  const grow = c <= 0.42 ? Math.sin(((c / 0.42) * Math.PI) / 2) : 1;
  const sx = neck + (1 - neck) * grow;
  const top = Math.max(0, (c - 0.42) / 0.58); // 0 → 1
  if (pos <= 2) return [sx * (1 - 0.04 * top), sx * (1 - 0.86 * top)]; // 절단연으로 얇아짐(끝 ≈ 1mm대)
  if (pos === 3) return [sx * (1 - 0.5 * top * top), sx * (1 - 0.55 * top)];
  // 구치: 협·설면이 교합면 쪽으로 모인다(교합면 폭 ≈ 치관 협설 최대폭의 60~75%) — 교두정이 테두리 가까이 서고 오목한 접시가 되지 않게
  if (pos <= 5) return [sx * (1 - 0.12 * top * top), sx * (1 - 0.42 * top * top)];
  return [sx * (1 - 0.1 * top * top), sx * (1 - 0.34 * top * top)];
}

/** 치근 + 치관 옆면 단면(교합면 직전까지). y: 0 = 치경선, + 치관, − 치근 (mm). */
function sideRings(fdi: Fdi, trunk: number | null): { rings: Ring[]; apexY: number; table: [number, number]; neck: number } {
  const { crown: h, root: r } = dims(fdi);
  const pos = toothPos(fdi);
  const neck = pos >= 6 ? 0.78 : pos >= 4 ? 0.7 : 0.66;
  const rings: Ring[] = [];
  if (trunk !== null) {
    // 다근치: 치근간(root trunk)만 몸통에 두고, 그 아래는 갈래(rootTubes)로
    // 아래로 갈수록 원뿔처럼 좁아져 갈래들 사이로 스며든다 — 분지부가 평평한 천장(경계선) 없이 갈래 사이 V자 골로 이어짐
    for (const t of [1, 0.85, 0.7, 0.55, 0.4, 0.25, 0.1, 0]) {
      const s = neck * (1 - 0.62 * Math.pow(t, 1.4));
      rings.push({ y: -t * trunk * 1.1, sx: s, sy: s * 0.95 });
    }
    return { rings: [...rings, ...crownRings(pos, neck, h)], apexY: -trunk * 1.35, table: crownScale(pos, neck, 0.9), neck };
  }
  for (const t of [0.92, 0.75, 0.5, 0.25, 0]) {
    const s = neck * (1 - 0.82 * Math.pow(t, 1.5));
    rings.push({ y: -t * r, sx: s, sy: s * (pos <= 3 ? 1.05 : 0.95) });
  }
  return { rings: [...rings, ...crownRings(pos, neck, h)], apexY: -r, table: crownScale(pos, neck, 0.9), neck };
}

function crownRings(pos: number, neck: number, h: number): Ring[] {
  const rings: Ring[] = [];
  for (const c of [0.12, 0.28, 0.42, 0.58, 0.72]) {
    const [sx, sy] = crownScale(pos, neck, c);
    rings.push({ y: c * h, sx, sy });
  }
  return rings;
}

// ── 치근 갈래 ──────────────────────────────────────────────────────
// 평균 영구치 기준. 위치 = [u, v](치관 폭 비율, u + 원심 · v + 설측), 길이 = 치경선부터(mm), 반경 = 시작부 (근원심, 협설) mm.
// 상악 제1·2대구치 3근(근심협측·원심협측·구개근 — 구개근이 가장 길고 설측으로 벌어짐),
// 하악 제1·2대구치 2근(근심·원심 — 협설로 넓적, 원심으로 살짝 휨), 하악 제3대구치 2근(모아짐),
// 상악 제1소구치 2근(협측·구개측 — 근첨 쪽 절반에서 갈라짐). 그 외(전치·하악 소구치·상악 제2소구치·상악 제3대구치)는 단근.
type RootBranch = { start: [number, number]; apex: [number, number]; len: number; rx: number; rz: number };
type RootAnatomy = { trunk: number; roots: RootBranch[] };

function rootAnatomy(fdi: Fdi): RootAnatomy | null {
  const pos = toothPos(fdi);
  const up = isUpper(fdi);
  const { md, bl, root: r } = dims(fdi);
  if (up && (pos === 6 || pos === 7)) {
    const spread = pos === 6 ? 1 : 0.75; // 제2대구치는 덜 벌어진다
    return {
      trunk: 4,
      roots: [
        { start: [-0.22, -0.2], apex: [-0.22 + 0.1 * spread, -0.2 - 0.16 * spread], len: r * 0.95, rx: 0.2 * md, rz: 0.27 * bl },
        { start: [0.24, -0.2], apex: [0.24 + 0.12 * spread, -0.2 - 0.12 * spread], len: r * 0.88, rx: 0.18 * md, rz: 0.21 * bl },
        { start: [0, 0.24], apex: [0.02, 0.24 + 0.3 * spread], len: r * 1.05, rx: 0.27 * md, rz: 0.22 * bl },
      ],
    };
  }
  if (!up && pos >= 6) {
    const [m, d] = pos === 6 ? [-0.2, 0.36] : pos === 7 ? [-0.16, 0.28] : [-0.1, 0.12];
    return {
      trunk: 3,
      roots: [
        { start: [-0.24, 0], apex: [m, 0], len: r, rx: 0.2 * md, rz: 0.42 * bl },
        { start: [0.25, 0], apex: [d, 0], len: r * 0.92, rx: 0.18 * md, rz: 0.38 * bl },
      ],
    };
  }
  if (up && pos === 4) {
    return {
      trunk: r * 0.5,
      roots: [
        { start: [0, -0.18], apex: [0, -0.27], len: r, rx: 0.3 * md, rz: 0.17 * bl },
        { start: [0, 0.18], apex: [0, 0.28], len: r * 0.95, rx: 0.28 * md, rz: 0.16 * bl },
      ],
    };
  }
  return null;
}

/** 치근 갈래 하나 — 시작부(치근간 안쪽으로 1mm 겹침)에서 근첨까지 가늘어지며, 원심·바깥으로 살짝 휜다. 정점·면을 이어 붙인다. */
function addRootTube(
  b: RootBranch,
  trunk: number,
  md: number,
  bl: number,
  M: number,
  verts: [number, number, number][],
  shade: number[],
  idx: number[],
) {
  const y0 = 1; // 치경부 안쪽(치관 속)에서 시작 — 윗면이 밖으로 드러나지 않게
  const levels = [0.96, 0.88, 0.76, 0.64, 0.52, 0.4, 0.3, 0.2, 0.1, 0]; // 근첨 쪽 → 시작부(아래 → 위, 몸통과 같은 감기 방향)
  const base = verts.length;
  for (const t of levels) {
    const e = Math.pow(t, 1.3); // 끝으로 갈수록 더 휨
    const cx = (b.start[0] + (b.apex[0] - b.start[0]) * e) * md;
    const cz = (b.start[1] + (b.apex[1] - b.start[1]) * e) * bl;
    const y = y0 + (-b.len - y0) * t;
    // 치경부에선 몸통 안쪽에 들어가도록 좁게 시작 → 분지부 아래에서 바깥으로 벌어짐 → 근첨으로 가늘어짐
    const yFlare = Math.min(1, Math.max(0, (y0 - y) / (trunk + y0)));
    const flare = 0.72 + 0.28 * yFlare * yFlare * (3 - 2 * yFlare);
    const k = flare * (1 - 0.8 * Math.pow(t, 1.8));
    for (let i = 0; i < M; i++) {
      const th = (i / M) * Math.PI * 2;
      verts.push([cx + Math.cos(th) * b.rx * k, y, cz + Math.sin(th) * b.rz * k]);
      shade.push(1);
    }
  }
  const apex = verts.length;
  verts.push([b.apex[0] * md, -b.len, b.apex[1] * bl]);
  shade.push(1);
  const top = verts.length;
  verts.push([b.start[0] * md, y0, b.start[1] * bl]);
  shade.push(1);
  for (let k = 0; k < levels.length - 1; k++) {
    for (let i = 0; i < M; i++) {
      const a0 = base + k * M + i;
      const a1 = base + k * M + ((i + 1) % M);
      const c0 = base + (k + 1) * M + i;
      const c1 = base + (k + 1) * M + ((i + 1) % M);
      idx.push(a0, c0, a1, a1, c0, c1);
    }
  }
  const last = base + (levels.length - 1) * M;
  for (let i = 0; i < M; i++) {
    idx.push(apex, base + i, base + ((i + 1) % M));
    idx.push(top, last + ((i + 1) % M), last + i);
  }
}

/** 부드러운 최댓값(log-sum-exp) — 겹치는 융선·교두 사이가 자연스러운 골이 된다 */
function softMax(vals: number[], k: number): number {
  const m = Math.max(...vals);
  let acc = 0;
  for (const v of vals) acc += Math.exp(k * (v - m));
  return m + Math.log(acc) / k;
}

/** 선분 위 가장 가까운 점의 비율(0~1)과 거리 */
function segNear(u: number, v: number, a: [number, number], b: [number, number], aspect: number): { t: number; d: number } {
  const dx = b[0] - a[0];
  const dy = (b[1] - a[1]) * aspect;
  const px = u - a[0];
  const py = (v - a[1]) * aspect;
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy || 1)));
  return { t, d: Math.hypot(px - t * dx, py - t * dy) };
}

/**
 * 교합면 높이(0~1)와 구 깊이(음영용). r = 테두리에서 1, 중심 0(동심 고리 비율).
 * 구성: 교두(원뿔) · 삼각융선(교두정 → 중심와로 내려가는 능선) · 변연융선·교두융선(테두리 둘레 능선)을 부드러운 최댓값으로 합치고,
 *       중심구·발육구를 V자로 판다. 교두는 테두리(옆면)와 이어져 협·설면에서 보면 교두정이 윤곽의 봉우리가 된다.
 */
function occlusalField(o: Occlusal, u: number, v: number, aspect: number, r: number, pos: number): { f: number; groove: number } {
  const terms: number[] = [];
  const posterior = pos >= 4;
  for (const [cu, cv, ch, cr] of o.cusps) {
    // 교두 바깥쪽(치아 가장자리 방향) 비탈은 길게 — 협·설면이 교두정까지 끊김 없이 올라간다(교두 아래 턱이 생기지 않게)
    // 소구치 교두는 근원심으로 길게(교두융선 — 교두정에서 근·원심 변연융선까지 이어지는 능선) — 둥근 혹이 아니라 능선
    const premolar = pos === 4 || pos === 5;
    const du = (u - cu) / (premolar ? 1.35 : 1.1);
    const dv = (v - cv) * aspect;
    const rl = Math.hypot(cu, cv * aspect) || 1;
    const out = (du * cu + dv * cv * aspect) / rl;
    const perp = Math.sqrt(Math.max(0, du * du + dv * dv - out * out));
    const d = Math.hypot(perp, out > 0 ? out * 0.5 : out) / (cr * 1.4);
    // 교두정 근처는 둥글게, 경사면은 곧게(원뿔)
    const ds = Math.sqrt(d * d + 0.012) - 0.11;
    terms.push(ch * Math.max(0, 1 - Math.max(0, ds)) ** (premolar ? 1 : 1.5)); // 교두정은 또렷하게(소구치는 경사면을 곧게)
    if (posterior) {
      // 삼각융선 — 교두정에서 중심(0, 0) 쪽으로 70%까지, 내려가며 낮아진다
      const n = segNear(u, v, [cu, cv], [cu * 0.3, cv * 0.3], aspect);
      terms.push(ch * (1 - 0.5 * n.t) - (n.d / 0.075) ** 2 * 0.12);
    }
  }
  // 테두리 능선(변연융선·교두융선) — 테두리에서 높고 안쪽(중심와)으로 내려간다
  //  구치는 근·원심 끝(변연융선)이 높고, 협·설측 가장자리는 교두가 만들므로 낮게 둔다(테두리 전체가 턱처럼 솟지 않게)
  const wm = Math.max(0, Math.min(1, (Math.abs(u) - 0.18) / 0.22));
  const rimH = pos <= 2 ? 0.9 : pos === 3 ? 0.18 : pos <= 5 ? 0.3 + 0.2 * wm * wm * (3 - 2 * wm) : 0.36 + 0.3 * wm * wm * (3 - 2 * wm); // 견치·소구치는 교두정에서 근·원심으로 비탈(오각형)
  const e = Math.max(0, Math.min(1, (r - 0.5) / 0.45));
  terms.push(rimH * e * e * (3 - 2 * e));
  let f = softMax(terms, 14);
  let g = 0;
  let ridge = 0;
  for (const [a, b, depth] of o.grooves) {
    const n = segNear(u, v, a, b, aspect);
    if (depth > 0) g = Math.max(g, depth * Math.exp(-((n.d / 0.055) ** 2)));
    else ridge = Math.max(ridge, -depth * Math.exp(-((n.d / 0.09) ** 2)));
  }
  // 3D 바닥 보정: 절치 절단연은 얇은 능선(설측와는 설면에 있다 — 절단면이 오목한 쟁반이 되지 않게), 견치 설측와는 얕게
  const floor = pos <= 2 ? 0.86 : pos === 3 ? 0.34 : o.floor;
  f = Math.max(floor, Math.min(1.05, f + ridge * 0.25)) - 0.55 * g;
  return { f, groove: g };
}

/** 치아 한 개 지오메트리(로컬: x = 원심, z = 설측(교합면 로컬 +y), y = 높이) + 정점 음영(구에 어둡게). */
function toothLocalPoints(fdi: Fdi, segs = 16) {
  const outline = sampleClosed(occlusalOutline(fdi), segs);
  const M = outline.length;
  const { md, bl, crown: h } = dims(fdi);
  const pos = toothPos(fdi);
  const roots = rootAnatomy(fdi);
  const { rings, apexY, table } = sideRings(fdi, roots ? roots.trunk : null);
  const anat = occlusalAnatomy(fdi);
  const aspect = bl / md;
  // 교두정 ~ 와(fossa) 높이 차 — 소구치는 교두가 더 솟는다(협측 교두정 ~ 변연융선 1.5mm 안팎)
  const D = anat.depth * h * (pos === 4 || pos === 5 ? 1.35 : 1);
  const verts: [number, number, number][] = [];
  const shade: number[] = [];
  const field = (x: number, z: number, r: number) => occlusalField(anat, x / md, z / bl, aspect, r, pos);

  rings.forEach((ring) => {
    outline.forEach(([x, z]) => {
      verts.push([x * ring.sx, ring.y, z * ring.sy]);
      shade.push(1);
    });
  });
  // 옆면 → 교합면 테두리: 점마다 테두리 높이(교두정이면 높고, 교두 사이·구가 지나는 곳은 낮다)까지 이어 올린다
  //  → 협·설면에서 보면 교두정이 윤곽의 봉우리로 솟는다(평평한 턱 위에 교합면이 얹힌 모양이 아니라)
  const lastSide = rings[rings.length - 1];
  const rimY = outline.map(([x, z]) => h - D * (1 - field(x * table[0], z * table[1], 1).f));
  for (const s of [0.3, 0.55, 0.78, 0.93]) {
    const bulge = 1 + 0.035 * Math.sin(Math.PI * s); // 교합면 바로 아래 살짝 볼록
    outline.forEach(([x, z], i) => {
      // 안으로 모이는 것과 올라가는 것을 함께(곧게 오므라드는 협·설면) — 먼저 올라갔다가 끝에서 꺾이면 턱(상자) 모양이 된다
      const sx = (lastSide.sx + (table[0] - lastSide.sx) * s) * bulge;
      const sz = (lastSide.sy + (table[1] - lastSide.sy) * s) * bulge;
      const y = lastSide.y + (rimY[i] - lastSide.y) * (1 - (1 - s) ** 1.15);
      verts.push([x * sx, y, z * sz]);
      shade.push(1);
    });
  }
  // 교합면: 테두리(t=1)에서 중심(t→0)까지 동심 고리 — 테두리 쪽을 촘촘히
  const levels: number[] = [];
  for (let i = 0; i <= 26; i++) levels.push(1 - Math.pow(i / 27, 1.15) * 0.985);
  levels.forEach((t) => {
    outline.forEach(([x, z]) => {
      const px = x * table[0] * t;
      const pz = z * table[1] * t;
      const { f, groove } = field(px, pz, t);
      verts.push([px, h - D * (1 - f), pz]);
      shade.push(1 - 0.32 * Math.min(1, groove));
    });
  });
  const apex = verts.length;
  verts.push([0, apexY, 0]);
  shade.push(1);
  const center = verts.length;
  {
    const { f, groove } = field(0, 0, 0);
    verts.push([0, h - D * (1 - f), 0]);
    shade.push(1 - 0.32 * Math.min(1, groove));
  }

  const idx: number[] = [];
  const bands = rings.length + 4 + levels.length;
  for (let k = 0; k < bands - 1; k++) {
    for (let i = 0; i < M; i++) {
      const a = k * M + i;
      const b = k * M + ((i + 1) % M);
      const c = (k + 1) * M + i;
      const d = (k + 1) * M + ((i + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  }
  const last = (bands - 1) * M;
  for (let i = 0; i < M; i++) {
    idx.push(apex, i, (i + 1) % M); // 치근 끝
    idx.push(center, last + ((i + 1) % M), last + i); // 교합면 중심
  }
  for (const b of roots?.roots ?? []) addRootTube(b, roots!.trunk, md, bl, 32, verts, shade, idx);
  return { verts, idx, shade };
}

export type ToothMesh3D = { fdi: Fdi; geometry: THREE.BufferGeometry };

type ArchOpts3D = { withThirdMolars?: boolean; occlusalGap?: number };

/** 2D 교합면 배치(mm) → 3D 월드 좌표 변환. 치아·치간 지점이 같은 변환을 쓴다. */
function archFrame(opts: ArchOpts3D) {
  const layout = occlusalLayout({ withThirdMolars: opts.withThirdMolars, scale: 1, pad: 0 });
  const cx = layout.width / 2;
  const gap = opts.occlusalGap ?? 0.4;
  const upperFront = Math.min(...layout.teeth.filter((t) => isUpper(t.fdi)).map((t) => t.cy));
  const lowerFront = Math.max(...layout.teeth.filter((t) => !isUpper(t.fdi)).map((t) => t.cy));
  /** (2D 배치 x, y) + 치경선 기준 높이 hy(치관 높이 h) → 월드 [X, Y, Z] */
  const toWorld = (up: boolean, lx: number, ly: number, h: number, hy: number): [number, number, number] => [
    lx - cx,
    // 상악은 치관이 아래(교합평면)로, 하악은 위로
    up ? gap + (h - hy) : -gap - (h - hy),
    up ? upperFront - ly : ly - lowerFront,
  ];
  return { layout, toWorld };
}

/** 32개(8-8) 또는 28개(7-7) 치아 지오메트리 — 월드 좌표(mm)로 굽는다. */
export function buildProceduralTeeth(opts: ArchOpts3D = {}): ToothMesh3D[] {
  const { layout, toWorld } = archFrame(opts);
  return layout.teeth.map((t) => {
    const [a, b, c, d, e, f] = t.matrix;
    const up = isUpper(t.fdi);
    const { crown: h } = dims(t.fdi);
    const { verts, idx, shade } = toothLocalPoints(t.fdi);
    const pos: number[] = [];
    for (const [x, hy, z] of verts) {
      // 교합면 로컬(x, z)는 2D 배치 행렬로 아치 위에 놓인다(z = 2D 로컬 y)
      pos.push(...toWorld(up, a * x + c * z + e, b * x + d * z + f, h, hy));
    }
    // 거울상 배치(좌우·상하 반전)로 면 방향이 뒤집힌 치아는 감기 순서를 바로잡는다(부피 부호로 판정)
    let vol = 0;
    for (let i = 0; i < idx.length; i += 3) {
      const p = (k: number) => new THREE.Vector3(pos[idx[k] * 3], pos[idx[k] * 3 + 1], pos[idx[k] * 3 + 2]);
      vol += p(i).dot(p(i + 1).cross(p(i + 2)));
    }
    if (vol < 0) {
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    // 구(groove)·와(fossa)를 살짝 어둡게 — 재질 색과 곱해진다(선택 색을 칠해도 구가 보인다)
    g.setAttribute("color", new THREE.Float32BufferAttribute(shade.flatMap((v) => [v, v, v * 0.97]), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return { fdi: t.fdi, geometry: g };
  });
}

export type GapPoint3D = { id: string; upper: boolean; position: [number, number, number] };

/** 치아 사이(치간) 지점 — 협·순측 바깥, 치경부 1/3 높이(치간칫솔이 들어가는 자리). id = "17-16". */
export function buildGapPoints3D(opts: ArchOpts3D = {}): GapPoint3D[] {
  const { layout, toWorld } = archFrame(opts);
  return layout.gaps.map((g) => {
    const [ta, tb] = g.id.split("-");
    const up = isUpper(ta);
    const h = (dims(ta).crown + dims(tb).crown) / 2;
    const off = (Math.max(dims(ta).bl, dims(tb).bl) / 2) * 0.9 + 1.2;
    return { id: g.id, upper: up, position: toWorld(up, g.x + g.nx * off, g.y + g.ny * off, h, h * 0.22) };
  });
}

// ── 치아 기준틀(3D 위에 층을 얹는 기능용) ───────────────────────────────────
// 치주 차트(spec 040) 3D처럼 "몇 번 치아 어느 면, CEJ에서 몇 mm"를 3D 좌표와 오가게 한다.

export type V3 = [number, number, number];
export type ToothFrame3D = {
  fdi: Fdi;
  upper: boolean;
  /** CEJ 높이의 치아 중심(월드 mm) */
  cej: V3;
  /** 단위 벡터: 원심 쪽 · 설측(안쪽) 쪽 · 치근 쪽 */
  distal: V3;
  lingual: V3;
  root: V3;
  /** CEJ에서의 근원심·협설 반폭(mm) */
  halfMd: number;
  halfBl: number;
  crown: number;
  rootLen: number;
};

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (v: V3): V3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** 치경부 단면 배율(치관 최대폭 대비) — sideRings와 같은 값 */
export const neckFactor = (fdi: Fdi) => (toothPos(fdi) >= 6 ? 0.78 : toothPos(fdi) >= 4 ? 0.7 : 0.66);

export function toothFrames3D(opts: ArchOpts3D = {}): ToothFrame3D[] {
  const { layout, toWorld } = archFrame(opts);
  return layout.teeth.map((t) => {
    const [a, b, c, d, e, f] = t.matrix;
    const up = isUpper(t.fdi);
    const { md, bl, crown: h, root: r } = dims(t.fdi);
    const w = (x: number, z: number, hy: number) => toWorld(up, a * x + c * z + e, b * x + d * z + f, h, hy);
    const cej = w(0, 0, 0);
    const nf = neckFactor(t.fdi);
    return {
      fdi: t.fdi,
      upper: up,
      cej,
      distal: unit(sub(w(1, 0, 0), cej)),
      lingual: unit(sub(w(0, 1, 0), cej)),
      root: up ? [0, 1, 0] : [0, -1, 0],
      halfMd: (md / 2) * nf,
      halfBl: (bl / 2) * nf,
      crown: h,
      rootLen: r,
    };
  });
}

/** 기준틀 위 한 점: 면(B/L)·부위(D/C/M)의 표면, CEJ에서 치근 쪽으로 mm(음수 = 치관 쪽) · out = 표면 밖으로 띄울 거리 */
export function sitePoint3D(f: ToothFrame3D, side: "B" | "L", pos: "D" | "C" | "M", mmRootward: number, out = 0): V3 {
  const x = (pos === "D" ? 0.62 : pos === "M" ? -0.62 : 0) * f.halfMd;
  const sgn = side === "B" ? -1 : 1;
  // 치근 쪽으로 갈수록 가늘어진다(근첨에서 약 40%)
  const taper = 1 - 0.6 * Math.max(0, Math.min(1, mmRootward / f.rootLen));
  const z = sgn * (f.halfBl * (pos === "C" ? 1 : 0.86) * taper + out);
  return [
    f.cej[0] + f.distal[0] * x * taper + f.lingual[0] * z + f.root[0] * mmRootward,
    f.cej[1] + f.distal[1] * x * taper + f.lingual[1] * z + f.root[1] * mmRootward,
    f.cej[2] + f.distal[2] * x * taper + f.lingual[2] * z + f.root[2] * mmRootward,
  ];
}

/**
 * 탐침 선 위의 점 — 그 부위의 CEJ에서 치아 장축과 나란히 mm만큼(뿌리 쪽 +).
 * sitePoint3D는 뿌리 표면을 따라 안으로 좁아지지만(대구치 M·D에서 비스듬), 탐침·눈금은 실제처럼 장축과 평행하게 선다.
 */
export function probePoint3D(f: ToothFrame3D, side: "B" | "L", pos: "D" | "C" | "M", mmRootward: number, out = 0): V3 {
  const b = sitePoint3D(f, side, pos, 0, out);
  return [b[0] + f.root[0] * mmRootward, b[1] + f.root[1] * mmRootward, b[2] + f.root[2] * mmRootward];
}

/** 3D 점 → 그 치아의 면·부위·CEJ 기준 mm(+ 치관 쪽, 2D 차트와 같은 부호) */
export function pointToSite3D(f: ToothFrame3D, p: V3): { side: "B" | "L"; pos: "D" | "C" | "M"; mm: number } {
  const v = sub(p, f.cej);
  const dot = (u: V3) => v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
  const md = dot(f.distal) / f.halfMd;
  return { side: dot(f.lingual) < 0 ? "B" : "L", pos: md > 0.34 ? "D" : md < -0.34 ? "M" : "C", mm: -dot(f.root) };
}
