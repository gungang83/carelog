"use client";

import {
  useChairContext,
  DRAFT_CHAIR_KEY,
} from "@/components/chair/chair-provider";
import { CREDIT_LOW_THRESHOLD } from "@/lib/transcribe/engines";

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
  const { openOverlay, startRecording, creditBalance } = useChairContext();

  // 클릭 제스처 안에서 보드를 열고 같은 제스처로 녹음을 시작(getUserMedia 제스처 보존).
  const handleStart = () => {
    openOverlay(DRAFT_CHAIR_KEY);
    void startRecording(DRAFT_CHAIR_KEY);
  };

  return (
    // 히어로 전체 가운데 정렬(대표 지시) — 로고부터 버튼까지 세로 축 중앙
    <section className="flex flex-col items-center overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-white p-7 text-center shadow-sm sm:p-9">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sm font-bold text-sky-700">
          C
        </div>
        <span className="text-base font-semibold text-slate-900">Carelog</span>
      </div>

      <h1 className="mt-5 text-[1.7rem] font-bold leading-tight tracking-tight text-slate-900 break-keep sm:text-[2.15rem]">
        오늘 나눈 상담,
        <br />
        정확하게 정리하고
        <br />
        <span className="text-sky-600">환자분께 전해드려요</span>
      </h1>
      {/* 강제 줄바꿈 없이 컨테이너 폭에 따라 자연 줄바꿈(반응형) */}
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-500 break-keep">
        버튼을 누르면 바로 녹음이 시작돼요. 오늘 나눈 이야기를 빠짐없이 남기고, 정리된 상담
        기록은 환자분도 직접 받아 보관하실 수 있어요.
      </p>

      {/* spec 032 — 엔진 선택 UI 제거(실사용 93%가 기본). 파이프라인은 자동:
          용어 보정 상시 + 3분↑ 서버 위임. 실험실 엔진 실험은 보드 idle 픽커('녹음 없이 기록만' 경유)로. */}
      {creditBalance <= 0 ? (
        <p className="mt-5 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 break-keep">
          크레딧이 소진되었습니다 — 상담 기록은 계속 남길 수 있지만, 관리자에게 충전을 요청해 주세요.
        </p>
      ) : creditBalance <= CREDIT_LOW_THRESHOLD ? (
        <p className="mt-5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 break-keep">
          크레딧 잔액 {creditBalance} — 곧 소진됩니다. 충전을 준비해 주세요.
        </p>
      ) : null}

      <div className="mt-6 flex w-full flex-col items-stretch justify-center gap-2 sm:w-auto sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleStart}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-sky-600 px-6 py-4 text-base font-semibold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-700 active:scale-[0.99] sm:w-auto"
        >
          <MicIcon className="size-5 shrink-0" />
          상담 기록 시작
        </button>
        {/* spec 027 ③ — 녹음 없이 기록만: 보드를 idle로 연다(마이크 미사용). */}
        <button
          type="button"
          onClick={() => openOverlay(DRAFT_CHAIR_KEY)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 sm:w-auto sm:py-3.5"
          title="마이크 없이 상담보드만 열어 기록·자료·견적을 작성합니다 (보드 안에서 '녹음 시작'도 가능)"
        >
          ✏️ 녹음 없이 기록만
        </button>
      </div>
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
