"use client";

// spec 040 — 잇몸 기록 3D. 치아 엔진(teeth-3d: 치아 모양 + 기준틀) 위에 잇몸·주머니·눈금 층을 얹는다.
// ★마우스가 머문 치아·면의 "표준 시점"으로 화면이 부드럽게 옮겨 간다 — 바깥 = 그 치아 바깥에서 수평으로,
//   안쪽 = 교합면 너머에서 내려다보며. 늘 같은 자리에서 보므로 여러 번 옮겨도 각도·거리가 어긋나지 않는다. [⤢ 전체]로 처음 화면.
// 입력 규칙은 2D와 같다: 가리킨 곳을 "치아·면·부위·CEJ 기준 mm"로 바꿔 넘긴다(onPick).
// 뿌리를 짚고 위아래로 → 깊이, 빈 곳을 끌면 돌리기.

import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { isUpper, type Fdi } from "@/lib/dental/teeth";
import { buildProceduralTeeth, pointToSite3D, sitePoint3D, toothFrames3D, type ToothFrame3D, type V3 } from "@/lib/dental/teeth-3d";
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
  /** 마우스가 머문 치아 쪽으로 화면이 따라 돈다 */
  follow: boolean;
  onPick: (type: "move" | "down" | "up" | "leave", pointerType: string, pick: PerioPick | null) => void;
  className?: string;
};

const GAP = 5; // 위·아래턱 사이를 벌려 잇몸선이 잘 보이게(mm)
const TOOTH = new THREE.Color("#f4ecdc");
const SITES: Pos[] = ["M", "C", "D"];
const v3 = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

export default function Perio3D({ data, mode, jaw, cursor, hover, follow, onPick, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    rebuild: () => void;
    redrawHover: () => void;
    followTo: (t: Fdi, s: Side) => void;
    resetView: () => void;
  } | null>(null);
  // 장면 안에서 읽는 최신 값
  const live = useRef({ data, mode, jaw, cursor, hover, follow, onPick, lastPointer: "mouse" });
  useLayoutEffect(() => {
    live.current = { ...live.current, data, mode, jaw, cursor, hover, follow, onPick };
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
    controls.minDistance = radius * 0.9;
    controls.maxDistance = radius * 6;
    camera.position.copy(center).add(new THREE.Vector3(0, 0, radius * 2.6));
    camera.lookAt(center);

    const layer = new THREE.Group();
    const hoverLayer = new THREE.Group();
    scene.add(layer, hoverLayer);
    const disposeGroup = (g: THREE.Group) => {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
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
              const a = v3(sitePoint3D(f, s, p, rec(p), 0.75));
              const b = v3(sitePoint3D(f, s, p, rec(p) + n, 0.75));
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

    // ── 올린 곳: mm 눈금 + 미리보기 막대 ──
    const redrawHover = () => {
      disposeGroup(hoverLayer);
      const h = live.current.hover;
      teeth.forEach((m, t) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (h?.pick.t === t && mat.emissiveIntensity < 0.05) {
          mat.emissive.set("#38bdf8");
          mat.emissiveIntensity = 0.18;
        } else if (h?.pick.t !== t && mat.emissive.getHexString() === "38bdf8") mat.emissiveIntensity = 0;
      });
      if (!h || (live.current.mode !== "pd" && live.current.mode !== "rec")) return;
      const f = frames.get(h.pick.t);
      if (!f) return;
      const ix = indexOf(live.current.data);
      const r0 = siteVal(ix, "rec", h.pick.t, h.pick.s, h.pick.p);
      const gm = typeof r0 === "number" ? r0 : 0;
      // mm 눈금 — 치아 축을 따라(3mm마다 길게), 치아에 가려지지 않게 맨 위에
      const from = live.current.mode === "pd" ? gm : -3;
      const to = live.current.mode === "pd" ? gm + 15 : 10;
      const onTop = (m: THREE.Mesh) => {
        (m.material as THREE.MeshStandardMaterial).depthTest = false;
        m.renderOrder = 5;
        hoverLayer.add(m);
      };
      onTop(bar(v3(sitePoint3D(f, h.pick.s, h.pick.p, from, 1.5)), v3(sitePoint3D(f, h.pick.s, h.pick.p, to, 1.5)), 0.12, "#0284c7"));
      for (let n = Math.ceil(from); n <= to; n++) {
        const long = n % 3 === 0;
        onTop(bar(v3(sitePoint3D(f, h.pick.s, h.pick.p, n, 1.5)), v3(sitePoint3D(f, h.pick.s, h.pick.p, n, long ? 3.4 : 2.4)), long ? 0.14 : 0.09, "#0284c7"));
      }
      if (typeof h.value === "number" || h.value === "F") {
        if (live.current.mode === "pd") {
          const n = h.value === "F" ? f.rootLen : Number(h.value);
          if (n > 0) {
            const b = bar(v3(sitePoint3D(f, h.pick.s, h.pick.p, gm, 0.75)), v3(sitePoint3D(f, h.pick.s, h.pick.p, gm + n, 0.75)), 0.5, pdColor(pdNum(h.value)), 0.55);
            hoverLayer.add(b);
          }
        } else {
          hoverLayer.add(dot(v3(sitePoint3D(f, h.pick.s, h.pick.p, Number(h.value), 0.6)), 0.55, "#be185d"));
        }
      }
    };

    // ── 따라 보기: 치아·면마다 "표준 시점"으로 부드럽게 옮겨 간다 ──
    // (예전: 지금 화면에서 상대적으로 돌림 → 여러 번 쌓이면 각도·거리가 어긋나 엉뚱한 곳에서 보게 됨. 이제 늘 같은 자리에서 본다)
    //   바깥(B) = 그 치아 바깥에서 수평으로(교합면 쪽 살짝) · 안쪽(P/L) = 교합면 너머 위(아래)에서 내려다보며 안쪽 면을
    const jawCenter = (upper: boolean) => {
      const c = new THREE.Vector3();
      let n = 0;
      frames.forEach((f) => {
        if (f.upper === upper) {
          c.add(v3(f.cej));
          n++;
        }
      });
      return c.multiplyScalar(1 / Math.max(1, n));
    };
    const jc = { upper: jawCenter(true), lower: jawCenter(false) };
    const overview = { target: center.clone(), dir: new THREE.Vector3(0, 0, 1), dist: radius * 2.6 };
    let goal: { target: THREE.Vector3; dir: THREE.Vector3; dist: number } | null = null;
    let followed = "";
    const dimJaw = (hideUpper: boolean | null) =>
      teeth.forEach((m, tt) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.opacity = hideUpper !== null && isUpper(tt) === hideUpper ? 0.1 : 1;
        mat.depthWrite = mat.opacity === 1;
      });
    const followTo = (t: Fdi, s: Side) => {
      const f = frames.get(t);
      if (!f) return;
      const c = f.upper ? jc.upper : jc.lower;
      const cej = v3(f.cej);
      const outH = new THREE.Vector3(cej.x - c.x, 0, cej.z - c.z).normalize(); // 턱 중심 → 치아(바깥 방향)
      const occl = new THREE.Vector3(0, f.upper ? -1 : 1, 0);
      const dir =
        s === "B"
          ? outH.clone().add(occl.clone().multiplyScalar(0.2)).add(new THREE.Vector3(0, 0, 0.12)).normalize()
          : occl.clone().multiplyScalar(0.95).add(outH.clone().multiplyScalar(-0.6)).normalize();
      // 치아(CEJ)를 화면 가운데 — 뿌리 쪽 4mm(잴 곳)를 살짝 더 보이게
      const target = cej.clone().add(v3(f.root).multiplyScalar(2));
      goal = { target, dir, dist: radius * (s === "B" ? 1.25 : 1.4) };
      // 안쪽을 볼 때 맞은편 턱은 비켜 준다(전체 보기일 때)
      dimJaw(s === "L" && live.current.jaw === "all" ? !f.upper : null);
    };
    const resetView = () => {
      goal = { ...overview, target: overview.target.clone(), dir: overview.dir.clone() };
      followed = "";
      dimJaw(null);
    };
    // 손으로 돌리면 따라 보기를 멈춘다(다음에 머물 때 다시)
    controls.addEventListener("start", () => {
      goal = null;
    });

    // ── 포인터 ──
    const ray = new THREE.Raycaster();
    const pick = (ev: PointerEvent): { pick: PerioPick; point: THREE.Vector3 } | null => {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
      const targets = [...teeth.values()].filter((m) => m.visible && (m.material as THREE.MeshStandardMaterial).opacity > 0.5);
      const hit = ray.intersectObjects(targets, false)[0];
      if (!hit) return null;
      const t = hit.object.userData.fdi as Fdi;
      const f = frames.get(t)!;
      const s3 = pointToSite3D(f, [hit.point.x, hit.point.y, hit.point.z]);
      return { pick: { t, s: s3.side, p: s3.pos, mm: s3.mm, zone: s3.mm >= 0 ? "crown" : "root" }, point: hit.point.clone() };
    };
    let pressOnTooth = false;
    let lastMouse: PointerEvent | null = null;
    // 머문 곳 — ★실제 마우스 움직임으로만 갱신(화면이 움직여 포인터 아래가 바뀐 건 머문 걸로 치지 않는다 → 되먹임 없음)
    let dwell: { key: string; t0: number; pick: PerioPick } | null = null;
    /** 빈 곳에 머문 시작 — 1초면 전체 보기로 돌아간다(위턱 보다가 아래턱으로 넘어가기 쉽게) */
    let emptySince = 0;
    const onDown = (ev: PointerEvent) => {
      live.current.lastPointer = ev.pointerType;
      const p = ev.button === 0 || ev.pointerType !== "mouse" ? pick(ev) : null;
      pressOnTooth = !!p;
      controls.enabled = !p; // 치아를 짚으면 돌리지 않고 잰다
      if (p) {
        renderer.domElement.setPointerCapture(ev.pointerId);
        live.current.onPick("down", ev.pointerType, p.pick);
      }
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.buttons && !pressOnTooth) return; // 빈 곳 끌기 = 돌리기
      const p = pick(ev);
      live.current.onPick("move", ev.pointerType, p?.pick ?? null);
      if (ev.pointerType === "mouse") lastMouse = ev;
      if (ev.pointerType === "mouse" && p) {
        const key = `${p.pick.t}${p.pick.s}`;
        if (!dwell || dwell.key !== key) dwell = { key, t0: performance.now(), pick: p.pick };
        emptySince = 0;
      } else if (!p) {
        dwell = null;
        if (ev.pointerType === "mouse" && !emptySince) emptySince = performance.now();
      }
    };
    const onUp = (ev: PointerEvent) => {
      if (pressOnTooth) live.current.onPick("up", ev.pointerType, pick(ev)?.pick ?? null);
      pressOnTooth = false;
      controls.enabled = true;
    };
    const onLeave = () => {
      dwell = null;
      emptySince = 0;
      lastMouse = null;
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
      if (live.current.follow && emptySince && followed && now - emptySince > 1000) {
        emptySince = 0;
        resetView();
      }
      // 같은 치아·면에 0.35초 머물면 그 표준 시점으로
      if (live.current.follow && dwell && now - dwell.t0 > 350 && dwell.key !== followed) {
        followed = dwell.key;
        followTo(dwell.pick.t, dwell.pick.s);
      }
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
        // 움직이는 동안 포인터 아래를 다시 읽어 미리보기 = 기록 값
        if (lastMouse && !lastMouse.buttons) {
          camera.updateMatrixWorld();
          const p = pick(lastMouse);
          live.current.onPick("move", "mouse", p?.pick ?? null);
        }
      }
      lastT = now;
      controls.update();
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
          const s = project(v3(sitePoint3D(f, h.pick.s, h.pick.p, depth, 3.2)));
          bub.style.transform = `translate(${s.x + (L.lastPointer === "mouse" ? 18 : -18)}px, ${s.y - (L.lastPointer === "mouse" ? 18 : 64)}px)`;
          bub.style.opacity = "1";
          bub.style.background = L.mode === "pd" ? pdColor(pdNum(h.value)) : "#be185d";
          bub.textContent = String(h.value);
        } else bub.style.opacity = "0";
        if (h && f) {
          const s = project(v3(sitePoint3D(f, h.pick.s, "C", -f.crown - 1.5, 0)));
          tip.style.transform = `translate(${s.x - 30}px, ${s.y - 12}px)`;
          tip.style.opacity = "1";
          tip.textContent = `${h.pick.t} ${h.pick.s === "B" ? "바깥" : "안쪽"} ${h.pick.p}${(() => {
            const mob = Number(toothVal(indexOf(L.data), "mob", h.pick.t) ?? 0);
            return mob ? ` · ${MOB_LABEL[mob]}` : "";
          })()}`;
        } else tip.style.opacity = "0";
      }
      const ring = ringRef.current;
      if (ring) {
        const c = L.cursor;
        const f = c ? frames.get(c.t) : null;
        if (c && f && jawVisible(f.upper)) {
          const ix = indexOf(L.data);
          const r0 = siteVal(ix, "rec", c.t, c.s, c.p);
          const s = project(v3(sitePoint3D(f, c.s, c.p, typeof r0 === "number" ? r0 : 0, 0.5)));
          ring.style.transform = `translate(${s.x - 9}px, ${s.y - 9}px)`;
          ring.style.opacity = "1";
        } else ring.style.opacity = "0";
      }
    };
    loop();

    api.current = { rebuild, redrawHover, followTo, resetView };
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

  // 손가락으로 기록하면 다음 칸 쪽으로 돈다(마우스는 머무는 곳을 따라감)
  useEffect(() => {
    if (cursor && follow && live.current.lastPointer !== "mouse") api.current?.followTo(cursor.t, cursor.s);
  }, [cursor, follow]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${className ?? ""}`}>
      <div ref={hostRef} className="absolute inset-0" />
      <button
        type="button"
        onClick={() => api.current?.resetView()}
        className="absolute left-2 top-2 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white"
      >
        ⤢ 전체
      </button>
      <div ref={ringRef} className="pointer-events-none absolute left-0 top-0 h-[18px] w-[18px] opacity-0">
        <div className="absolute inset-0 rounded-full border-2 border-sky-600" style={{ animation: "perio-pulse 1.4s ease-out infinite" }} />
        <div className="absolute inset-[5px] rounded-full bg-sky-600" />
      </div>
      <div ref={tipRef} className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-bold text-white opacity-0 transition-opacity" />
      <div ref={bubbleRef} className="pointer-events-none absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold text-white opacity-0 shadow-lg transition-[background-color]" />
    </div>
  );
}
