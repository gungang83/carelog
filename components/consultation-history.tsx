"use client";

import { useCallback, useEffect, useState } from "react";

export type ConsultationHistoryItem = {
  id: string;
  content: string;
  image_urls: string[] | null;
  prescriptions: string[] | null;
  station_name: string | null;
  created_at: string;
};

type Props = {
  consultations: ConsultationHistoryItem[];
};

const PRODUCT_ICON: Record<string, string> = {
  "미세모 칫솔": "칫솔",
  "고불소 치약": "치약",
  "치간 칫솔": "치간",
  "무알콜 가글": "가글",
};

function iconLabel(name: string) {
  const label = PRODUCT_ICON[name] ?? name;
  return label.length > 3 ? label.slice(0, 3) : label;
}

export function ConsultationHistory({ consultations }: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const closeLightbox = useCallback(() => setLightboxUrl(null), []);

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl, closeLightbox]);

  if (consultations.length === 0) {
    return (
      <p className="mt-6 text-sm text-slate-600">
        아직 저장된 상담 기록이 없습니다.
      </p>
    );
  }

  return (
    <>
      <ol className="mt-6 space-y-4">
        {consultations.map((c) => {
          const created = new Date(c.created_at);
          const createdLabel = Number.isNaN(created.getTime())
            ? c.created_at
            : created.toLocaleString("ko-KR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });

          const urls = c.image_urls ?? [];
          const prescriptions = c.prescriptions ?? [];

          return (
            <li
              key={c.id}
              className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <time
                  dateTime={c.created_at}
                  className="text-xs font-semibold text-slate-500"
                >
                  {createdLabel}
                </time>
                {c.station_name ? (
                  <>
                    <span className="text-[11px] text-sky-200" aria-hidden>
                      ·
                    </span>
                    <span className="text-[11px] font-medium tracking-tight text-sky-700">
                      {c.station_name}
                    </span>
                  </>
                ) : null}
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                {c.content}
              </p>

              {urls.length ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-600">
                    이미지 ({urls.length}) — 썸네일을 눌러 확대
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {urls.map((url, idx) => (
                      <button
                        key={`${c.id}-${idx}`}
                        type="button"
                        onClick={() => setLightboxUrl(url)}
                        className="group relative overflow-hidden rounded-xl border border-sky-100 bg-sky-50/30 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt=""
                          className="h-28 w-full object-cover transition group-hover:scale-[1.02]"
                        />
                        <span className="absolute bottom-2 right-2 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-semibold text-sky-800 shadow">
                          확대
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {prescriptions.length ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-600">
                    처방 제품
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {prescriptions.map((name) => (
                      <button
                        key={`${c.id}-${name}`}
                        type="button"
                        onClick={() => {
                          /* 추후 상세 모달 연결용 */
                        }}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50 px-4 py-2.5 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md active:scale-[0.99]"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-xs font-bold text-sky-800">
                          {iconLabel(name)}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">
                          {name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 text-xs text-slate-500">
                환자 뷰어:{" "}
                <span className="font-mono text-slate-600">/view/{c.id}</span>
              </div>
            </li>
          );
        })}
      </ol>

      {lightboxUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="이미지 확대"
          onClick={closeLightbox}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-4xl rounded-2xl border border-sky-100 bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute right-3 top-3 z-10 min-h-11 min-w-11 rounded-xl border border-sky-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-sky-50"
            >
              닫기
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt=""
              className="mx-auto max-h-[80vh] w-auto max-w-full rounded-xl object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
