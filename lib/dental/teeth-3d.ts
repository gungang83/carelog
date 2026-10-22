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

type Ring = { y: number; sx: number; sy: number; bump?: number };

/** 높이별 단면 크기. y: 0 = 치경선, + 치관, − 치근 (mm). sx = 근원심, sy = 협설 배율. */
function profile(fdi: Fdi): { rings: Ring[]; capY: number; apexY: number; cusps: number } {
  const { crown: h, root: r } = dims(fdi);
  const pos = toothPos(fdi);
  const neck = pos >= 6 ? 0.78 : pos >= 4 ? 0.7 : 0.66;
  const rings: Ring[] = [];
  // 치근: 끝으로 갈수록 가늘게
  for (const t of [0.92, 0.75, 0.5, 0.25, 0]) {
    const s = neck * (1 - 0.82 * Math.pow(t, 1.5));
    rings.push({ y: -t * r, sx: s, sy: s * (pos <= 3 ? 1.05 : 0.95) });
  }
  // 치관: 치경선 → 최대풍융부(약 40%) → 교합면
  for (const c of [0.12, 0.28, 0.42, 0.58, 0.74, 0.88, 1]) {
    const grow = c <= 0.42 ? Math.sin(((c / 0.42) * Math.PI) / 2) : 1;
    let sx = neck + (1 - neck) * grow;
    let sy = sx;
    const top = Math.max(0, (c - 0.42) / 0.58); // 0 → 1
    if (pos <= 2) {
      // 절치: 절단연으로 갈수록 협설로 얇아진다(칼날)
      sy *= 1 - 0.72 * top;
      sx *= 1 - 0.04 * top;
    } else if (pos === 3) {
      // 견치: 교두정으로 모인다
      sy *= 1 - 0.55 * top;
      sx *= 1 - 0.55 * top * top;
    } else {
      // 구치: 교합면 테두리가 살짝 좁아진다
      sx *= 1 - 0.1 * top * top;
      sy *= 1 - 0.16 * top * top;
    }
    rings.push({ y: c * h, sx, sy, bump: c >= 0.88 ? (c === 1 ? 1 : 0.4) : 0 });
  }
  const cusps = pos <= 3 ? 0 : pos <= 5 ? 2 : isUpper(fdi) ? 4 : 5;
  // 교합면 가운데: 구치는 오목(중심와), 전치는 절단연 높이, 견치는 교두정
  const capY = pos <= 2 ? h : pos === 3 ? h * 1.04 : h * 0.84;
  return { rings, capY, apexY: -r, cusps };
}

/** 치아 한 개 지오메트리(로컬: x = 원심, z = 설측(교합면 로컬 +y), y = 높이). */
function toothLocalPoints(fdi: Fdi, segs = 8) {
  const outline = sampleClosed(occlusalOutline(fdi), segs);
  const M = outline.length;
  const { rings, capY, apexY, cusps } = profile(fdi);
  const { crown: h } = dims(fdi);
  const verts: [number, number, number][] = [];
  rings.forEach((ring) => {
    outline.forEach(([x, z], i) => {
      const theta = (i / M) * Math.PI * 2;
      const bump = ring.bump && cusps ? ring.bump * 0.07 * h * Math.cos(cusps * theta) : 0;
      verts.push([x * ring.sx, ring.y + bump, z * ring.sy]);
    });
  });
  const apex = verts.length;
  verts.push([0, apexY, 0]);
  const cap = verts.length;
  verts.push([0, capY, 0]);
  const idx: number[] = [];
  for (let k = 0; k < rings.length - 1; k++) {
    for (let i = 0; i < M; i++) {
      const a = k * M + i;
      const b = k * M + ((i + 1) % M);
      const c = (k + 1) * M + i;
      const d = (k + 1) * M + ((i + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  }
  const last = (rings.length - 1) * M;
  for (let i = 0; i < M; i++) {
    idx.push(apex, i, (i + 1) % M); // 치근 끝
    idx.push(cap, last + ((i + 1) % M), last + i); // 교합면
  }
  return { verts, idx };
}

export type ToothMesh3D = { fdi: Fdi; geometry: THREE.BufferGeometry };

/** 32개(8-8) 또는 28개(7-7) 치아 지오메트리 — 월드 좌표(mm)로 굽는다. */
export function buildProceduralTeeth(opts: { withThirdMolars?: boolean; occlusalGap?: number } = {}): ToothMesh3D[] {
  const layout = occlusalLayout({ withThirdMolars: opts.withThirdMolars, scale: 1, pad: 0 });
  const cx = layout.width / 2;
  const gap = opts.occlusalGap ?? 0.4;
  const upperFront = Math.min(...layout.teeth.filter((t) => isUpper(t.fdi)).map((t) => t.cy));
  const lowerFront = Math.max(...layout.teeth.filter((t) => !isUpper(t.fdi)).map((t) => t.cy));

  return layout.teeth.map((t) => {
    const [a, b, c, d, e, f] = t.matrix;
    const up = isUpper(t.fdi);
    const { crown: h } = dims(t.fdi);
    const { verts, idx } = toothLocalPoints(t.fdi);
    const pos: number[] = [];
    for (const [x, hy, z] of verts) {
      // 교합면 로컬(x, z)는 2D 배치 행렬로 아치 위에 놓인다(z = 2D 로컬 y)
      const lx = a * x + c * z + e;
      const ly = b * x + d * z + f;
      const X = lx - cx;
      const Z = up ? upperFront - ly : ly - lowerFront;
      // 상악은 치관이 아래(교합평면)로, 하악은 위로
      const Y = up ? gap + (h - hy) : -gap - (h - hy);
      pos.push(X, Y, Z);
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
    g.setIndex(idx);
    g.computeVertexNormals();
    return { fdi: t.fdi, geometry: g };
  });
}
