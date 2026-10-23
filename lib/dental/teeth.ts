// Carelog 치아 도식 라이브러리 (2D · SVG) — 대표 지시 2026-10-22
// "Carelog에서 두루 쓸 전체 구강 이미지. 상하좌우·치식은 정확하게, 치아는 해부학적 모양으로.
//  교합면·정면 등 여러 방향을 라이브러리로 두고 조합해서 쓴다. 색 바꾸기·다른 상담자료에도 계속 활용."
//
// ★이 파일이 원본이다. 화면 부품(components/dental/*)과 편집용 SVG 파일(public/dental-svg/*,
//   scripts/export-dental-svg.mts로 생성)이 모두 여기서 나온다. 모양을 고칠 땐 이 파일을 고치고 내보내기를 다시 돌린다.
// ★외부 저작물을 따라 그리지 않았다 — 표준 평균 치관·치근 치수(mm)로 윤곽을 계산해 그린 도식이다.
// ★순수 TS(외부 import 없음) — Node 스크립트(--experimental-strip-types)에서도 그대로 읽힌다.
//
// 좌표 약속
//  · 치아 로컬 좌표: +x = 원심(distal), -x = 근심(mesial)
//    - 교합면(occlusal): -y = 협·순측(볼·입술 쪽), +y = 설·구개측(혀 쪽)
//    - 정면(facial): y = 0 이 치경선(CEJ), +y = 치관(교합·절단 방향), -y = 치근(뿌리 방향)
//  · 배치할 때 행렬로 회전·반전한다(좌우 사분면은 거울상 — 행렬의 반전으로 처리).
//  · 화면 기준: 환자를 마주 본 시점. 화면 왼쪽 = 환자 우측(1·4 사분면), 오른쪽 = 환자 좌측(2·3 사분면).

export type ToothView = "occlusal" | "facial";
export type Fdi = string; // "11" ~ "48"

type Dims = { md: number; bl: number; crown: number; root: number };

// 평균 치수(mm) — 근원심 폭(md) · 협설 폭(bl) · 치관 높이(crown) · 치근 길이(root)
const UPPER: Record<number, Dims> = {
  1: { md: 8.5, bl: 7.0, crown: 10.5, root: 13 },
  2: { md: 6.5, bl: 6.0, crown: 9.0, root: 13 },
  3: { md: 7.5, bl: 8.0, crown: 10.0, root: 17 },
  4: { md: 7.0, bl: 9.0, crown: 8.5, root: 14 },
  5: { md: 6.5, bl: 9.0, crown: 8.5, root: 14 },
  6: { md: 10.0, bl: 11.0, crown: 7.5, root: 12 },
  7: { md: 9.0, bl: 11.0, crown: 7.0, root: 11 },
  8: { md: 8.5, bl: 10.0, crown: 6.5, root: 11 },
};
const LOWER: Record<number, Dims> = {
  1: { md: 5.0, bl: 6.0, crown: 9.0, root: 12.5 },
  2: { md: 5.5, bl: 6.5, crown: 9.5, root: 14 },
  3: { md: 7.0, bl: 7.5, crown: 11.0, root: 16 },
  4: { md: 7.0, bl: 7.5, crown: 8.5, root: 14 },
  5: { md: 7.0, bl: 8.0, crown: 8.0, root: 14.5 },
  6: { md: 11.0, bl: 10.5, crown: 7.5, root: 14 },
  7: { md: 10.5, bl: 10.0, crown: 7.0, root: 13 },
  8: { md: 10.0, bl: 9.5, crown: 7.0, root: 11 },
};

export function quadrant(fdi: Fdi): number {
  return Number(fdi[0]);
}
export function toothPos(fdi: Fdi): number {
  return Number(fdi[1]);
}
export function isUpper(fdi: Fdi): boolean {
  const q = quadrant(fdi);
  return q === 1 || q === 2;
}
/** 화면 왼쪽(환자 우측) 사분면인가 */
export function isPatientRight(fdi: Fdi): boolean {
  const q = quadrant(fdi);
  return q === 1 || q === 4;
}
export function dims(fdi: Fdi): Dims {
  return (isUpper(fdi) ? UPPER : LOWER)[toothPos(fdi)];
}

export const TOOTH_NAMES: Record<number, string> = {
  1: "중절치",
  2: "측절치",
  3: "견치",
  4: "제1소구치",
  5: "제2소구치",
  6: "제1대구치",
  7: "제2대구치",
  8: "제3대구치(사랑니)",
};
export function toothLabel(fdi: Fdi): string {
  const side = isPatientRight(fdi) ? "우측" : "좌측";
  return `${fdi} · ${isUpper(fdi) ? "상악" : "하악"} ${side} ${TOOTH_NAMES[toothPos(fdi)]}`;
}

/** 화면 왼쪽 → 오른쪽 순서(환자 우측 → 좌측). */
export function archTeeth(upper: boolean, withThirdMolars = false): Fdi[] {
  const n = withThirdMolars ? 8 : 7;
  const right = Array.from({ length: n }, (_, i) => `${upper ? 1 : 4}${n - i}`);
  const left = Array.from({ length: n }, (_, i) => `${upper ? 2 : 3}${i + 1}`);
  return [...right, ...left];
}

// ── 경로 유틸 ─────────────────────────────────────────────────────────

export type P = [number, number];
const f = (n: number) => Math.round(n * 100) / 100;

/** Catmull-Rom → 3차 베지어 매끈한 경로. closed면 닫힌 윤곽. */
export function smoothPath(pts: P[], closed = true, tension = 0.5): string {
  if (pts.length < 2) return "";
  const n = pts.length;
  const get = (i: number): P => {
    if (closed) return pts[(i + n) % n];
    return pts[Math.max(0, Math.min(n - 1, i))];
  };
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const t = tension / 3;
    const c1: P = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2: P = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

function scalePts(pts: [number, number][], sx: number, sy: number): P[] {
  return pts.map(([x, y]) => [x * sx, y * sy]);
}

// ── 치아 한 개의 모양 ─────────────────────────────────────────────────

export type ToothShape = {
  /** 치관 윤곽(교합면이면 교합면 윤곽) */
  crown: string;
  /** 치근 윤곽(정면만) */
  root?: string;
  /** 교두·구(groove)·융선 등 세부 선 */
  details: string[];
  /** 교합면 테이블(변연융선 안쪽) 윤곽 — 살짝 음영 */
  table?: string;
  /** 구(groove) — 진한 선 */
  grooves?: string[];
  /** 융선(삼각융선·사선융선·횡주융선) — 옅은 선 */
  ridges?: string[];
  /** 소와(pit) 중심 [x, y] (mm) */
  pits?: [number, number][];
  /** 로컬 좌표 경계 상자 */
  box: { x: number; y: number; w: number; h: number };
};

/** 교합면 윤곽 제어점(정규화 −0.5~0.5, 매끈하게 하기 전). 3D 단면 등 다른 표현도 이 윤곽을 공유한다. */
function occlusalOutlineNorm(fdi: Fdi): P[] {
  const pos = toothPos(fdi);
  const up = isUpper(fdi);
  if (pos <= 2) {
    // 절치 — 순측은 넓은 호, 설측은 기저결절(cingulum) 쪽으로 좁아짐
    return [
      [-0.5, -0.12], [-0.38, -0.4], [0, -0.5], [0.38, -0.4], [0.5, -0.12],
      [0.36, 0.14], [0.14, 0.4], [0, 0.48], [-0.14, 0.4], [-0.36, 0.14],
    ];
  }
  if (pos === 3) {
    // 견치
    return [
      [-0.5, -0.04], [-0.32, -0.4], [0, -0.5], [0.32, -0.4], [0.5, -0.04],
      [0.34, 0.3], [0, 0.5], [-0.34, 0.3],
    ];
  }
  if (pos <= 5) {
    // 소구치 — 타원형(하악은 설측이 좁다)
    const lingualNarrow = up ? 1 : 0.8;
    return [
      [-0.5, 0], [-0.42, -0.36], [0, -0.5], [0.42, -0.36], [0.5, 0],
      [0.42 * lingualNarrow, 0.36], [0, 0.5], [-0.42 * lingualNarrow, 0.36],
    ];
  }
  if (up) {
    // 상악 대구치 — 마름모꼴
    return [
      [-0.48, -0.42], [0, -0.5], [0.45, -0.44], [0.5, 0], [0.38, 0.42],
      [0, 0.5], [-0.44, 0.45], [-0.5, 0],
    ];
  }
  // 하악 대구치 — 사각형(5교두)
  return [
    [-0.5, -0.38], [-0.1, -0.5], [0.3, -0.48], [0.5, -0.3], [0.5, 0.1],
    [0.42, 0.44], [0, 0.5], [-0.46, 0.44], [-0.5, 0],
  ];
}

/** 교합면 윤곽 제어점(mm, 중심 0,0, -y = 협·순측, +x = 원심). */
export function occlusalOutline(fdi: Fdi): P[] {
  const { md, bl } = dims(fdi);
  return scalePts(occlusalOutlineNorm(fdi), md, bl);
}

// ── 교합면 해부(2D 도식·3D 모델 공용 원본) ─────────────────────────────
// 좌표: u = 근원심(+ 원심), v = 협설(− 협·순측, + 설측), 둘 다 치아 폭으로 나눈 값(−0.5 ~ 0.5).
// 교두 = [u, v, 높이(0~1), 반경] · 구(groove) = [시작, 끝, 깊이] — 깊이가 음수면 융선(ridge, 솟음).
// 평균 영구치 형태학 기준: 상악 대구치 4교두(근심설측 최대 · 사선융선 · 협측구 · 원심설측구),
// 하악 제1대구치 5교두(설측 교두가 높음 · 근심/원심협측구 · 설측구), 하악 제2대구치 4교두(+자 구),
// 상악 소구치 2교두(협측 > 설측) · 하악 제1소구치(협측 우세 · 작은 설측) · 하악 제2소구치 3교두(Y자 구),
// 견치 1교두(교두정 약간 근심 · 설측 융선), 절치 절단연(발육엽 흔적).
export type Cusp = [number, number, number, number];
export type Groove = [[number, number], [number, number], number];
export type Occlusal = { cusps: Cusp[]; grooves: Groove[]; depth: number; floor: number };

export function occlusalAnatomy(fdi: Fdi): Occlusal {
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

/** 교합면 모양. 단위 mm, 중심 (0,0), -y = 협·순측, +x = 원심. */
function occlusalShape(fdi: Fdi): ToothShape {
  const { md: w, bl: d } = dims(fdi);
  const pos = toothPos(fdi);
  const outline = occlusalOutline(fdi);
  const anat = occlusalAnatomy(fdi);
  const mm = ([u, v]: [number, number]): P => [u * w, v * d];
  const shrink = (sx: number, sy: number, oy = 0) => smoothPath(outline.map(([x, y]) => [x * sx, y * sy + oy * d] as P));
  const details: string[] = [];
  const grooves: string[] = [];
  const ridges: string[] = [];
  const pits: [number, number][] = [];
  let table: string;

  // 2D에선 구를 교합면 테이블 안(+약간)에서 끝낸다 — 협·설면으로 넘어가는 부분은 교합면 그림에서 생략
  const clip = (p: [number, number], q: [number, number]): [number, number] => {
    const inside = (r: [number, number]) => (r[0] / 0.4) ** 2 + (r[1] / 0.39) ** 2 <= 1;
    if (inside(p)) return p;
    let lo = 0;
    let hi = 1; // q(안쪽) → p(바깥) 사이 이분 탐색
    for (let k = 0; k < 16; k++) {
      const m = (lo + hi) / 2;
      if (inside([q[0] + (p[0] - q[0]) * m, q[1] + (p[1] - q[1]) * m])) lo = m;
      else hi = m;
    }
    return [q[0] + (p[0] - q[0]) * lo, q[1] + (p[1] - q[1]) * lo];
  };
  // 구: 직선이 아니라 살짝 굽이치게(교대로 반대쪽으로 휨)
  const groovePath = ([ga0, gb0]: [[number, number], [number, number]], i: number) => {
    const ga = clip(ga0, gb0);
    const gb = clip(gb0, ga);
    const [ax, ay] = mm(ga);
    const [bx, by] = mm(gb);
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const bend = 0.06 * len * (i % 2 ? 1 : -1);
    const mid: P = [(ax + bx) / 2 + (-(by - ay) / len) * bend, (ay + by) / 2 + ((bx - ax) / len) * bend];
    return smoothPath([[ax, ay], mid, [bx, by]], false);
  };
  const split = () =>
    anat.grooves.forEach(([ga, gb, depth], i) => (depth < 0 ? ridges : grooves).push(groovePath([ga, gb], i)));

  if (pos <= 2) {
    // 절치: 절단연 · 설면와(변연융선 안쪽) · 기저결절
    table = shrink(0.66, 0.5, 0.1);
    details.push(smoothPath(scalePts([[-0.42, -0.22], [0, -0.3], [0.42, -0.22]], w, d), false));
    ridges.push(smoothPath(scalePts([[-0.16, 0.26], [0, 0.34], [0.16, 0.26]], w, d), false));
  } else if (pos === 3) {
    // 견치: 근·원심 교두융선 · 설측융선 · 양옆 설측와
    table = shrink(0.7, 0.58, 0.06);
    details.push(smoothPath(scalePts([[-0.46, -0.06], [-0.06, -0.24], [0.46, -0.06]], w, d), false));
    split();
  } else {
    // 소구치·대구치: 교합면 테이블 · 구 · 소와 · 삼각융선(교두정 → 중심구) · 사선/횡주융선
    table = shrink(0.76, 0.72);
    split();
    const main = anat.grooves.filter(([, , depth]) => depth > 0);
    const deep = main.filter(([, , depth]) => depth >= 0.8);
    // 삼각융선: 교두정에서 가장 가까운 주구(깊이 0.8 이상) 쪽으로, 교두정 조금 아래에서 시작해 살짝 휘며 내려간다
    for (const [cu, cv] of anat.cusps) {
      let best: [number, number] = [0, 0];
      let bestD = Infinity;
      for (const [ga, gb] of deep.length ? deep : main) {
        for (let t = 0; t <= 1; t += 0.05) {
          const q: [number, number] = [ga[0] + (gb[0] - ga[0]) * t, ga[1] + (gb[1] - ga[1]) * t];
          const dd = Math.hypot(q[0] - cu, q[1] - cv);
          if (dd < bestD) {
            bestD = dd;
            best = q;
          }
        }
      }
      const at = (t: number, bend: number): P =>
        mm([cu + (best[0] - cu) * t - (best[1] - cv) * bend, cv + (best[1] - cv) * t + (best[0] - cu) * bend]);
      ridges.push(smoothPath([at(0.12, 0), at(0.36, 0.04), at(0.62, 0)], false));
    }
    // 소와: 깊은 구(0.8 이상)끼리 만나는 점(중심와) + 가장 긴 주구의 근·원심 끝(근심·원심 소와)
    const deepEnds = deep.flatMap(([ga, gb]) => [ga, gb]);
    const seen: [number, number][] = [];
    const addPit = (e: [number, number]) => {
      if (seen.some((q) => Math.hypot(q[0] - e[0], q[1] - e[1]) < 0.08)) return;
      seen.push(e);
      pits.push(mm(clip(e, [0, 0])));
    };
    for (const e of deepEnds) if (deepEnds.filter((o) => Math.hypot(o[0] - e[0], o[1] - e[1]) < 0.08).length >= 2) addPit(e);
    const longest = [...main].sort((x, y) => Math.hypot(y[1][0] - y[0][0], y[1][1] - y[0][1]) - Math.hypot(x[1][0] - x[0][0], x[1][1] - x[0][1]))[0];
    if (longest && Math.abs(longest[0][1]) < 0.15 && Math.abs(longest[1][1]) < 0.15) {
      addPit(longest[0]);
      addPit(longest[1]);
    }
  }
  return { crown: smoothPath(outline), details, table, grooves, ridges, pits, box: { x: -w / 2, y: -d / 2, w, h: d } };
}

/** 정면(순·협측에서 본) 모양. y=0 치경선, +y 치관, -y 치근. -x = 근심. */
function facialShape(fdi: Fdi): ToothShape {
  const { md: w, crown: h, root: r } = dims(fdi);
  const pos = toothPos(fdi);
  const up = isUpper(fdi);
  let crown: [number, number][];
  let root: [number, number][];
  let details: string[] = [];
  const neck = pos >= 6 ? 0.4 : 0.34; // 치경부 반폭(치관 폭 대비)

  if (pos <= 2) {
    crown = [
      [-neck, 0], [-0.5, 0.55], [-0.48, 0.94], [-0.3, 1], [0, 1], [0.3, 0.99],
      [0.47, 0.92], [0.5, 0.52], [neck, 0],
    ];
    root = [[-neck * 0.95, 0], [-0.26, -0.5], [-0.09, -0.95], [0, -1], [0.09, -0.95], [0.26, -0.5], [neck * 0.95, 0]];
    details = [smoothPath(scalePts([[-0.28, 0.88], [0, 0.92], [0.28, 0.88]], w, h), false)];
  } else if (pos === 3) {
    crown = [
      [-neck, 0], [-0.5, 0.48], [-0.44, 0.78], [-0.14, 0.95], [0, 1], [0.16, 0.92],
      [0.48, 0.72], [0.5, 0.44], [neck, 0],
    ];
    root = [[-neck * 0.95, 0], [-0.28, -0.5], [-0.08, -0.96], [0, -1], [0.08, -0.96], [0.28, -0.5], [neck * 0.95, 0]];
    details = [smoothPath(scalePts([[0, 0.92], [0, 0.4]], w, h), false)];
  } else if (pos <= 5) {
    crown = [
      [-neck, 0], [-0.5, 0.5], [-0.44, 0.76], [-0.16, 0.94], [0, 1], [0.16, 0.94],
      [0.44, 0.76], [0.5, 0.5], [neck, 0],
    ];
    root = [[-neck * 0.95, 0], [-0.26, -0.5], [-0.08, -0.96], [0, -1], [0.08, -0.96], [0.26, -0.5], [neck * 0.95, 0]];
    details = [smoothPath(scalePts([[0, 0.94], [0, 0.42]], w, h), false)];
    // 상악 제1소구치 — 협·설 2근관(정면에서 분지 홈)
    if (up && pos === 4) {
      details.push(smoothPath(scalePts([[0, -0.15], [0, -0.75]], w, r), false));
    }
  } else {
    // 대구치 — 협측 교두 2개, 치근 2갈래(정면에서 근심·원심근 또는 근·원심협측근)
    crown = [
      [-neck, 0], [-0.5, 0.45], [-0.46, 0.84], [-0.26, 1], [-0.02, 0.86], [0.24, 1],
      [0.46, 0.84], [0.5, 0.45], [neck, 0],
    ];
    const spread = up ? 1.08 : 1; // 상악 대구치 치근이 더 벌어짐
    root = [
      [-neck * 0.98, 0], [-0.44 * spread, -0.55], [-0.32 * spread, -1], [-0.18, -0.94],
      [-0.12, -0.45], [0, -0.22], [0.12, -0.45], [0.18, -0.92], [0.3 * spread, -0.95],
      [0.42 * spread, -0.5], [neck * 0.98, 0],
    ];
    details = [smoothPath(scalePts([[-0.02, 0.86], [-0.02, 0.45]], w, h), false)];
  }
  const crownPts = crown.map(([x, y]) => [x * w, y * h] as P);
  const rootPts = root.map(([x, y]) => [x * w, y * r] as P);
  return {
    // 치관·치근 모두 치경선(y=0)에서 직선으로 닫는다 — 서로 맞물리게
    crown: `${smoothPath(crownPts, false)} Z`,
    root: `${smoothPath(rootPts, false)} Z`,
    details,
    box: { x: -w / 2, y: -r, w, h: h + r },
  };
}

export function toothShape(fdi: Fdi, view: ToothView): ToothShape {
  return view === "occlusal" ? occlusalShape(fdi) : facialShape(fdi);
}

// ── 배치(조합) ───────────────────────────────────────────────────────

/** SVG transform matrix(a b c d e f): 로컬 x축 → (a,b), 로컬 y축 → (c,d), 원점 → (e,f) */
export type Matrix = [number, number, number, number, number, number];

export type PlacedTooth = {
  fdi: Fdi;
  shape: ToothShape;
  matrix: Matrix;
  /** 화면 좌표 중심(라벨·클릭 기준) */
  cx: number;
  cy: number;
  /** 화면 기준 대략 반경(라벨 크기·여백 계산용) */
  size: number;
};

export type GapPoint = {
  /** "17-16" — 인접한 두 치아 */
  id: string;
  /** 접촉점 */
  x: number;
  y: number;
  /** 접촉점에서 바깥쪽(협·순측)으로 단위 벡터 */
  nx: number;
  ny: number;
};

export type Layout = {
  width: number;
  height: number;
  teeth: PlacedTooth[];
  gaps: GapPoint[];
  /** 상·하악 구분선 y(라벨 배치용) */
  midY: number;
};

type ArchOpts = {
  withThirdMolars?: boolean;
  /** px per mm */
  scale?: number;
  /** 바깥 여백 px */
  pad?: number;
};

/** 교합면 전체(상·하악). 상악은 위(전치가 맨 위), 하악은 아래(전치가 맨 아래). */
export function occlusalLayout(opts: ArchOpts = {}): Layout {
  const k = opts.scale ?? 6;
  const pad = opts.pad ?? 40;
  // 실제 치열궁 비율(폭:깊이 ≈ 1.3:1)에 맞춘 깊은 U자 — 대구치부가 거의 평행하게 뒤로 뻗는다
  const PHI = (78 * Math.PI) / 180;
  const arches = [true, false].map((upper) => {
    const teeth = archTeeth(upper, opts.withThirdMolars);
    const widths = teeth.map((t) => dims(t).md * k);
    const total = widths.reduce((s, w) => s + w, 0);
    // 단위 곡선의 호 길이를 치아 폭 합에 맞춰 크기를 정한다(하악이 약간 얕다)
    const B0 = upper ? 1.75 : 1.6;
    const N = 1500;
    const unit = (phi: number): P => [Math.sin(phi), B0 * (1 - Math.cos(phi))];
    let unitLen = 0;
    const phis: number[] = [];
    const cum: number[] = [0];
    for (let i = 0; i <= N; i++) phis.push(-PHI + (2 * PHI * i) / N);
    for (let i = 1; i <= N; i++) {
      const a = unit(phis[i - 1]);
      const b = unit(phis[i]);
      unitLen += Math.hypot(b[0] - a[0], b[1] - a[1]);
      cum.push(unitLen);
    }
    const s = total / unitLen; // 타원 배율(px)
    const phiAt = (len: number) => {
      const target = len / s;
      let lo = 0;
      let hi = N;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < target) lo = mid + 1;
        else hi = mid;
      }
      return phis[lo];
    };
    return { upper, teeth, widths, s, B0, phiAt };
  });

  const maxHalfW = Math.max(...arches.map((a) => a.s * Math.sin(PHI))) + 7 * k;
  const width = Math.ceil(maxHalfW * 2 + pad * 2);
  const cx = width / 2;
  const upperDepth = arches[0].s * arches[0].B0 * (1 - Math.cos(PHI)) + 6 * k;
  const lowerDepth = arches[1].s * arches[1].B0 * (1 - Math.cos(PHI)) + 6 * k;
  const gapMid = 2 * k;
  const upperY0 = pad + 5 * k; // 상악 전치 기준선
  const lowerY0 = upperY0 + upperDepth + gapMid + lowerDepth; // 하악 전치 기준선
  const height = Math.ceil(lowerY0 + 5 * k + pad);

  const teeth: PlacedTooth[] = [];
  const gaps: GapPoint[] = [];
  for (const arch of arches) {
    const sign = arch.upper ? 1 : -1;
    const y0 = arch.upper ? upperY0 : lowerY0;
    const at = (phi: number): P => [cx + arch.s * Math.sin(phi), y0 + sign * arch.s * arch.B0 * (1 - Math.cos(phi))];
    const tangent = (phi: number): P => {
      const tx = Math.cos(phi);
      const ty = sign * arch.B0 * Math.sin(phi);
      const l = Math.hypot(tx, ty) || 1;
      return [tx / l, ty / l];
    };
    // 바깥(협·순측) 법선: 상악은 아치 위쪽이 바깥, 하악은 아래쪽이 바깥
    const outward = (phi: number): P => {
      const [tx, ty] = tangent(phi);
      // 접선을 90° 돌린 두 후보 중 아치 중심 반대쪽
      const n1: P = [ty, -tx];
      const centerY = y0 + sign * arch.s * arch.B0;
      const p = at(phi);
      const toCenter: P = [cx - p[0], centerY - p[1]];
      return n1[0] * toCenter[0] + n1[1] * toCenter[1] > 0 ? [-n1[0], -n1[1]] : n1;
    };
    // 치아 폭 합 = 호 전체 길이로 맞췄으므로, 좌우 대칭이면 정중선(11|21)이 자연히 φ=0에 온다
    let acc = 0;
    const offset = 0;
    arch.teeth.forEach((fdi, i) => {
      const w = arch.widths[i];
      const centerLen = offset + acc + w / 2;
      const phi = arch.phiAt(centerLen);
      const [px, py] = at(phi);
      const [tx, ty] = tangent(phi);
      const [nx, ny] = outward(phi);
      // 로컬 +x = 원심: 환자 우측(화면 왼쪽) 치아는 접선 반대 방향이 원심
      const distal: P = isPatientRight(fdi) ? [-tx, -ty] : [tx, ty];
      // 로컬 -y = 협측(바깥) → 로컬 +y 축 = 안쪽
      const yAxis: P = [-nx * k, -ny * k];
      teeth.push({
        fdi,
        shape: occlusalShape(fdi),
        matrix: [distal[0] * k, distal[1] * k, yAxis[0], yAxis[1], px, py],
        cx: px,
        cy: py,
        size: (Math.max(dims(fdi).md, dims(fdi).bl) * k) / 2,
      });
      acc += w;
      if (i < arch.teeth.length - 1) {
        const phiC = arch.phiAt(offset + acc);
        const [gx, gy] = at(phiC);
        const [gnx, gny] = outward(phiC);
        gaps.push({ id: `${fdi}-${arch.teeth[i + 1]}`, x: gx, y: gy, nx: gnx, ny: gny });
      }
    });
  }
  return { width, height, teeth, gaps, midY: (upperY0 + upperDepth + lowerY0 - lowerDepth) / 2 };
}

/** 정면(입을 벌리지 않고 마주 본 모습). 상악은 치관이 아래로, 하악은 위로. 뒤쪽 치아는 원근으로 좁아진다. */
export function facialLayout(opts: ArchOpts = {}): Layout {
  const k = opts.scale ?? 6;
  const pad = opts.pad ?? 30;
  const rows = [true, false].map((upper) => {
    const teeth = archTeeth(upper, opts.withThirdMolars);
    // 원근: 정중선에서 멀수록(뒤쪽) 정면 폭이 줄어든다
    const persp = (fdi: Fdi) => Math.max(0.42, Math.cos(((toothPos(fdi) - 1) * 11 * Math.PI) / 180));
    const widths = teeth.map((t) => dims(t).md * k * persp(t));
    return { upper, teeth, widths, persp };
  });
  const rowW = Math.max(...rows.map((r) => r.widths.reduce((s, w) => s + w, 0)));
  const width = Math.ceil(rowW + pad * 2);
  const cx = width / 2;
  const maxRootU = Math.max(...rows[0].teeth.map((t) => dims(t).root));
  const maxCrownU = Math.max(...rows[0].teeth.map((t) => dims(t).crown));
  const maxCrownL = Math.max(...rows[1].teeth.map((t) => dims(t).crown));
  const maxRootL = Math.max(...rows[1].teeth.map((t) => dims(t).root));
  const cejU = pad + maxRootU * k; // 상악 치경선
  const occl = cejU + maxCrownU * k + 2 * k; // 교합평면
  const cejL = occl + maxCrownL * k + 2 * k; // 하악 치경선
  const height = Math.ceil(cejL + maxRootL * k + pad);

  const teeth: PlacedTooth[] = [];
  const gaps: GapPoint[] = [];
  for (const row of rows) {
    const total = row.widths.reduce((s, w) => s + w, 0);
    let x = cx - total / 2;
    row.teeth.forEach((fdi, i) => {
      const w = row.widths[i];
      const px = x + w / 2;
      const sx = k * row.persp(fdi) * (isPatientRight(fdi) ? -1 : 1); // 로컬 +x(원심) → 화면 바깥쪽
      const { crown } = dims(fdi);
      // 상악: 로컬 +y(치관)이 화면 아래 / 하악: 화면 위
      const sy = row.upper ? k : -k;
      const py = row.upper ? cejU : cejL;
      teeth.push({
        fdi,
        shape: facialShape(fdi),
        matrix: [sx, 0, 0, sy, px, py],
        cx: px,
        cy: row.upper ? py + (crown * k) / 2 : py - (crown * k) / 2,
        size: Math.max(w, crown * k) / 2,
      });
      x += w;
      if (i < row.teeth.length - 1) {
        gaps.push({
          id: `${fdi}-${row.teeth[i + 1]}`,
          x,
          y: row.upper ? py + 1.5 * k : py - 1.5 * k,
          nx: 0,
          ny: row.upper ? -1 : 1,
        });
      }
    });
  }
  return { width, height, teeth, gaps, midY: occl + (maxCrownL * k) / 2 };
}

// ── 문자열 SVG 내보내기(편집용 파일·다운로드) ───────────────────────────

export type ToothStyle = {
  crownFill: string;
  rootFill: string;
  stroke: string;
  /** 융선·절단연 등 옅은 선 */
  detailStroke: string;
  /** 구(groove)·소와 */
  grooveStroke: string;
  strokeWidth: number;
};

export const DEFAULT_STYLE: ToothStyle = {
  crownFill: "#fffdf7",
  rootFill: "#f1e3c8",
  stroke: "#94a3b8",
  detailStroke: "#cbd5e1",
  grooveStroke: "#9aa8ba",
  strokeWidth: 1.2,
};

/** 교합면 테이블 음영(치관 색 위에 겹쳐 칠해 어떤 색에서도 보이게) */
export const TABLE_SHADE = "rgba(120, 96, 60, 0.07)";

function toothGroupSvg(t: PlacedTooth, style: ToothStyle, label: boolean, fill?: string): string {
  const m = t.matrix.map((n) => f(n)).join(" ");
  // 선 두께는 화면 px 기준을 유지(vector-effect)
  const ve = 'vector-effect="non-scaling-stroke"';
  const parts = [
    t.shape.root
      ? `<path d="${t.shape.root}" fill="${style.rootFill}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" ${ve}/>`
      : "",
    `<path d="${t.shape.crown}" fill="${fill ?? style.crownFill}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" ${ve}/>`,
    t.shape.table
      ? `<path d="${t.shape.table}" fill="${TABLE_SHADE}" stroke="${style.detailStroke}" stroke-width="${style.strokeWidth * 0.6}" ${ve}/>`
      : "",
    ...(t.shape.ridges ?? []).map(
      (d) => `<path d="${d}" fill="none" stroke="${style.detailStroke}" stroke-width="${style.strokeWidth * 0.7}" stroke-linecap="round" ${ve}/>`,
    ),
    ...t.shape.details.map(
      (d) => `<path d="${d}" fill="none" stroke="${style.detailStroke}" stroke-width="${style.strokeWidth * 0.8}" stroke-linecap="round" ${ve}/>`,
    ),
    ...(t.shape.grooves ?? []).map(
      (d) => `<path d="${d}" fill="none" stroke="${style.grooveStroke}" stroke-width="${style.strokeWidth * 0.9}" stroke-linecap="round" ${ve}/>`,
    ),
    ...(t.shape.pits ?? []).map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="0.2" fill="${style.grooveStroke}"/>`),
  ];
  const lbl = label
    ? `<text x="${f(t.cx)}" y="${f(t.cy + 4)}" text-anchor="middle" font-size="11" font-weight="600" fill="#475569" font-family="system-ui, sans-serif">${t.fdi}</text>`
    : "";
  return `<g id="tooth-${t.fdi}" data-fdi="${t.fdi}"><g transform="matrix(${m})">${parts.join("")}</g>${lbl}</g>`;
}

export function layoutSvg(layout: Layout, opts: { style?: ToothStyle; labels?: boolean; title?: string } = {}): string {
  const style = opts.style ?? DEFAULT_STYLE;
  const body = layout.teeth.map((t) => toothGroupSvg(t, style, opts.labels ?? true)).join("\n  ");
  const title = opts.title ? `<title>${opts.title}</title>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}">${title}\n  ${body}\n</svg>\n`;
}

/** 치아 한 개 SVG(편집·다운로드용). 정면은 상악=치관 아래, 하악=치관 위(입안에서의 방향 그대로). */
export function singleToothSvg(fdi: Fdi, view: ToothView, opts: { style?: ToothStyle; scale?: number } = {}): string {
  const style = opts.style ?? DEFAULT_STYLE;
  const k = opts.scale ?? 12;
  const shape = toothShape(fdi, view);
  const padMm = 1.5;
  const { x, y, w, h } = shape.box;
  const flipX = isPatientRight(fdi) ? -1 : 1;
  const flipY = view === "facial" && !isUpper(fdi) ? -1 : 1;
  const W = (w + padMm * 2) * k;
  const H = (h + padMm * 2) * k;
  // 경계 상자 중심을 캔버스 중심으로
  const bx = x + w / 2;
  const by = y + h / 2;
  const sx = k * flipX;
  const sy = k * flipY;
  const e = W / 2 - bx * sx;
  const fy = H / 2 - by * sy;
  const t: PlacedTooth = { fdi, shape, matrix: [sx, 0, 0, sy, e, fy], cx: W / 2, cy: H / 2, size: 0 };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W)}" height="${f(H)}"><title>${toothLabel(fdi)} · ${view === "occlusal" ? "교합면" : "정면"}</title>\n  ${toothGroupSvg(t, style, false)}\n</svg>\n`;
}

export const ALL_TEETH: Fdi[] = [
  ...archTeeth(true, true),
  ...archTeeth(false, true),
];
