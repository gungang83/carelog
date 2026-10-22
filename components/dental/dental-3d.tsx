"use client";

// spec 037 2단계 — 3D 치아 보기(시제품). three.js 직접 사용(번들 분리: next/dynamic으로 불러 쓸 것).
// 모델: ① 기본 = Carelog 자체 생성(lib/dental/teeth-3d.ts) ② modelUrl = 외부 GLB(메시 이름 T11~T48 규칙).
// 조작: 끌어서 돌리기·휠/핀치 확대 · 시점 버튼 · 입 벌리기 · 치아 누르면 선택(치식 표시).

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { isUpper, toothLabel, type Fdi } from "@/lib/dental/teeth";
import { buildProceduralTeeth, fdiFromMeshName } from "@/lib/dental/teeth-3d";

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

type ToothObj = { fdi: Fdi; mesh: THREE.Mesh; baseY: number };

export function Dental3D({
  modelUrl,
  withThirdMolars = false,
  accent = "#f87171",
  paint,
  className,
}: {
  /** 외부 GLB. 없으면 자체 생성 모델 */
  modelUrl?: string;
  withThirdMolars?: boolean;
  /** 선택한 치아 색 */
  accent?: string;
  /** 치아별 고정 색 — { "16": "#fecaca" } */
  paint?: Record<Fdi, string | undefined>;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setView: (v: View) => void;
    setOpen: (mm: number) => void;
    teeth: ToothObj[];
    repaint: () => void;
  } | null>(null);
  const [selected, setSelected] = useState<Fdi[]>([]);
  const [hovered, setHovered] = useState<Fdi | null>(null);
  const [open, setOpen] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const sel = useRef<Fdi[]>([]);
  const hov = useRef<Fdi | null>(null);
  const colors = useRef({ accent, paint });

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
    let center = new THREE.Vector3();
    let radius = 40;

    const repaint = () => {
      const { accent: ac, paint: pt } = colors.current;
      for (const t of teeth) {
        const m = t.mesh.material as THREE.MeshStandardMaterial;
        const c = sel.current.includes(t.fdi) ? new THREE.Color(ac) : pt?.[t.fdi] ? new THREE.Color(pt[t.fdi]) : BASE;
        m.color.copy(c);
        m.emissive.copy(hov.current === t.fdi ? HOVER : new THREE.Color("#000000"));
        m.emissiveIntensity = hov.current === t.fdi ? 0.35 : 0;
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
    };

    const setOpenMm = (mm: number) => {
      for (const t of teeth) t.mesh.position.y = t.baseY + (isUpper(t.fdi) ? mm / 2 : -mm / 2);
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
      mesh.material = new THREE.MeshStandardMaterial({ color: BASE, roughness: 0.42, metalness: 0 });
      mesh.userData.fdi = fdi;
      teeth.push({ fdi, mesh, baseY: mesh.position.y });
    };

    const onReady = () => {
      if (disposed) return;
      fit();
      repaint();
      api.current = { setView, setOpen: setOpenMm, teeth, repaint };
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
    const pick = (ev: PointerEvent): Fdi | null => {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(teeth.filter((t) => t.mesh.visible).map((t) => t.mesh), false)[0];
      return (hit?.object.userData.fdi as Fdi | undefined) ?? null;
    };
    let down: [number, number] | null = null;
    const onDown = (ev: PointerEvent) => (down = [ev.clientX, ev.clientY]);
    const onUp = (ev: PointerEvent) => {
      if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 5) return;
      down = null;
      const fdi = pick(ev);
      if (!fdi) return;
      sel.current = sel.current.includes(fdi) ? sel.current.filter((x) => x !== fdi) : [...sel.current, fdi];
      setSelected(sel.current);
      repaint();
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.buttons) return;
      const fdi = pick(ev);
      if (fdi !== hov.current) {
        hov.current = fdi;
        setHovered(fdi);
        repaint();
        renderer.domElement.style.cursor = fdi ? "pointer" : "grab";
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
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, [modelUrl, withThirdMolars]);

  // 색 바뀌면 다시 칠하기
  useEffect(() => {
    colors.current = { accent, paint };
    api.current?.repaint();
  }, [accent, paint]);

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
            max={30}
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
            ? toothLabel(hovered)
            : selected.length > 0
              ? `선택: ${selected.join(", ")}`
              : "끌어서 돌리기 · 휠/두 손가락으로 확대 · 치아를 누르면 선택")}
      </div>
    </div>
  );
}
