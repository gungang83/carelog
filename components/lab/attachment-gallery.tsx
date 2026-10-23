"use client";

// spec 035 — 기공지 첨부 미리보기: 썸네일 → 크게 보기(확대·이동) · 그림 수정 · 빼기.
// 미리보기 주소(previews)는 이 세션에서 올린 파일의 로컬 주소 또는 10분짜리 서명 URL — 화면에만 쓰고 저장하지 않는다.

import { useState } from "react";
import type { LabAttachmentMeta } from "@/lib/lab-orders";

const KIND_ICON: Record<string, string> = { photo: "📷", video: "🎬", sketch: "✏️" };

export function AttachmentGallery({
  attachments,
  previews,
  onRemove,
  onEdit,
}: {
  attachments: LabAttachmentMeta[];
  /** path → 미리보기 주소 */
  previews: Record<string, string>;
  onRemove: (index: number) => void;
  /** 사진·그림을 그림 도구로 수정 */
  onEdit: (index: number) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const show = (i: number) => {
    setZoom(1);
    setOpen(i);
  };
  const cur = open !== null ? attachments[open] : null;
  const curUrl = cur ? previews[cur.path] : undefined;

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {attachments.map((a, i) => {
          const url = previews[a.path];
          return (
            <li key={a.path} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => show(i)}
                className="relative flex aspect-[4/3] w-full items-center justify-center bg-slate-50"
                title="크게 보기"
              >
                {url ? (
                  a.kind === "video" ? (
                    <>
                      <video src={url} muted preload="metadata" className="h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center text-3xl text-white drop-shadow">▶</span>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={a.name} className="h-full w-full object-contain" />
                  )
                ) : (
                  <span className="text-2xl">{KIND_ICON[a.kind] ?? "📎"}</span>
                )}
              </button>
              <div className="flex items-center gap-1 border-t border-slate-100 px-2 py-1 text-[11px] text-slate-500">
                <span>{KIND_ICON[a.kind] ?? "📎"}</span>
                <span className="min-w-0 flex-1 truncate" title={a.name}>
                  {(a.bytes / 1024 / 1024).toFixed(1)}MB
                </span>
                {a.kind !== "video" && url && (
                  <button type="button" onClick={() => onEdit(i)} className="rounded px-1 text-sky-600 hover:bg-sky-50">
                    수정
                  </button>
                )}
                <button type="button" onClick={() => onRemove(i)} className="rounded px-1 text-rose-500 hover:bg-rose-50">
                  빼기
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* 크게 보기 — 확대 버튼·휠, 확대 상태에선 스크롤로 이동 */}
      {cur && open !== null && (
        <div className="fixed inset-0 z-[75] flex flex-col bg-slate-900/90">
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-white">
            <span className="min-w-0 flex-1 truncate">
              {KIND_ICON[cur.kind]} {cur.name}
            </span>
            {cur.kind !== "video" && (
              <>
                <button type="button" onClick={() => setZoom((z) => Math.max(1, z / 1.5))} className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20">
                  −
                </button>
                <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => setZoom((z) => Math.min(6, z * 1.5))} className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20">
                  +
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const i = open;
                    setOpen(null);
                    onEdit(i);
                  }}
                  className="rounded-lg bg-sky-600 px-3 py-1 font-semibold hover:bg-sky-500"
                >
                  ✏️ 수정
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                const i = open;
                setOpen(null);
                onRemove(i);
              }}
              className="rounded-lg bg-rose-600/80 px-3 py-1 hover:bg-rose-600"
            >
              빼기
            </button>
            <button type="button" onClick={() => setOpen(null)} className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20">
              닫기
            </button>
          </div>
          <div
            className="min-h-0 flex-1 overflow-auto"
            onWheel={(e) => {
              if (cur.kind === "video" || !(e.ctrlKey || e.metaKey)) return;
              setZoom((z) => Math.min(6, Math.max(1, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
            }}
          >
            {!curUrl ? (
              <p className="p-8 text-center text-sm text-white/70">미리보기를 불러오는 중이거나 불러오지 못했습니다.</p>
            ) : cur.kind === "video" ? (
              <video src={curUrl} controls autoPlay className="mx-auto max-h-full max-w-full" />
            ) : (
              <div className="flex min-h-full items-center justify-center p-4" style={{ width: `${zoom * 100}%` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={curUrl}
                  alt={cur.name}
                  onClick={() => setZoom((z) => (z > 1 ? 1 : 2.5))}
                  className={`max-w-full bg-white ${zoom > 1 ? "cursor-zoom-out" : "max-h-[82vh] cursor-zoom-in"}`}
                  style={zoom > 1 ? { width: "100%" } : undefined}
                />
              </div>
            )}
          </div>
          {cur.kind !== "video" && (
            <p className="pb-3 text-center text-xs text-white/60">사진을 누르면 확대/원래대로 · Ctrl(⌘)+휠로 확대 · 확대하면 스크롤로 이동</p>
          )}
        </div>
      )}
    </>
  );
}
