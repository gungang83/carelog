"use client";

// spec 037 2단계 — 3D 치아 보기(시제품). three.js 직접 사용(번들 분리: next/dynamic으로 불러 쓸 것).
// 모델: ① 기본 = Carelog 자체 생성(lib/dental/teeth-3d.ts) ② modelUrl = 외부 GLB(메시 이름 T11~T48 규칙).
// 조작: 끌어서 돌리기·휠/핀치 확대 · 시점 버튼 · 입 벌리기 · 치아 누르면 선택(치식 표시).

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { isUpper, toothLabel, type Fdi } from "@/lib/dental/teeth";
import { buildGapPoints3D, buildProceduralTeeth, fdiFromMeshName } from "@/lib/dental/teeth-3d";

type View = "front" | "upper" | "lower" | "right" | "left";
const VIEWS: { id: View; label: string }[] = [
  { id: "front", label: "정면" },
  { id: "right", label: "우측" },
  { id: "left", label: "좌측" },
  { id: "upper", label: "상악 교합면" },
  { id: "lower", label: "하악 교합면" },
];

const BASE = new THREE.Color("#f4ecdc");
const HOVER = new THREE.Color("#e0f2fe");

type ToothObj = { fdi: Fdi; mesh: THREE.Mesh };
type MarkerObj = { id: string; upper: boolean; mesh: THREE.Mesh };

// 입 벌리기 = 하악이 턱관절(과두)을 축으로 회전. 평균 성인 기준 하악 전치 → 과두 약 92mm 뒤, 교합평면 위 약 20mm.
const HINGE_BACK_MM = 92;
const HINGE_UP_MM = 20;
const MAX_OPEN_DEG = 22;


/** 지금 보이는 화면을 PNG로(상담 기록에 담기) */
export type Capture3D = () => Promise<Blob | null>;

export function Dental3D({
  modelUrl,
  withThirdMolars = false,
  paint,
  onToothClick,
  showGaps = false,
  gapColors,
  onGapClick,
  captureRef,
  className,
}: {
  /** 외부 GLB. 없으면 자체 생성 모델 */
  modelUrl?: string;
  withThirdMolars?: boolean;
  /** 치아별 색 — { "16": "#f87171" } (2D와 같은 선택 상태를 그대로 받는다) */
  paint?: Record<Fdi, string | undefined>;
  onToothClick?: (fdi: Fdi) => void;
  /** 치아 사이(치간) 표시 점을 띄운다(치간칫솔 차트) */
  showGaps?: boolean;
  /** 치간 id("17-16") → 지정 색 */
  gapColors?: Record<string, string | undefined>;
  onGapClick?: (id: string) => void;
  captureRef?: { current: Capture3D | null };
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setView: (v: View) => void;
    setOpen: (deg: number) => void;
    teeth: ToothObj[];
    repaint: () => void;
  } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [open, setOpen] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const hov = useRef<string | null>(null);
  const colors = useRef({ paint, gapColors });
  const click = useRef({ tooth: onToothClick, marker: onGapClick });

  // 색·클릭 처리 바뀌면 반영 — ★아래 장면 effect보다 먼저 선언(사랑니 전환으로 장면을 다시 만들 때 최신 값을 쓰게)
  useEffect(() => {
    colors.current = { paint, gapColors };
    click.current = { tooth: onToothClick, marker: onGapClick };
    api.current?.repaint();
  }, [paint, gapColors, onToothClick, onGapClick]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor("#ffffff");
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#ffffff", "#c8bfae", 1.6));
    const key = new THREE.DirectionalLight("#ffffff", 1.5);
    key.position.set(30, 60, 80);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#ffffff", 0.6);
    fill.position.set(-50, -40, 30);
    scene.add(fill);

    const camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;

    const root = new THREE.Group();
    scene.add(root);
    const teeth: ToothObj[] = [];
    const marks: MarkerObj[] = [];
    const markGeo = new THREE.SphereGeometry(1, 20, 14);
    let center = new THREE.Vector3();
    let radius = 40;

    const repaint = () => {
      const { paint: pt, gapColors: gc } = colors.current;
      for (const t of teeth) {
        const m = t.mesh.material as THREE.MeshStandardMaterial;
        const c = pt?.[t.fdi] ? new THREE.Color(pt[t.fdi]) : BASE;
        m.color.copy(c);
        m.emissive.copy(hov.current === t.fdi ? HOVER : new THREE.Color("#000000"));
        m.emissiveIntensity = hov.current === t.fdi ? 0.35 : 0;
      }
      for (const o of marks) {
        const color = gc?.[o.id];
        const m = o.mesh.material as THREE.MeshStandardMaterial;
        m.color.set(color ?? "#cbd5e1");
        m.opacity = color ? 1 : 0.75;
        m.emissive.set(hov.current === o.id ? "#38bdf8" : "#000000");
        m.emissiveIntensity = hov.current === o.id ? 0.5 : 0;
        o.mesh.scale.setScalar(color ? 1.25 : hov.current === o.id ? 1.15 : 0.9);
      }
    };

    // 시점 이동(부드럽게)
    let tween: { from: THREE.Vector3; to: THREE.Vector3; t0: number } | null = null;
    const setView = (v: View) => {
      const D = radius * 3.2;
      const eps = D * 0.01; // 교합면 시점: 정확히 수직이면 화면 방향이 흔들려 살짝 비튼다(앞니가 화면 위/아래에 오게)
      const dir: Record<View, THREE.Vector3> = {
        front: new THREE.Vector3(0, 0, D),
        right: new THREE.Vector3(-D, 0, D * 0.25),
        left: new THREE.Vector3(D, 0, D * 0.25),
        upper: new THREE.Vector3(0, -D, eps),
        lower: new THREE.Vector3(0, D, eps),
      };
      tween = { from: camera.position.clone(), to: center.clone().add(dir[v]), t0: performance.now() };
      // 교합면 시점에선 맞은편 아치가 가리므로 숨긴다
      for (const t of teeth) t.mesh.visible = v === "upper" ? isUpper(t.fdi) : v === "lower" ? !isUpper(t.fdi) : true;
      for (const o of marks) o.mesh.visible = v === "upper" ? o.upper : v === "lower" ? !o.upper : true;
    };

    // 하악(치아·치간 점)은 경첩 그룹에 담아 과두 축으로 돌린다 — jaw(축 위치) ⊃ jawInner(축 위치만큼 되돌림)
    const jaw = new THREE.Group();
    const jawInner = new THREE.Group();
    jaw.add(jawInner);
    scene.add(jaw);
    const setOpenDeg = (deg: number) => {
      jaw.rotation.x = (deg * Math.PI) / 180;
    };

    const fit = () => {
      const box = new THREE.Box3().setFromObject(root);
      center = box.getCenter(new THREE.Vector3());
      radius = box.getSize(new THREE.Vector3()).length() / 2;
      controls.target.copy(center);
      controls.minDistance = radius * 1.2;
      controls.maxDistance = radius * 8;
      camera.position.copy(center).add(new THREE.Vector3(0, 0, radius * 3.2));
      camera.lookAt(center);
    };

    const addTooth = (fdi: Fdi, mesh: THREE.Mesh) => {
      // 자체 모델은 정점 음영(구·와)을 갖고 있다 — 있으면 재질 색과 곱해 쓴다
      const vertexColors = !!mesh.geometry.getAttribute("color");
      mesh.material = new THREE.MeshStandardMaterial({ color: BASE, roughness: 0.42, metalness: 0, vertexColors });
      mesh.userData.fdi = fdi;
      teeth.push({ fdi, mesh });
    };

    const onReady = () => {
      if (disposed) return;
      fit();
      // 경첩 축: 하악 전치에서 뒤로·위로
      const front = new THREE.Box3().setFromObject(root).max.z;
      const hinge = new THREE.Vector3(0, HINGE_UP_MM, front - HINGE_BACK_MM);
      jaw.position.copy(hinge);
      jawInner.position.copy(hinge).negate();
      root.updateMatrixWorld(true);
      jaw.updateMatrixWorld(true);
      for (const t of teeth) if (!isUpper(t.fdi)) jawInner.attach(t.mesh);
      // 치간 표시 점은 화면 맞춤(fit) 계산에서 빼고 나중에 얹는다(하악 점은 경첩 그룹에)
      for (const g of showGaps ? buildGapPoints3D({ withThirdMolars }) : []) {
        const mesh = new THREE.Mesh(markGeo, new THREE.MeshStandardMaterial({ roughness: 0.35, transparent: true }));
        mesh.position.set(...g.position);
        mesh.userData.marker = g.id;
        (g.upper ? scene : jawInner).add(mesh);
        marks.push({ id: g.id, upper: g.upper, mesh });
      }
      repaint();
      api.current = { setView, setOpen: setOpenDeg, teeth, repaint };
      if (captureRef) {
        captureRef.current = () =>
          new Promise((res) => {
            renderer.render(scene, camera);
            renderer.domElement.toBlob(res, "image/png");
          });
      }
      setStatus("ready");
    };

    if (modelUrl) {
      new GLTFLoader().load(
        modelUrl,
        (gltf) => {
          root.add(gltf.scene);
          gltf.scene.traverse((o) => {
            const fdi = fdiFromMeshName(o.name);
            if (fdi && (o as THREE.Mesh).isMesh) addTooth(fdi, o as THREE.Mesh);
          });
          onReady();
        },
        undefined,
        () => !disposed && setStatus("error"),
      );
    } else {
      for (const { fdi, geometry } of buildProceduralTeeth({ withThirdMolars })) {
        const mesh = new THREE.Mesh(geometry);
        mesh.name = `T${fdi}`;
        root.add(mesh);
        addTooth(fdi, mesh);
      }
      onReady();
    }

    // 크기 맞춤
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

    // 치아 고르기(끌기와 구분: 5px 이내 이동만 클릭)
    const ray = new THREE.Raycaster();
    /** 누른 대상: 치간 점 { marker } 또는 치아 { fdi } */
    const pick = (ev: PointerEvent): { marker?: string; fdi?: Fdi } | null => {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
      const targets = [...marks.map((o) => o.mesh), ...teeth.map((t) => t.mesh)].filter((m) => m.visible);
      const hit = ray.intersectObjects(targets, false)[0];
      if (!hit) return null;
      const d = hit.object.userData;
      return d.marker ? { marker: d.marker as string } : d.fdi ? { fdi: d.fdi as Fdi } : null;
    };
    let down: [number, number] | null = null;
    const onDown = (ev: PointerEvent) => (down = [ev.clientX, ev.clientY]);
    const onUp = (ev: PointerEvent) => {
      if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 5) return;
      down = null;
      const p = pick(ev);
      if (p?.marker) click.current.marker?.(p.marker);
      else if (p?.fdi) click.current.tooth?.(p.fdi);
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.buttons) return;
      const p = pick(ev);
      // 치아 클릭을 안 받는 화면(치간칫솔 차트)에선 치아에 손가락 커서를 띄우지 않는다
      const key = p?.marker ?? (p?.fdi && click.current.tooth ? p.fdi : null);
      if (key !== hov.current) {
        hov.current = key;
        setHovered(key);
        repaint();
        renderer.domElement.style.cursor = key ? "pointer" : "grab";
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (tween) {
        const k = Math.min(1, (performance.now() - tween.t0) / 450);
        const e = 1 - Math.pow(1 - k, 3);
        camera.position.lerpVectors(tween.from, tween.to, e);
        if (k >= 1) tween = null;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      markGeo.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
      if (captureRef) captureRef.current = null;
    };
  }, [modelUrl, withThirdMolars, showGaps, captureRef]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white ${className ?? ""}`}>
      <div ref={hostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 p-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => api.current?.setView(v.id)}
            className="pointer-events-auto rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white"
          >
            {v.label}
          </button>
        ))}
        <label className="pointer-events-auto ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-xs text-slate-600 shadow-sm">
          입 벌리기
          <input
            type="range"
            min={0}
            max={MAX_OPEN_DEG}
            value={open}
            onChange={(e) => {
              const v = Number(e.target.value);
              setOpen(v);
              api.current?.setOpen(v);
            }}
          />
        </label>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2 text-center text-xs text-slate-500">
        {status === "loading" && "불러오는 중…"}
        {status === "error" && <span className="text-rose-600">
            {modelUrl ? "이 3D 모델 파일이 아직 준비되지 않았습니다." : "3D 모델을 만들지 못했습니다."}
          </span>}
        {status === "ready" &&
          (hovered
            ? hovered.includes("-")
              ? `치아 사이 ${hovered}`
              : toothLabel(hovered)
            : showGaps
              ? "끌어서 돌리기 · 휠/두 손가락으로 확대 · 치아 사이 점을 누르면 지정"
              : "끌어서 돌리기 · 휠/두 손가락으로 확대 · 치아를 누르면 표시")}
      </div>
    </div>
  );
}
