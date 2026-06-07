"use client";

import { useEffect, useState } from "react";

/**
 * 체어 모니터 환자용 설명화면 (Living Consult 온보딩 — 카드229).
 *
 * 환자가 진료실에서 바라보는 화면. 진료 중 케어로그 진입 부담을 줄이기 위해
 * "오늘 진료를 기록으로 남겨드릴게요"를 보여주고, 한 번의 동작으로 기록을 시작한다.
 *
 * MVP 범위: 화면·상태 전이(설명 → 기록중 → 완료 / 거절)를 시각적으로 구현.
 * 실제 녹음·AI 변환·임시저장은 006 체어 즉시기록 파이프라인 재사용,
 * 직원 기기 ↔ 모니터 상태 동기화는 Supabase Realtime으로 후속 연결한다.
 * (docs/living-consult-onboarding.md §3 참조)
 */

type Phase = "idle" | "recording" | "done" | "declined";

const VALUE_POINTS = [
  "상담 내용을 음성으로 안전하게 기록해요",
  "진료 후 '내 진료기록'으로 다시 보실 수 있어요",
  "기록은 병원과 환자분만 볼 수 있어요",
];

export default function PresentScreen({ chairId }: { chairId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);

  // 기록 중 경과 시간 (환자가 진행 상태를 인지 — 투명성)
  useEffect(() => {
    if (phase !== "recording") return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl">
        {phase === "idle" && (
          <Card>
            <Brand chairId={chairId} />
            <h1 className="mt-8 text-center text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              오늘 진료,
              <br />
              <span className="text-sky-600">기록으로 남겨드릴게요</span>
            </h1>
            <ul className="mx-auto mt-10 max-w-sm space-y-4">
              {VALUE_POINTS.map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <CheckIcon />
                  <span className="text-lg leading-snug text-slate-600">{t}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setPhase("recording")}
              className="mt-12 flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-sky-600 text-xl font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.99]"
            >
              <span className="text-2xl">🎙</span> 빠른 녹음 시작
            </button>
            <button
              onClick={() => setPhase("declined")}
              className="mx-auto mt-5 block text-sm font-medium text-slate-400 underline-offset-4 hover:text-slate-600 hover:underline"
            >
              오늘은 기록 없이 진료할게요
            </button>
          </Card>
        )}

        {phase === "recording" && (
          <Card>
            <Brand chairId={chairId} />
            <div className="mt-10 flex flex-col items-center">
              <span className="relative flex h-5 w-5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-5 w-5 rounded-full bg-red-500" />
              </span>
              <p className="mt-6 text-3xl font-bold text-slate-900">기록 중</p>
              <p className="mt-3 text-lg text-slate-500">
                상담 내용을 안전하게 기록하고 있어요
              </p>
              <p className="mt-8 font-mono text-5xl font-semibold tracking-wider text-sky-600 tabular-nums">
                {formatElapsed(elapsed)}
              </p>
            </div>
            <button
              onClick={() => setPhase("done")}
              className="mt-12 flex h-16 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-xl font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]"
            >
              기록 멈추기
            </button>
          </Card>
        )}

        {phase === "done" && (
          <Card>
            <Brand chairId={chairId} />
            <div className="mt-10 flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                <svg
                  className="h-10 w-10 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
              </div>
              <h1 className="mt-8 text-4xl font-bold text-slate-900">
                기록 완료
              </h1>
              <p className="mt-4 text-lg text-slate-500">
                진료 후 휴대폰으로도 받아보실 수 있어요
              </p>
            </div>
            <button
              onClick={() => setPhase("idle")}
              className="mt-12 flex h-14 w-full items-center justify-center rounded-2xl bg-sky-600 text-lg font-semibold text-white shadow-sm transition hover:bg-sky-700"
            >
              내 진료기록 받아보기
            </button>
            <button
              onClick={() => setPhase("idle")}
              className="mx-auto mt-5 block text-sm font-medium text-slate-400 hover:text-slate-600"
            >
              처음으로
            </button>
          </Card>
        )}

        {phase === "declined" && (
          <Card>
            <Brand chairId={chairId} />
            <div className="mt-10 flex flex-col items-center text-center">
              <h1 className="text-3xl font-bold text-slate-900">
                네, 기록 없이 진행할게요
              </h1>
              <p className="mt-4 text-lg text-slate-500">
                편하게 진료 받으세요 🙂
              </p>
            </div>
            <button
              onClick={() => setPhase("idle")}
              className="mx-auto mt-12 block text-sm font-medium text-slate-400 hover:text-slate-600"
            >
              처음으로
            </button>
          </Card>
        )}
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white/90 p-8 shadow-xl shadow-sky-100/50 backdrop-blur sm:p-12">
      {children}
    </div>
  );
}

function Brand({ chairId }: { chairId: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sm font-bold text-sky-700">
          C
        </div>
        <span className="text-base font-semibold text-slate-900">Carelog</span>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
        체어 · {chairId}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100">
      <svg
        className="h-3.5 w-3.5 text-sky-600"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={3}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    </span>
  );
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
