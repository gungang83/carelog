"use client";

import { useState } from "react";

/**
 * 환자 대면 보호막 (C-02 · 파일럿 W0 피드백).
 *
 * 환자가 화면을 함께 보는 홈에서 민감한 목록(미연결 상담 기록·환자 검색)을
 * 기본적으로 **가린다**. 가린 상태에선 흐린 미리보기가 넓게 깔리고 그 위에
 * 작은 안내 박스가 떠 있으며, 박스나 흐린 영역을 누르면 펴진다.
 * 상단 안내 바를 누르면 다시 가려진다. 보호 우선이라 펼친 상태는 기억하지 않고
 * **매 진입 시 다시 가린다**.
 *
 * ⚠️ 용어: 케어로그 산출물은 "상담 기록"이다. "진료 기록"(의무기록)으로 칭하지 않는다.
 *    의료법 리스크 회피 — 자세한 규칙은 docs/product-vision.md "용어 규칙".
 *
 * 레이아웃: 안내 박스는 흐린 영역(max-h) 안에 absolute로 가두고, 흐린 영역엔
 *    min-h를 줘서 콘텐츠가 짧아도 박스가 밖으로 넘쳐 겹치지 않게 했다.
 *    가로 폭 흔들림은 globals.css `scrollbar-gutter: stable` 로 잡는다.
 */
export function PatientShield({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <section>
      {/* 펴진 상태 안내 바 — 바 전체를 누르면 다시 가리기 */}
      {revealed && (
        <button
          type="button"
          onClick={() => setRevealed(false)}
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100"
        >
          <span className="flex items-center gap-2 text-xs font-medium text-amber-700 break-keep">
            <ShieldIcon className="size-4 shrink-0" />
            상담 기록 표시 중 — 눌러서 다시 가리기 (환자가 화면을 볼 땐 가려주세요)
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-700">
            <EyeOffIcon className="size-3.5" />
            가리기
          </span>
        </button>
      )}

      {/* 콘텐츠 — 가린 상태엔 흐린 미리보기 위에 작은 안내 박스 */}
      <div className={revealed ? "flex flex-col gap-8" : "relative min-h-48"}>
        <div
          className={
            revealed
              ? "flex flex-col gap-8"
              : "flex max-h-96 select-none flex-col gap-8 overflow-hidden opacity-40 blur-[7px] pointer-events-none"
          }
          aria-hidden={!revealed}
        >
          {children}
        </div>

        {!revealed && (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            aria-label="가려진 상담 기록 펴기"
            className="absolute inset-0 flex cursor-pointer items-center justify-center p-4"
          >
            <span className="flex flex-col items-center gap-2 rounded-2xl border border-sky-100 bg-white/90 px-6 py-4 text-center shadow-lg shadow-sky-100/50 backdrop-blur-sm transition hover:bg-white">
              <ShieldIcon className="size-6 text-sky-500" />
              <span className="block">
                <span className="block text-sm font-bold text-slate-900">환자 대면 화면</span>
                <span className="mt-0.5 block text-xs text-slate-500 break-keep">
                  상담 기록은 가려져 있어요 · 눌러서 펴기
                </span>
              </span>
            </span>
          </button>
        )}
      </div>
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

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z" />
      <path d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
    </svg>
  );
}
