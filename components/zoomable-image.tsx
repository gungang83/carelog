"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 보기 전용 이미지 줌/팬 뷰어 (상담 이력 라이트박스 등).
 * - 휠/버튼 줌, 핀치 줌(2손가락), 드래그/2손가락 팬, 더블클릭 토글.
 * - 외부 라이브러리 없이 CSS transform으로 구현.
 */
export function ZoomableImage({
  src,
  alt = "",
  className = "",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const dragRef = useRef<{ cx: number; cy: number; px: number; py: number } | null>(
    null,
  );
  const pinchRef = useRef<{ d0: number; z0: number } | null>(null);

  const clamp = (z: number) => Math.min(Math.max(z, 1), 5);
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const zoomBy = (factor: number) =>
    setZoom((z) => {
      const nz = clamp(z * factor);
      if (nz === 1) setPan({ x: 0, y: 0 });
      return nz;
    });

  // 휠 줌 (passive:false 네이티브 리스너 — preventDefault 위해)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => {
        const nz = clamp(z * (e.deltaY < 0 ? 1.12 : 0.89));
        if (nz === 1) setPan({ x: 0, y: 0 });
        return nz;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const dist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  return (
    <div
      ref={wrapRef}
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
      style={{ touchAction: "none", cursor: zoom > 1 ? "grab" : "default" }}
      onMouseDown={(e) => {
        if (zoom === 1) return;
        dragRef.current = { cx: e.clientX, cy: e.clientY, px: pan.x, py: pan.y };
      }}
      onMouseMove={(e) => {
        if (!dragRef.current) return;
        setPan({
          x: dragRef.current.px + (e.clientX - dragRef.current.cx),
          y: dragRef.current.py + (e.clientY - dragRef.current.cy),
        });
      }}
      onMouseUp={() => (dragRef.current = null)}
      onMouseLeave={() => (dragRef.current = null)}
      onTouchStart={(e) => {
        if (e.touches.length === 2) {
          pinchRef.current = { d0: dist(e.touches), z0: zoom };
        } else if (e.touches.length === 1 && zoom > 1) {
          const t = e.touches[0];
          dragRef.current = { cx: t.clientX, cy: t.clientY, px: pan.x, py: pan.y };
        }
      }}
      onTouchMove={(e) => {
        if (pinchRef.current && e.touches.length === 2) {
          e.preventDefault();
          const nz = clamp(pinchRef.current.z0 * (dist(e.touches) / pinchRef.current.d0));
          setZoom(nz);
          if (nz === 1) setPan({ x: 0, y: 0 });
        } else if (dragRef.current && e.touches.length === 1) {
          e.preventDefault();
          const t = e.touches[0];
          setPan({
            x: dragRef.current.px + (t.clientX - dragRef.current.cx),
            y: dragRef.current.py + (t.clientY - dragRef.current.cy),
          });
        }
      }}
      onTouchEnd={() => {
        pinchRef.current = null;
        dragRef.current = null;
      }}
      onDoubleClick={() => (zoom === 1 ? setZoom(2) : reset())}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-h-full w-auto max-w-full select-none rounded-xl object-contain"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transition:
            dragRef.current || pinchRef.current ? "none" : "transform .12s",
        }}
      />

      {/* 줌 컨트롤 */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-white/90 p-1 shadow-md backdrop-blur">
        <CtrlBtn onClick={() => zoomBy(0.8)} label="축소">
          −
        </CtrlBtn>
        <button
          type="button"
          onClick={reset}
          className="min-w-14 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          {Math.round(zoom * 100)}%
        </button>
        <CtrlBtn onClick={() => zoomBy(1.25)} label="확대">
          ＋
        </CtrlBtn>
      </div>
    </div>
  );
}

function CtrlBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-base font-bold text-slate-700 hover:bg-slate-100"
    >
      {children}
    </button>
  );
}
