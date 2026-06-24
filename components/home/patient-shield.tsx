"use client";

import { useState } from "react";

/**
 * 환자 대면 보호막 (C-02 · 파일럿 W0 피드백).
 *
 * 환자가 화면을 함께 보는 홈에서 민감한 기록 목록(미연결 기록·환자 검색)을
 * 기본적으로 **가린다**. 직원이 "기록 펴기"를 누르거나 흐린 영역을 클릭해야 노출.
 * 보호 우선이라 펼친 상태는 기억하지 않고 **매 진입 시 다시 가린다**.
 */
export function PatientShield({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <section className="relative">
      {/* 펴진 상태 안내 바 — 다시 가리기 */}
      {revealed && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <span className="text-xs font-medium text-amber-700 break-keep">
            진료 기록 표시 중 — 환자가 화면을 보면 가려주세요
          </span>
          <button
            type="button"
            onClick={() => setRevealed(false)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
          >
            <ShieldIcon className="size-3.5" />
            가리기
          </button>
        </div>
      )}

      {/* 콘텐츠 — 가린 상태에선 흐리게·접힘 + 클릭 차단 */}
      <div
        className={
          revealed
            ? "flex flex-col gap-8"
            : "flex max-h-44 select-none flex-col gap-8 overflow-hidden opacity-40 blur-[7px] pointer-events-none"
        }
        aria-hidden={!revealed}
      >
        {children}
      </div>

      {/* 가린 상태 오버레이 — 큰 안내문 + 펴기 (영역 전체 클릭 가능) */}
      {!revealed && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setRevealed(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setRevealed(true);
            }
          }}
          aria-label="가려진 진료 기록 펴기"
          className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-sky-100 bg-white/75 p-7 text-center backdrop-blur-[2px] transition hover:bg-white/85"
        >
          <ShieldIcon className="size-9 text-sky-500" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">환자 대면 화면</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500 break-keep">
              진료 기록은 개인정보 보호를 위해 가려져 있어요.
              <br />
              직원이 확인하려면 펴주세요.
            </p>
          </div>
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-sky-200">
            <EyeIcon className="size-4" />
            기록 펴기
          </span>
        </div>
      )}
    </section>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.75Zm4.196 5.954a.75.75 0 0 0-1.214-.882l-3.236 4.53-1.696-1.696a.75.75 0 0 0-1.06 1.06l2.31 2.31a.75.75 0 0 0 1.137-.089l3.76-5.263Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path
        fillRule="evenodd"
        d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
