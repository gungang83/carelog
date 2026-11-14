"use client";

// spec 040 — 잇몸 기록 3D. 치아 엔진(teeth-3d: 치아 모양 + 기준틀) 위에 잇몸·주머니·눈금 층을 얹는다.
// ★누르면 간다(§15-3): 치아를 누르면 그 치아·누른 면을 정면으로 마주 보는 "표준 시점"으로 옮기고, 그 치아를 중심으로 돌린다.
//   고른 치아의 치관(교합 쪽 절반)이나 반대 면을 다시 누르면 바깥 ⇄ 안쪽. 화면은 마우스를 올린다고 움직이지 않는다(쫓아가기 없음),
//   저절로 처음 화면으로 돌아가지도 않는다 — [⤢ 전체]로만.
// 입력은 고른 치아·고른 면에서만: 가리킨 곳을 "치아·면·부위·CEJ 기준 mm"로 바꿔 넘긴다(onPick, 2D와 같은 규칙).
// 동요·결손(치아 단위)은 누르면 바로 기록(onTap). 치아나 빈 곳을 끌면 돌리기.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { isUpper, type Fdi } from "@/lib/dental/teeth";
import { buildProceduralTeeth, pointToSite3D, probePoint3D, sitePoint3D, toothFrames3D, type ToothFrame3D, type V3 } from "@/lib/dental/teeth-3d";
import {
  MOB_LABEL,
  indexOf,
  pdColor,
  pdNum,
  siteVal,
  surfaceVal,
  toothVal,
  type Cursor,
  type MeasureId,
  type MeasureValue,
  type PerioData,
  type Pos,
  type Side,
} from "@/lib/oral/perio";
import type { PerioPick } from "@/lib/oral/perio-pick";

type Jaw = "all" | "upper" | "lower";
type Props = {
  data: PerioData;
  mode: MeasureId;
  jaw: Jaw;
  cursor: Cursor | null;
  hover: { pick: PerioPick; value: MeasureValue | null } | null;
  /** 기록해서 다음 칸이 다른 치아·면으로 넘어가면 화면이 그쪽으로 따라간다 */
  follow: boolean;
  /** 고른 치아·면 위의 포인터(입력) */
  onPick: (type: "move" | "down" | "up" | "leave", pointerType: string, pick: PerioPick | null) => void;
  /** 치아 단위 모드(동요·결손)에서 치아를 눌렀을 때 */
  onTap: (pick: PerioPick) => void;
  className?: string;
};

/** 포인터 아래가 무엇인지 — 입력 / 다른 치아(누르면 이동) / 뒤집기 / 치아 단위 */
type Hint = { t: Fdi; s: Side; p: Pos; kind: "input" | "focus" | "flip" | "tooth" } | null;
const SIDE_LABEL: Record<Side, string> = { B: "바깥", L: "안쪽" };
const other = (s: Side): Side => (s === "B" ? "L" : "B");

const GAP = 5; // 위·아래턱 사이를 벌려 잇몸선이 잘 보이게(mm)
const TOOTH = new THREE.Color("#f4ecdc");
const SITES: Pos[] = ["M", "C", "D"];
const v3 = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

export default function Perio3D({ data, mode, jaw, cursor, hover, follow, onPick, onTap, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    rebuild: () => void;
    redrawHover: () => void;
    focusTo: (t: Fdi, s: Side) => void;
    followCursor: (t: Fdi, s: Side) => void;
    flip: () => void;
    resetView: () => void;
  } | null>(null);
  /** 지금 고른 치아·면(겹침 버튼 표시용) */
  const [focused, setFocused] = useState<{ t: Fdi; s: Side } | null>(null);
  // 장면 안에서 읽는 최신 값
  const live = useRef({ data, mode, jaw, cursor, hover, follow, onPick, onTap, lastPointer: "mouse" });
  useLayoutEffect(() => {
    live.current = { ...live.current, data, mode, jaw, cursor, hover, follow, onPick, onTap };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const third = live.current.data.thirdMolars;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor("#f8fafc");
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#ffffff", "#c8bfae", 1.5));
    const key = new THREE.DirectionalLight("#ffffff", 1.4);
    key.position.set(30, 60, 90);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#ffffff", 0.6);
    fill.position.set(-50, -40, -30);
    scene.add(fill);

    const camera = new THREE.PerspectiveCamera(30, 1, 1, 3000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };

    // 치아
    const teeth = new Map<Fdi, THREE.Mesh>();
    for (const { fdi, geometry } of buildProceduralTeeth({ withThirdMolars: third, occlusalGap: GAP })) {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: TOOTH, roughness: 0.45, vertexColors: true, transparent: true }));
      mesh.userData.fdi = fdi;
      teeth.set(fdi, mesh);
      scene.add(mesh);
    }
    const frames = new Map<Fdi, ToothFrame3D>(toothFrames3D({ withThirdMolars: third, occlusalGap: GAP }).map((f) => [f.fdi, f]));
    const box = new THREE.Box3();
    teeth.forEach((m) => box.expandByObject(m));
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    controls.target.copy(center);
    controls.minDistance = radius * 0.5;
    controls.maxDistance = radius * 6;
    camera.position.copy(center).add(new THREE.Vector3(0, 0, radius * 2.6));
    camera.lookAt(center);

    const layer = new THREE.Group();
    const hoverLayer = new THREE.Group();
    scene.add(layer, hoverLayer);
    const disposeGroup = (g: THREE.Group) => {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        // 스프라이트는 공용 지오메트리 — 재질만 정리
        if (m.geometry && !(o as THREE.Sprite).isSprite) m.geometry.dispose();
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
      });
      g.clear();
    };
    const jawVisible = (upper: boolean) => live.current.jaw === "all" || (live.current.jaw === "upper") === upper;
    const bar = (a: THREE.Vector3, b: THREE.Vector3, r: number, color: string, opacity = 1) => {
      const len = a.distanceTo(b);
      const g = new THREE.CylinderGeometry(r, r, Math.max(len, 0.01), 10);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.4, transparent: opacity < 1, opacity }));
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      return m;
    };
    const dot = (p: THREE.Vector3, r: number, color: string) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.35 }));
      m.position.copy(p);
      return m;
    };

    // 눈금 숫자 — 글자 텍스처는 숫자마다 한 번만 만든다
    const numTex = new Map<string, THREE.CanvasTexture>();
    const numberSprite = (txt: string) => {
      let tex = numTex.get(txt);
      if (!tex) {
        const cv = document.createElement("canvas");
        cv.width = 64;
        cv.height = 64;
        const g = cv.getContext("2d")!;
        g.fillStyle = "rgba(255,255,255,0.92)";
        g.beginPath();
        g.arc(32, 32, 26, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#0369a1";
        g.font = "bold 34px system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(txt, 32, 34);
        tex = new THREE.CanvasTexture(cv);
        numTex.set(txt, tex);
      }
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
      sp.scale.setScalar(1.7);
      return sp;
    };
    // 부위 글자(M·C·D) — 가리킨 부위는 진하게
    const letterSprite = (txt: string, on: boolean) => {
      const k = `${txt}:${on ? 1 : 0}`;
      let tex = numTex.get(k);
      if (!tex) {
        const cv = document.createElement("canvas");
        cv.width = 64;
        cv.height = 64;
        const g = cv.getContext("2d")!;
        g.fillStyle = on ? "#0f172a" : "rgba(255,255,255,0.88)";
        g.beginPath();
        g.roundRect(6, 6, 52, 52, 14);
        g.fill();
        if (!on) {
          g.strokeStyle = "#cbd5e1";
          g.lineWidth = 3;
          g.stroke();
        }
        g.fillStyle = on ? "#ffffff" : "#64748b";
        g.font = "800 34px system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(txt, 32, 34);
        tex = new THREE.CanvasTexture(cv);
        numTex.set(k, tex);
      }
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
      sp.scale.setScalar(on ? 2 : 1.45);
      return sp;
    };

    // ── 측정값 층: 잇몸 커튼(반투명 분홍) · 잇몸선(빨강) · 주머니 막대(깊이 색) · 출혈 · 치태 ──
    const rebuild = () => {
      disposeGroup(layer);
      const { data: d } = live.current;
      const ix = indexOf(d);
      teeth.forEach((mesh, t) => {
        const st = toothVal(ix, "state", t);
        const mob = Number(toothVal(ix, "mob", t) ?? 0);
        mesh.visible = st !== "missing" && jawVisible(isUpper(t));
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.set(st === "implant" ? "#cbd5e1" : TOOTH);
        mat.emissive.set(mob > 0 ? "#f97316" : "#000000");
        mat.emissiveIntensity = mob * 0.12;
      });
      // 잇몸 띠 — 턱·면마다 치열을 따라 이어지는 한 장(결손 치아에서 끊김). 위 = 잇몸선, 아래 = 뿌리 쪽 10mm
      for (const upper of [true, false]) {
        if (!jawVisible(upper)) continue;
        const order = [...frames.values()].filter((f) => f.upper === upper).sort((a, b) => a.cej[0] - b.cej[0]);
        for (const s of ["B", "L"] as Side[]) {
          let run: { top: THREE.Vector3; bottom: THREE.Vector3 }[] = [];
          const flush = () => {
            if (run.length >= 2) {
              const pos: number[] = [];
              for (let i = 0; i < run.length - 1; i++) {
                const q = [run[i].top, run[i].bottom, run[i + 1].top, run[i + 1].top, run[i].bottom, run[i + 1].bottom];
                q.forEach((p) => pos.push(p.x, p.y, p.z));
              }
              const g = new THREE.BufferGeometry();
              g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
              g.computeVertexNormals();
              const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: "#f472b6", transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide }));
              m.renderOrder = 2;
              layer.add(m);
            }
            run = [];
          };
          for (const f of order) {
            if (toothVal(ix, "state", f.fdi) === "missing") {
              flush();
              continue;
            }
            // 화면 왼→오른쪽(환자 우측 → 좌측) 순서로 부위를 잇는다
            const seq: Pos[] = f.cej[0] < 0 ? ["D", "C", "M"] : ["M", "C", "D"];
            for (const p of seq) {
              const r = siteVal(ix, "rec", f.fdi, s, p);
              const rec = typeof r === "number" ? r : 0;
              run.push({ top: v3(sitePoint3D(f, s, p, rec, 0.35)), bottom: v3(sitePoint3D(f, s, p, Math.min(f.rootLen * 0.9, rec + 7), 0.35)) });
            }
          }
          flush();
        }
      }
      frames.forEach((f, t) => {
        if (toothVal(ix, "state", t) === "missing" || !jawVisible(f.upper)) return;
        for (const s of ["B", "L"] as Side[]) {
          const rec = (p: Pos) => {
            const r = siteVal(ix, "rec", t, s, p);
            return typeof r === "number" ? r : 0;
          };
          // 잇몸선
          const margin = SITES.map((p) => v3(sitePoint3D(f, s, p, rec(p), 0.45)));
          layer.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(margin), 12, 0.2, 6), new THREE.MeshStandardMaterial({ color: "#e11d48" })));
          for (const p of SITES) {
            const v = siteVal(ix, "pd", t, s, p);
            const n = v === "F" ? f.rootLen : pdNum(v);
            if (n !== null && n > 0) {
              // 탐침처럼 장축과 나란히(눈금과 같은 선)
              const a = v3(probePoint3D(f, s, p, rec(p), 0.75));
              const b = v3(probePoint3D(f, s, p, rec(p) + n, 0.75));
              layer.add(bar(a, b, 0.42, pdColor(pdNum(v))));
            }
            if (siteVal(ix, "bop", t, s, p) === true) layer.add(dot(v3(sitePoint3D(f, s, p, rec(p) - 0.4, 1.1)), 0.6, "#dc2626"));
          }
        }
        // 치태 — M·D는 협측 모서리, B·L은 각 면 가운데(치관 중간 높이)
        const plq: [string, Side, Pos][] = [["M", "B", "M"], ["D", "B", "D"], ["B", "B", "C"], ["L", "L", "C"]];
        for (const [sf, s, p] of plq)
          if (surfaceVal(ix, t, sf as "M" | "D" | "B" | "L") === true) layer.add(dot(v3(sitePoint3D(f, s, p, -f.crown * 0.45, 0.4)), 0.55, "#eab308"));
      });
    };

    // 고른 치아·면 — 장면 안 상태(React 상태는 겹침 버튼 표시용 사본)
    let focus: { t: Fdi; s: Side } | null = null;
    /** M·C·D 글자 — 고른 면이 화면 반대쪽으로 돌아가면 숨긴다(치아 너머로 비쳐 보이지 않게) */
    let letters: { sprites: THREE.Sprite[]; at: THREE.Vector3; n: THREE.Vector3 } | null = null;

    // ── 올린 곳: mm 눈금 + 미리보기 막대 + 고른 치아의 M·C·D ──
    // ★눈금은 탐침처럼 치아 장축과 나란히(probePoint3D) — 대구치 M·D에서도 C와 같은 방향으로 선다
    const redrawHover = () => {
      disposeGroup(hoverLayer);
      const h = live.current.hover;
      const ix = indexOf(live.current.data);
      const gmOf = (t: Fdi, s: Side, p: Pos) => {
        const r = siteVal(ix, "rec", t, s, p);
        return typeof r === "number" ? r : 0;
      };
      // ★치아(반투명 단계에서 그려짐)보다 나중에 그리도록 같은 단계(transparent) + 높은 renderOrder + 깊이 무시
      const onTop = (m: THREE.Mesh | THREE.Sprite) => {
        const mat = m.material as THREE.Material;
        mat.depthTest = false;
        mat.transparent = true;
        m.renderOrder = 20;
        hoverLayer.add(m);
      };
      const ruler = live.current.mode === "pd" || live.current.mode === "rec";
      // 고른 치아의 세 부위 글자 — 눈금 0보다 치관 쪽에
      letters = null;
      if (focus) {
        const f = frames.get(focus.t);
        if (f && jawVisible(f.upper)) {
          letters = { sprites: [], at: v3(f.cej), n: v3(f.lingual).multiplyScalar(focus.s === "B" ? -1 : 1) };
          for (const p of SITES) {
            const on = !!h && h.pick.t === focus.t && h.pick.s === focus.s && h.pick.p === p;
            const top = ruler ? (live.current.mode === "pd" ? Math.min(gmOf(focus.t, focus.s, p), 0) : -3) : 0;
            const sp = letterSprite(p, on);
            sp.position.copy(v3(probePoint3D(f, focus.s, p, top - 2.7, 1.5)));
            onTop(sp);
            letters.sprites.push(sp);
          }
        }
      }
      if (!h || !ruler) return;
      const f = frames.get(h.pick.t);
      if (!f) return;
      const gm = gmOf(h.pick.t, h.pick.s, h.pick.p);
      const P = (mm: number, out: number) => v3(probePoint3D(f, h.pick.s, h.pick.p, mm, out));
      // mm 눈금(3mm마다 길게)
      const from = live.current.mode === "pd" ? gm : -3;
      const to = live.current.mode === "pd" ? gm + 15 : 10;
      onTop(bar(P(from, 1.5), P(to, 1.5), 0.12, "#0284c7"));
      for (let n = Math.ceil(from); n <= to; n++) {
        const long = n % 3 === 0;
        onTop(bar(P(n, 1.5), P(n, long ? 3.4 : 2.4), long ? 0.14 : 0.09, "#0284c7"));
        // 3mm마다 숫자(깊이 모드는 잇몸선에서 센 값, 퇴축 모드는 CEJ 기준)
        if (long || n === Math.ceil(from)) {
          const label = live.current.mode === "pd" ? Math.round(n - gm) : n;
          const sp = numberSprite(String(label));
          sp.position.copy(P(n, 5.2));
          onTop(sp);
        }
      }
      if (typeof h.value === "number" || h.value === "F") {
        if (live.current.mode === "pd") {
          const n = h.value === "F" ? f.rootLen : Number(h.value);
          if (n > 0) hoverLayer.add(bar(P(gm, 0.75), P(gm + n, 0.75), 0.5, pdColor(pdNum(h.value)), 0.55));
        } else {
          hoverLayer.add(dot(P(Number(h.value), 0.6), 0.55, "#be185d"));
        }
      }
    };

    const toothMode = () => live.current.mode === "mob" || live.current.mode === "state";
    // ── 표준 시점: 고른 치아·면을 정면으로 ──
    //   면의 바깥 법선(바깥 = −설측 벡터, 안쪽 = +설측 벡터)을 수평으로 따라 보고, 화면 가운데 = CEJ에서 뿌리 쪽 3mm(잴 곳).
    //   옮긴 뒤엔 그 치아가 돌리기 중심 — 끌면 그 치아를 중심으로 악궁이 돈다.
    const overview = { target: center.clone(), dir: new THREE.Vector3(0, 0, 1), dist: radius * 2.6 };
    let goal: { target: THREE.Vector3; dir: THREE.Vector3; dist: number } | null = null;
    const focusTo = (t: Fdi, s: Side) => {
      const f = frames.get(t);
      if (!f) return;
      focus = { t, s };
      setFocused(focus);
      const cej = v3(f.cej);
      const normal = v3(f.lingual).multiplyScalar(s === "B" ? -1 : 1);
      normal.y = 0;
      normal.normalize();
      const target = cej.clone().add(v3(f.root).multiplyScalar(3));
      const dist = s === "B" ? radius * 1.0 : radius * 0.9;
      goal = { target, dir: normal, dist };
      // 사이를 가리는 치아는 비킨다: 맞은편 턱(안쪽을 볼 때) + 카메라 쪽에 있는 같은 턱 치아
      teeth.forEach((m, tt) => {
        const ft = frames.get(tt)!;
        const mat = m.material as THREE.MeshStandardMaterial;
        const otherJaw = ft.upper !== f.upper;
        const between = tt !== t && v3(ft.cej).sub(target).dot(normal) > 4;
        mat.opacity = (otherJaw && live.current.jaw === "all" && s === "L") || between ? 0.08 : 1;
        mat.depthWrite = mat.opacity === 1;
      });
      redrawHover();
    };
    /** 기록해서 다음 칸이 다른 치아·면이면 그쪽으로 — 단, 지금 면의 M·C·D를 다 채운 뒤에만(한 칸 찍자마자 옆 치아로 튀지 않게) */
    const followCursor = (t: Fdi, s: Side) => {
      if (focus && focus.t === t && focus.s === s) return;
      const m = live.current.mode;
      if (focus && (m === "pd" || m === "rec")) {
        const ix = indexOf(live.current.data);
        const f = focus;
        if (!SITES.every((p) => siteVal(ix, m, f.t, f.s, p) !== undefined)) return;
      }
      focusTo(t, s);
    };
    const flip = () => {
      if (focus) focusTo(focus.t, other(focus.s));
    };
    const resetView = () => {
      goal = { ...overview, target: overview.target.clone(), dir: overview.dir.clone() };
      focus = null;
      setFocused(null);
      teeth.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.opacity = 1;
        mat.depthWrite = true;
      });
      redrawHover();
    };
    // 손으로 돌리기 시작하면 옮겨 가던 걸 멈춘다(그 자리에서 이어 돌리기)
    controls.addEventListener("start", () => {
      goal = null;
    });

    // ── 포인터 ──
    const ray = new THREE.Raycaster();
    /** 고른 치아의 치관 중 "뒤집기" 영역 시작(CEJ에서 치관 쪽 mm) — 그 아래가 잴 곳 */
    const flipFrom = (f: ToothFrame3D) => Math.max(4, f.crown * 0.5);
    /**
     * 고른 면의 잴 곳 — 치아 표면이 아니라 세 탐침 선(M·C·D, 장축 평행)에 포인터 광선이 가장 가까운 곳으로 읽는다.
     * ★그래서 뿌리 사이(분지부)·뿌리 끝 너머처럼 치아가 없는 곳에서도 얼마든지 깊은 주머니를 잴 수 있다.
     */
    const probePick = (): { pick: PerioPick } | null => {
      if (!focus || toothMode()) return null;
      const f = frames.get(focus.t);
      if (!f || !jawVisible(f.upper)) return null;
      const s = focus.s;
      const n = v3(f.lingual).multiplyScalar(s === "B" ? -1 : 1);
      if (camera.position.clone().sub(v3(f.cej)).normalize().dot(n) < 0.2) return null; // 그 면이 화면을 보고 있을 때만
      const o = ray.ray.origin;
      const d = ray.ray.direction;
      const u = v3(f.root);
      let best: { p: Pos; dist: number; t: number } | null = null;
      for (const p of SITES) {
        const a = v3(probePoint3D(f, s, p, 0, 1.5));
        const w0 = o.clone().sub(a);
        const b = d.dot(u);
        const dd = d.dot(w0);
        const e = u.dot(w0);
        const den = 1 - b * b;
        if (den < 1e-6) continue;
        const sr = (b * e - dd) / den;
        const tl = (e - b * dd) / den;
        if (sr <= 0) continue;
        const dist = o.clone().addScaledVector(d, sr).distanceTo(a.clone().addScaledVector(u, tl));
        if (!best || dist < best.dist) best = { p, dist, t: tl };
      }
      if (!best || best.dist > f.halfMd * 0.45) return null;
      const r0 = siteVal(indexOf(live.current.data), "rec", focus.t, s, best.p);
      const gm = typeof r0 === "number" ? r0 : 0;
      // 치관 쪽은 뒤집기 영역 전까지, 뿌리 쪽은 잇몸선 + 18mm(15 넘으면 F)까지
      if (best.t < -flipFrom(f) || best.t > gm + 18) return null;
      return { pick: { t: focus.t, s, p: best.p, mm: -best.t, zone: best.t <= 0 ? "crown" : "root" } };
    };
    const pick = (ev: PointerEvent): { pick: PerioPick } | null => {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
      const probe = probePick();
      if (probe) return probe;
      const targets = [...teeth.values()].filter((m) => m.visible && (m.material as THREE.MeshStandardMaterial).opacity > 0.5);
      const hit = ray.intersectObjects(targets, false)[0];
      if (!hit) return null;
      const t = hit.object.userData.fdi as Fdi;
      const f = frames.get(t)!;
      const s3 = pointToSite3D(f, [hit.point.x, hit.point.y, hit.point.z]);
      return { pick: { t, s: s3.side, p: s3.pos, mm: s3.mm, zone: s3.mm >= 0 ? "crown" : "root" } };
    };
    /** 포인터 아래 분류 — 고른 치아·면의 잴 곳만 입력, 치관 교합 쪽 절반·반대 면은 뒤집기, 다른 치아는 이동 */
    const classify = (p: { pick: PerioPick } | null): Hint => {
      if (!p) return null;
      const { t, s, p: pos, mm } = p.pick;
      if (toothMode()) return { t, s, p: pos, kind: "tooth" };
      if (!focus || focus.t !== t) return { t, s, p: pos, kind: "focus" };
      const f = frames.get(t)!;
      if (s !== focus.s || mm > flipFrom(f)) return { t, s, p: pos, kind: "flip" };
      return { t, s, p: pos, kind: "input" };
    };
    let hint: Hint = null;
    let lit: Fdi | null = null;
    const light = (t: Fdi | null) => {
      if (t === lit) return;
      for (const tt of [lit, t]) {
        if (tt === null) continue;
        const mat = teeth.get(tt)?.material as THREE.MeshStandardMaterial | undefined;
        if (!mat) continue;
        if (tt === t && mat.emissiveIntensity < 0.05) {
          mat.emissive.set("#38bdf8");
          mat.emissiveIntensity = 0.18;
        } else if (tt !== t && mat.emissive.getHexString() === "38bdf8") mat.emissiveIntensity = 0;
      }
      lit = t;
    };
    let engaged = false; // 고른 면을 짚고 재는 중(돌리기 꺼짐)
    let downAt: { x: number; y: number } | null = null;
    let lastMouse: PointerEvent | null = null;
    const hoverAt = (p: { pick: PerioPick } | null, pointerType: string, type: "move" | "up" = "move") => {
      hint = classify(p);
      light(hint?.t ?? null);
      renderer.domElement.style.cursor = !hint ? "" : hint.kind === "input" ? "crosshair" : "pointer";
      live.current.onPick(type, pointerType, hint?.kind === "input" && p ? p.pick : null);
    };
    const onDown = (ev: PointerEvent) => {
      live.current.lastPointer = ev.pointerType;
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      const p = pick(ev);
      engaged = classify(p)?.kind === "input";
      controls.enabled = !engaged; // 잴 곳을 짚으면 돌리지 않고 잰다 — 그 밖(다른 치아·빈 곳)은 끌면 돌리기
      downAt = { x: ev.clientX, y: ev.clientY };
      if (engaged && p) {
        renderer.domElement.setPointerCapture(ev.pointerId);
        live.current.onPick("down", ev.pointerType, p.pick);
      }
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") lastMouse = ev;
      if (ev.buttons && !engaged) return; // 끌기 = 돌리기
      hoverAt(pick(ev), ev.pointerType);
    };
    const onUp = (ev: PointerEvent) => {
      const was = engaged;
      engaged = false;
      controls.enabled = true;
      const p = pick(ev);
      if (was) {
        hoverAt(p, ev.pointerType, "up");
        return;
      }
      // 거의 움직이지 않고 뗐으면 "누름" — 끌었으면 돌리기였다
      const tap = downAt && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) < 6;
      downAt = null;
      const h = classify(p);
      if (!tap || !h || !p) return;
      if (h.kind === "tooth") live.current.onTap(p.pick);
      else if (h.kind === "focus") focusTo(h.t, h.s);
      else if (h.kind === "flip" && focus) focusTo(h.t, h.s !== focus.s ? h.s : other(focus.s));
      if (ev.pointerType === "mouse") hoverAt(p, ev.pointerType);
    };
    const onLeave = () => {
      lastMouse = null;
      hint = null;
      light(null);
      live.current.onPick("leave", "mouse", null);
    };
    renderer.domElement.addEventListener("pointerdown", onDown, { capture: true });
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointerleave", onLeave);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const project = (p: THREE.Vector3) => {
      const v = p.clone().project(camera);
      return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight, front: v.z < 1 };
    };

    let raf = 0;
    let lastT = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      if (goal) {
        // 부드럽게 다가가기(지수 감쇠) — 방향은 대상 둘레로 돌고(구면), 거리·중심은 직선으로
        const dt = Math.min(0.05, (now - lastT) / 1000);
        const a = 1 - Math.exp(-dt / 0.16);
        const tgt = controls.target.clone().lerp(goal.target, a);
        const curDir = camera.position.clone().sub(controls.target).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(curDir, goal.dir);
        const dir = curDir.applyQuaternion(new THREE.Quaternion().slerp(q, a));
        const dist = THREE.MathUtils.lerp(camera.position.distanceTo(controls.target), goal.dist, a);
        controls.target.copy(tgt);
        camera.position.copy(tgt).add(dir.multiplyScalar(dist));
        camera.lookAt(tgt);
        if (tgt.distanceTo(goal.target) < 0.05 && camera.position.clone().sub(tgt).normalize().angleTo(goal.dir) < 0.003) goal = null;
        // 움직이는 동안 포인터 아래를 다시 읽어 미리보기 = 기록 값(화면이 움직였다고 다시 옮겨 가진 않는다)
        if (lastMouse && !lastMouse.buttons) {
          camera.updateMatrixWorld();
          hoverAt(pick(lastMouse), "mouse");
        }
      }
      lastT = now;
      controls.update();
      if (letters) {
        const front = camera.position.clone().sub(letters.at).dot(letters.n) > 0;
        for (const sp of letters.sprites) sp.visible = front;
      }
      renderer.render(scene, camera);
      // HTML 겹침: 값 풍선 · 다음 칸 링 · 치아 번호
      const L = live.current;
      const bub = bubbleRef.current;
      const tip = tipRef.current;
      if (bub && tip) {
        const h = L.hover;
        const f = h ? frames.get(h.pick.t) : null;
        if (h && f && (L.mode === "pd" || L.mode === "rec") && h.value !== null) {
          const ix = indexOf(L.data);
          const r0 = siteVal(ix, "rec", h.pick.t, h.pick.s, h.pick.p);
          const gm = typeof r0 === "number" ? r0 : 0;
          const depth = L.mode === "pd" ? gm + (h.value === "F" ? f.rootLen : Number(h.value)) : Number(h.value);
          const s = project(v3(probePoint3D(f, h.pick.s, h.pick.p, depth, 3.2)));
          bub.style.transform = `translate(${s.x + (L.lastPointer === "mouse" ? 18 : -18)}px, ${s.y - (L.lastPointer === "mouse" ? 18 : 64)}px)`;
          bub.style.opacity = "1";
          bub.style.background = L.mode === "pd" ? pdColor(pdNum(h.value)) : "#be185d";
          bub.textContent = String(h.value);
        } else bub.style.opacity = "0";
        const hf = hint ? frames.get(hint.t) : null;
        if (hint && hf) {
          const s = project(v3(sitePoint3D(hf, hint.s, "C", -hf.crown - 1.5, 0)));
          tip.style.transform = `translate(${s.x - 30}px, ${s.y - 12}px)`;
          tip.style.opacity = "1";
          const mob = Number(toothVal(indexOf(L.data), "mob", hint.t) ?? 0);
          const mobTxt = mob ? ` · ${MOB_LABEL[mob]}` : "";
          tip.textContent =
            hint.kind === "input"
              ? `${hint.t} ${SIDE_LABEL[hint.s]} ${hint.p}${mobTxt}`
              : hint.kind === "flip" && focus
                ? `⇄ ${hint.t} ${SIDE_LABEL[hint.s !== focus.s ? hint.s : other(focus.s)]}`
                : hint.kind === "focus"
                  ? `${hint.t} ${SIDE_LABEL[hint.s]} 보기`
                  : `${hint.t}${mobTxt}`;
        } else tip.style.opacity = "0";
      }
      const ring = ringRef.current;
      if (ring) {
        const c = L.cursor;
        const f = c ? frames.get(c.t) : null;
        if (c && f && jawVisible(f.upper)) {
          const ix = indexOf(L.data);
          const r0 = siteVal(ix, "rec", c.t, c.s, c.p);
          const s = project(v3(probePoint3D(f, c.s, c.p, typeof r0 === "number" ? r0 : 0, 0.5)));
          ring.style.transform = `translate(${s.x - 9}px, ${s.y - 9}px)`;
          ring.style.opacity = "1";
        } else ring.style.opacity = "0";
      }
    };
    loop();

    api.current = { rebuild, redrawHover, focusTo, followCursor, flip, resetView };
    // 개발 중 자동 점검용(배포 빌드에선 빠짐)
    if (process.env.NODE_ENV !== "production") (window as unknown as { __perio3d?: unknown }).__perio3d = { focusTo, flip };
    rebuild();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown, { capture: true });
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      disposeGroup(layer);
      disposeGroup(hoverLayer);
      numTex.forEach((t) => t.dispose());
      teeth.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
    // 사랑니 전환 때만 장면을 새로 만든다(나머지는 rebuild로)
  }, [data.thirdMolars]);

  useEffect(() => {
    api.current?.rebuild();
  }, [data, jaw]);

  useEffect(() => {
    api.current?.redrawHover();
  }, [hover, mode]);

  // 기록해서(또는 키보드로) 다음 칸이 다른 치아·면으로 넘어가면 그쪽으로 — 처음 열 때는 움직이지 않는다
  const prevCursor = useRef(cursor);
  useEffect(() => {
    if (cursor === prevCursor.current) return;
    prevCursor.current = cursor;
    if (cursor && follow) api.current?.followCursor(cursor.t, cursor.s);
  }, [cursor, follow]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${className ?? ""}`}>
      <div ref={hostRef} className="absolute inset-0" />
      <div className="absolute left-2 top-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => api.current?.resetView()}
          className="rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white"
        >
          ⤢ 전체
        </button>
        {focused && (
          <button
            type="button"
            onClick={() => api.current?.flip()}
            className="rounded-lg border border-sky-200 bg-white/90 px-2.5 py-1 text-xs font-bold text-sky-700 shadow-sm hover:bg-white"
          >
            {focused.t} {SIDE_LABEL[focused.s]} ⇄ {SIDE_LABEL[other(focused.s)]}
          </button>
        )}
      </div>
      <div ref={ringRef} className="pointer-events-none absolute left-0 top-0 h-[18px] w-[18px] opacity-0">
        <div className="absolute inset-0 rounded-full border-2 border-sky-600" style={{ animation: "perio-pulse 1.4s ease-out infinite" }} />
        <div className="absolute inset-[5px] rounded-full bg-sky-600" />
      </div>
      <div ref={tipRef} className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-bold text-white opacity-0 transition-opacity" />
      <div ref={bubbleRef} className="pointer-events-none absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold text-white opacity-0 shadow-lg transition-[background-color]" />
    </div>
  );
}
