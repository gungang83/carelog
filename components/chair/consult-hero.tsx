"use client";

import {
  useChairContext,
  DRAFT_CHAIR_KEY,
} from "@/components/chair/chair-provider";
import { EngineSelector } from "@/components/chair/engine-selector";

/**
 * 홈 최상단 히어로 — 상담 기록의 진입점(record-first).
 *
 * "상담 기록 시작"을 누르면 체어·참여자 선택 없이 **즉시 녹음을 시작**하고
 * 상담보드(ConsultationBoard)를 연다. 체어·참여자·본문·그림·처방은 녹음이
 * 도는 동안/끝난 뒤 보드 안에서 채운다(spec 008 US1).
 *
 * 실험실 워크스페이스는 시작 버튼이 즉시 녹음을 켜므로, 녹음 엔진은 반드시
 * **버튼을 누르기 전 여기서** 고른다(보드 idle을 못 보기 때문).
 */
export function ConsultHero() {
  const { openOverlay, startRecording, labEnabled, engine, setEngine } =
    useChairContext();

  // 클릭 제스처 안에서 보드를 열고 같은 제스처로 녹음을 시작(getUserMedia 제스처 보존).
  const handleStart = () => {
    openOverlay(DRAFT_CHAIR_KEY);
    void startRecording(DRAFT_CHAIR_KEY);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-white p-7 shadow-sm sm:p-9">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sm font-bold text-sky-700">
          C
        </div>
        <span className="text-base font-semibold text-slate-900">Carelog</span>
      </div>

      <h1 className="mt-5 text-[1.7rem] font-bold leading-tight tracking-tight text-slate-900 break-keep sm:text-[2.15rem]">
        오늘 나눈 상담, 빠짐없이 남겨{" "}
        <span className="text-sky-600">환자분께 전해드려요</span>
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-500 break-keep">
        버튼을 누르면 바로 녹음이 시작돼요. 오늘 나눈 이야기를 정확히 남기고,
        정리된 상담 기록은 환자분도 직접 받아 보관하실 수 있어요.
      </p>

      {/* 실험실 — 녹음 엔진 선택. 시작 버튼이 즉시 녹음을 켜므로 반드시 버튼 위(시작 전)에 둔다. */}
      {labEnabled && (
        <EngineSelector engine={engine} onChange={setEngine} className="mt-6" />
      )}

      <button
        type="button"
        onClick={handleStart}
        className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-sky-600 px-6 py-4 text-base font-semibold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-700 active:scale-[0.99] sm:w-auto"
      >
        <MicIcon className="size-5 shrink-0" />
        상담 기록 시작
      </button>
    </section>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V4Z" />
      <path
        fillRule="evenodd"
        d="M5.5 10.5a.75.75 0 0 0-1.5 0 6 6 0 0 0 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.046A6 6 0 0 0 15.5 10.5a.75.75 0 0 0-1.5 0 4.5 4.5 0 0 1-9 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
