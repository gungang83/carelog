// spec 037 2단계 — 3D 치아(시제품). 2D 원본(lib/dental/teeth.ts)의 치수·교합면 윤곽·아치 배치를 그대로 써서
// 치아 32개를 입체로 만든다(외부 모델 없이). 외부 모델(GLB)을 쓸 때도 같은 이름 규칙(T11~T48)을 따른다.
//
// 만드는 법: 교합면 윤곽을 단면으로, 치근 끝 → 치경선 → 치관 최대풍융부 → 교합면까지 높이별로 크기를 바꿔 쌓는다(로프트).
// 단위 mm · 좌표: X = 환자 좌측(+) / 우측(−), Y = 위(+, 상악 쪽), Z = 앞(+, 입술 쪽). 교합평면 Y = 0, 정중 전치 Z ≈ 0.

import * as THREE from "three";
import { dims, isUpper, occlusalLayout, occlusalOutline, toothPos, type Fdi, type P } from "./teeth";

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
function sideRings(fdi: Fdi): { rings: Ring[]; apexY: number; table: [number, number]; neck: number } {
  const { crown: h, root: r } = dims(fdi);
  const pos = toothPos(fdi);
  const neck = pos >= 6 ? 0.78 : pos >= 4 ? 0.7 : 0.66;
  const rings: Ring[] = [];
  for (const t of [0.92, 0.75, 0.5, 0.25, 0]) {
    const s = neck * (1 - 0.82 * Math.pow(t, 1.5));
    rings.push({ y: -t * r, sx: s, sy: s * (pos <= 3 ? 1.05 : 0.95) });
  }
  for (const c of [0.12, 0.28, 0.42, 0.58, 0.72, 0.8]) {
    const [sx, sy] = crownScale(pos, neck, c);
    rings.push({ y: c * h, sx, sy });
  }
  return { rings, apexY: -r, table: crownScale(pos, neck, 0.9), neck };
}

// ── 교합면 해부 ─────────────────────────────────────────────────────
// 좌표: u = 근원심(+ 원심), v = 협설(− 협·순측, + 설측), 둘 다 치아 폭으로 나눈 값(−0.5 ~ 0.5).
// 교두 = [u, v, 높이(0~1), 반경] · 구(groove) = [시작, 끝, 깊이] — 깊이가 음수면 융선(ridge, 솟음).
// 평균 영구치 형태학 기준: 상악 대구치 4교두(근심설측 최대 · 사선융선 · 협측구 · 원심설측구),
// 하악 제1대구치 5교두(설측 교두가 높음 · 근심/원심협측구 · 설측구), 하악 제2대구치 4교두(+자 구),
// 상악 소구치 2교두(협측 > 설측) · 하악 제1소구치(협측 우세 · 작은 설측) · 하악 제2소구치 3교두(Y자 구),
// 견치 1교두(교두정 약간 근심 · 설측 융선), 절치 절단연(발육엽 흔적).
type Cusp = [number, number, number, number];
type Groove = [[number, number], [number, number], number];
type Occlusal = { cusps: Cusp[]; grooves: Groove[]; depth: number; floor: number };

function occlusalAnatomy(fdi: Fdi): Occlusal {
  const pos = toothPos(fdi);
  const up = isUpper(fdi);
  if (pos <= 2) {
    // 절치: 절단연(융선) + 발육엽 3개의 얕은 굴곡
    return {
      cusps: [[-0.26, -0.2, 0.96, 0.26], [0, -0.2, 1, 0.26], [0.26, -0.2, 0.95, 0.26]],
      grooves: [[[-0.42, -0.2], [0.42, -0.2], -0.5]],
      depth: 0.12,
      floor: 0.55,
    };
  }
  if (pos === 3) {
    // 견치: 교두정(약간 근심) + 설측 융선, 양옆 얕은 설측와
    return {
      cusps: [[-0.06, -0.12, 1, 0.55]],
      grooves: [
        [[-0.06, -0.12], [0, 0.36], -0.35],
        [[-0.2, 0.02], [-0.14, 0.3], 0.35],
        [[0.16, 0.02], [0.12, 0.3], 0.35],
      ],
      depth: 0.32,
      floor: 0.2,
    };
  }
  if (pos <= 5 && up) {
    // 상악 소구치: 협측·설측 2교두, 근원심 중심구 + 양끝 삼각구
    return {
      cusps: [[0, -0.2, 1, 0.36], [pos === 4 ? 0.04 : 0, 0.22, pos === 4 ? 0.82 : 0.95, 0.32]],
      grooves: [
        [[-0.3, 0.02], [0.3, 0.02], 1],
        [[-0.3, 0.02], [-0.38, -0.14], 0.55],
        [[0.3, 0.02], [0.38, -0.14], 0.55],
        [[-0.3, 0.02], [-0.36, 0.18], 0.4],
        [[0.3, 0.02], [0.36, 0.18], 0.4],
      ],
      depth: 0.32,
      floor: 0.18,
    };
  }
  if (pos === 4) {
    // 하악 제1소구치: 큰 협측 교두 + 작은 설측 교두, 횡주융선, 근·원심 소와
    return {
      cusps: [[0, -0.12, 1, 0.42], [0, 0.3, 0.45, 0.2]],
      grooves: [
        [[0, -0.12], [0, 0.3], -0.3],
        [[-0.2, 0.1], [-0.3, 0.32], 0.7],
        [[0.2, 0.1], [0.3, 0.3], 0.7],
      ],
      depth: 0.3,
      floor: 0.2,
    };
  }
  if (pos === 5) {
    // 하악 제2소구치(3교두형): 협측 + 근심설측·원심설측, Y자 구
    return {
      cusps: [[0, -0.2, 1, 0.36], [-0.17, 0.24, 0.8, 0.24], [0.2, 0.25, 0.7, 0.22]],
      grooves: [
        [[-0.32, 0.02], [0.02, 0.06], 1],
        [[0.02, 0.06], [0.32, 0.02], 1],
        [[0.02, 0.06], [0.03, 0.48], 0.8],
      ],
      depth: 0.3,
      floor: 0.16,
    };
  }
  if (up) {
    // 상악 대구치: 근심협측·원심협측·근심설측(최대)·원심설측(제2·3대구치는 작다) + 사선융선
    const dl = pos === 6 ? 0.68 : 0.5;
    return {
      cusps: [[-0.24, -0.26, 0.95, 0.3], [0.24, -0.26, 0.85, 0.27], [-0.2, 0.22, 1, 0.36], [0.28, 0.28, dl, 0.22]],
      grooves: [
        [[-0.36, 0.0], [0.04, -0.02], 1], // 중심구(근심 → 중심와)
        [[0.02, -0.04], [0.02, -0.48], 0.9], // 협측구
        [[0.12, 0.04], [0.34, 0.06], 0.6], // 원심 소와로
        [[0.1, 0.06], [0.32, 0.46], 0.9], // 원심설측구
        [[-0.2, 0.22], [0.24, -0.26], -0.38], // 사선융선
      ],
      depth: 0.36,
      floor: 0.12,
    };
  }
  if (pos === 6) {
    // 하악 제1대구치: 5교두(협측 3 · 설측 2, 설측이 높다)
    return {
      cusps: [
        [-0.3, -0.25, 0.85, 0.26],
        [0.02, -0.28, 0.8, 0.24],
        [0.33, -0.16, 0.65, 0.18],
        [-0.26, 0.25, 1, 0.28],
        [0.16, 0.26, 0.95, 0.26],
      ],
      grooves: [
        [[-0.42, 0.0], [0.4, 0.03], 1], // 중심구
        [[-0.13, 0.0], [-0.15, -0.48], 0.85], // 근심협측구
        [[0.2, 0.02], [0.28, -0.44], 0.7], // 원심협측구
        [[-0.05, 0.01], [-0.04, 0.48], 0.85], // 설측구
      ],
      depth: 0.36,
      floor: 0.12,
    };
  }
  // 하악 제2·3대구치: 4교두, +자 구
  return {
    cusps: [[-0.25, -0.25, 0.85, 0.28], [0.25, -0.25, 0.8, 0.27], [-0.25, 0.25, 1, 0.28], [0.25, 0.25, 0.95, 0.27]],
    grooves: [
      [[-0.42, 0.0], [0.42, 0.0], 1],
      [[0.0, 0.0], [0.0, -0.48], 0.85],
      [[0.0, 0.0], [0.0, 0.48], 0.85],
    ],
    depth: 0.36,
    floor: 0.12,
  };
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
  const { rings, apexY, table } = sideRings(fdi);
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
