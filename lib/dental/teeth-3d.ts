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
  if (pos <= 2) return [sx * (1 - 0.04 * top), sx * (1 - 0.72 * top)];
  if (pos === 3) return [sx * (1 - 0.5 * top * top), sx * (1 - 0.55 * top)];
  return [sx * (1 - 0.1 * top * top), sx * (1 - 0.16 * top * top)];
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
  for (const c of [0.12, 0.28, 0.42, 0.58, 0.72, 0.8]) {
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

function segDist(u: number, v: number, [a, b]: [[number, number], [number, number]], aspect: number): number {
  // v는 협설 폭 비율만큼 늘려 실제 거리(근원심 폭 단위)로
  const ax = a[0];
  const ay = a[1] * aspect;
  const bx = b[0];
  const by = b[1] * aspect;
  const px = u;
  const py = v * aspect;
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** 교합면 높이(0~1)와 구 깊이(음영용) */
function occlusalField(o: Occlusal, u: number, v: number, aspect: number): { f: number; groove: number } {
  // 교두 = 뾰족한 원뿔(교두정에서 삼각융선이 중심구로 내려감), 겹치는 곳은 부드러운 최댓값(log-sum-exp) — 교두 사이가 골이 된다
  const k = 10;
  let acc = 0;
  for (const [cu, cv, ch, cr] of o.cusps) {
    const d = Math.hypot(u - cu, (v - cv) * aspect) / (cr * 1.3);
    // 교두정 바로 근처만 살짝 둥글게(바늘처럼 뾰족하지 않게) — 부드러운 거리
    const ds = Math.sqrt(d * d + 0.01) - 0.1;
    acc += Math.exp(k * ch * Math.pow(Math.max(0, 1 - ds), 1.15));
  }
  const hill = Math.log(acc / Math.max(1, o.cusps.length * 0.5)) / k;
  let g = 0;
  let ridge = 0;
  for (const [a, b, depth] of o.grooves) {
    const w = depth > 0 ? 0.045 : 0.09;
    const e = Math.exp(-Math.pow(segDist(u, v, [a, b], aspect) / w, 2));
    if (depth > 0) g = Math.max(g, depth * e);
    else ridge = Math.max(ridge, -depth * e);
  }
  const f = Math.max(o.floor, Math.min(1.05, hill + ridge * 0.6)) - 0.5 * g;
  return { f, groove: g };
}

/** 치아 한 개 지오메트리(로컬: x = 원심, z = 설측(교합면 로컬 +y), y = 높이) + 정점 음영(구에 어둡게). */
function toothLocalPoints(fdi: Fdi, segs = 10) {
  const outline = sampleClosed(occlusalOutline(fdi), segs);
  const M = outline.length;
  const { md, bl, crown: h } = dims(fdi);
  const roots = rootAnatomy(fdi);
  const { rings, apexY, table } = sideRings(fdi, roots ? roots.trunk : null);
  const anat = occlusalAnatomy(fdi);
  const aspect = bl / md;
  const D = anat.depth * h; // 교두정 ~ 와(fossa) 높이 차
  const verts: [number, number, number][] = [];
  const shade: number[] = [];

  rings.forEach((ring) => {
    outline.forEach(([x, z]) => {
      verts.push([x * ring.sx, ring.y, z * ring.sy]);
      shade.push(1);
    });
  });
  // 교합면: 테두리(t=1)에서 중심(t→0)까지 동심 고리, 높이 = 교합면 해부 필드
  const levels = [1, 0.93, 0.85, 0.77, 0.69, 0.61, 0.53, 0.46, 0.39, 0.32, 0.25, 0.18, 0.11, 0.05];
  const rimMin = 0.84 * h; // 옆면 마지막 고리(0.8h)보다 아래로 접히지 않게
  levels.forEach((t) => {
    outline.forEach(([x, z]) => {
      const px = x * table[0] * t;
      const pz = z * table[1] * t;
      const { f, groove } = occlusalField(anat, px / md, pz / bl, aspect);
      let y = h - D * (1 - f);
      if (t === 1) y = Math.max(y, rimMin);
      verts.push([px, y, pz]);
      shade.push(1 - 0.3 * Math.min(1, groove));
    });
  });
  const apex = verts.length;
  verts.push([0, apexY, 0]);
  shade.push(1);
  const center = verts.length;
  {
    const { f, groove } = occlusalField(anat, 0, 0, aspect);
    verts.push([0, h - D * (1 - f), 0]);
    shade.push(1 - 0.3 * Math.min(1, groove));
  }

  const idx: number[] = [];
  const bands = rings.length + levels.length;
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
