"use client";

import {
  useChairContext,
  DRAFT_CHAIR_KEY,
} from "@/components/chair/chair-provider";

/**
 * 홈 최상단 히어로 — 진료 기록의 진입점(record-first).
 *
 * "상담 기록 시작"을 누르면 체어·참여자 선택 없이 **즉시 녹음을 시작**하고
 * 상담보드(ConsultationBoard)를 연다. 체어·참여자·본문·그림·처방은 녹음이
 * 도는 동안/끝난 뒤 보드 안에서 채운다(spec 008 US1).
 */
export function ConsultHero() {
  const { openOverlay, startRecording } = useChairContext();

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

      <h1 className="mt-5 text-2xl font-bold leading-snug tracking-tight text-slate-900 break-keep sm:text-[1.85rem]">
        오늘 진료, 기록으로 남겨서{" "}
        <span className="text-sky-600">환자에게 전달해요</span>
      </h1>
      <p className="mt-2.5 max-w-md text-[15px] leading-relaxed text-slate-500 break-keep">
        버튼을 누르면 바로 녹음이 시작돼요. 체어·참여자는 녹음하면서 골라도 되고,
        내용은 AI가 정리합니다. 검토 후 보내면 환자가 직접 받아 보관해요.
      </p>

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
