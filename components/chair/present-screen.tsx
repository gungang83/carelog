"use client";

import { useEffect, useState } from "react";

/**
 * 체어 모니터 환자용 설명화면 (Living Consult 온보딩 — 카드229).
 *
 * 환자가 진료실에서 바라보는 화면. "녹음"이라는 표현 대신 "함께 이야기 나눈다 ·
 * 듣고 정리한다"는 따뜻한 톤으로, 진료를 기록으로 남겨 병원이 환자에게
 * 전달해 준다는 가치를 전한다. '삭제' 같은 표현은 쓰지 않는다(병원이 보관).
 *
 * 흐름: 설명(idle) → 선택(select: 체어·담당의사·담당자, 모두 선택 안 해도 진행)
 *      → 함께 이야기(listening) → 요약·완료(summary)  / 또는 거절(declined)
 *
 * MVP 범위: 화면·상태 전이·요약 시각화를 구현. 실제 음성 듣기·AI 요약·임시저장은
 * 006 체어 즉시기록 파이프라인 재사용, 직원기기 ↔ 모니터는 Supabase Realtime으로
 * 후속 연결한다. (docs/living-consult-onboarding.md §3)
 */

type Phase = "idle" | "select" | "listening" | "summary" | "declined";

const VALUE_POINTS = [
  "상담 내용을 안전하게 듣고 정리해 드려요",
  "요약을 진료기록으로 정리해 보내드려요",
  "기록은 병원과 환자분만 볼 수 있어요",
];

// MVP 샘플 — 실제 목록은 기관 직원/체어 데이터(006·institution_members)에서 채운다.
const DOCTORS = ["김민수 원장", "이서연 원장", "박지훈 원장"];
const STAFF = ["최은정 실장", "정다은 위생사", "한지우 위생사"];

export default function PresentScreen({ chairId }: { chairId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);

  const [chair, setChair] = useState<string>(chairId);
  const [doctor, setDoctor] = useState<string | null>(null);
  const [staff, setStaff] = useState<string | null>(null);

  // 이야기 나누는 동안 경과 시간 (환자가 진행 상태를 인지 — 투명성)
  useEffect(() => {
    if (phase !== "listening") return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const reset = () => {
    setDoctor(null);
    setStaff(null);
    setChair(chairId);
    setPhase("idle");
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl">
        {/* ── 설명화면 ── */}
        {phase === "idle" && (
          <Card>
            <Brand chair={chair} doctor={doctor} staff={staff} />
            <h1 className="mt-8 text-center text-3xl font-bold leading-snug tracking-tight text-slate-900 sm:text-[2.6rem]">
              오늘 진료, 기록으로 남겨서
              <br />
              <span className="text-sky-600">저희가 전달해드릴게요</span>
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
              onClick={() => setPhase("select")}
              className="mt-12 flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-sky-600 text-xl font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.99]"
            >
              <span className="text-2xl">💬</span> 상담 함께 시작하기
            </button>
            <button
              onClick={() => setPhase("declined")}
              className="mx-auto mt-5 block text-sm font-medium text-slate-400 underline-offset-4 hover:text-slate-600 hover:underline"
            >
              오늘은 기록 없이 진료할게요
            </button>
          </Card>
        )}

        {/* ── 선택(체어·담당의사·담당자, 모두 선택 안 해도 진행) ── */}
        {phase === "select" && (
          <Card>
            <Brand chair={chair} doctor={doctor} staff={staff} />
            <h2 className="mt-8 text-center text-2xl font-bold text-slate-900">
              누구와 함께하나요?
            </h2>
            <p className="mt-2 text-center text-sm text-slate-400">
              선택하지 않아도 바로 시작할 수 있어요
            </p>

            <ChipGroup
              label="체어"
              options={[chairId, "A", "B", "C"].filter(
                (v, i, a) => a.indexOf(v) === i,
              )}
              value={chair}
              onChange={(v) => setChair(v ?? chairId)}
            />
            <ChipGroup
              label="담당 의사"
              options={DOCTORS}
              value={doctor}
              onChange={setDoctor}
            />
            <ChipGroup
              label="담당자"
              options={STAFF}
              value={staff}
              onChange={setStaff}
            />

            <button
              onClick={() => setPhase("listening")}
              className="mt-10 flex h-16 w-full items-center justify-center rounded-2xl bg-sky-600 text-xl font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.99]"
            >
              시작하기
            </button>
            <button
              onClick={() => setPhase("idle")}
              className="mx-auto mt-5 block text-sm font-medium text-slate-400 hover:text-slate-600"
            >
              뒤로
            </button>
          </Card>
        )}

        {/* ── 함께 이야기 나누는 중 (녹음 X — 따뜻한 톤) ── */}
        {phase === "listening" && (
          <Card>
            <Brand chair={chair} doctor={doctor} staff={staff} />
            <div className="mt-10 flex flex-col items-center">
              <Listening />
              <p className="mt-7 text-3xl font-bold text-slate-900">
                같이 이야기 나누고 있어요
              </p>
              <p className="mt-3 text-center text-lg text-slate-500">
                편하게 말씀해 주세요
                <br className="sm:hidden" /> · 저희가 듣고 정리하고 있어요
              </p>
              <p className="mt-8 font-mono text-5xl font-semibold tracking-wider text-sky-600 tabular-nums">
                {formatElapsed(elapsed)}
              </p>
            </div>
            <button
              onClick={() => setPhase("summary")}
              className="mt-12 flex h-16 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-xl font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]"
            >
              이야기 마치기
            </button>
          </Card>
        )}

        {/* ── 요약·완료 (시각화 + 진료기록 받아보기 유도) ── */}
        {phase === "summary" && (
          <Card>
            <Brand chair={chair} doctor={doctor} staff={staff} />
            <div className="mt-7 flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                상담 요약 미리보기
              </span>
              <h1 className="mt-4 text-3xl font-bold text-slate-900">
                오늘 상담, 이렇게 정리했어요
              </h1>
            </div>

            <SummaryPreview doctor={doctor} />

            <div className="mt-6 rounded-2xl bg-sky-50 p-4 text-center">
              <p className="text-sm leading-relaxed text-sky-800">
                담당 선생님이 한 번 더 <strong>검토·정리</strong>해서
                <br />
                정식 <strong>진료기록</strong>으로 보내드려요
              </p>
            </div>

            <button
              onClick={reset}
              className="mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 text-xl font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.99]"
            >
              📩 내 진료기록 받아보기
            </button>
            <button
              onClick={reset}
              className="mx-auto mt-5 block text-sm font-medium text-slate-400 hover:text-slate-600"
            >
              처음으로
            </button>
          </Card>
        )}

        {/* ── 거절 ── */}
        {phase === "declined" && (
          <Card>
            <Brand chair={chair} doctor={doctor} staff={staff} />
            <div className="mt-10 flex flex-col items-center text-center">
              <h1 className="text-3xl font-bold text-slate-900">
                네, 기록 없이 진행할게요
              </h1>
              <p className="mt-4 text-lg text-slate-500">
                편하게 진료 받으세요 🙂
              </p>
            </div>
            <button
              onClick={reset}
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

function Brand({
  chair,
  doctor,
  staff,
}: {
  chair: string;
  doctor: string | null;
  staff: string | null;
}) {
  const tags = [`체어 · ${chair}`, doctor, staff].filter(Boolean) as string[];
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sm font-bold text-sky-700">
          C
        </div>
        <span className="text-base font-semibold text-slate-900">Carelog</span>
      </div>
      <div className="flex flex-wrap justify-end gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="mt-6">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(active ? null : opt)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-sky-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Listening() {
  // 부드러운 "듣고 있어요" 표시 — 빨간 녹음점 대신 sky 톤 파동 + 사운드 바
  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <span className="absolute h-full w-full animate-ping rounded-full bg-sky-300 opacity-40" />
      <span className="absolute h-16 w-16 rounded-full bg-sky-100" />
      <div className="relative flex items-end gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="w-1.5 animate-pulse rounded-full bg-sky-500"
            style={{
              height: `${[14, 26, 36, 22, 16][i]}px`,
              animationDelay: `${i * 120}ms`,
              animationDuration: "900ms",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryPreview({ doctor }: { doctor: string | null }) {
  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
      <SummaryRow
        icon="🗣️"
        title="오늘 나눈 이야기"
        body="오른쪽 어금니 시린 증상 상담, 정기 검진 진행"
        tone="sky"
      />
      <SummaryRow
        icon="🦷"
        title="진료·처방"
        chips={["충치 초기 1곳", "스케일링", "불소 도포 권장"]}
        tone="emerald"
      />
      <SummaryRow
        icon="📅"
        title="다음 방문"
        body="2주 후 경과 확인 · 예약 안내 예정"
        tone="violet"
      />
      <p className="pt-1 text-center text-xs text-slate-400">
        {doctor ? `${doctor} 검토 예정` : "담당 선생님 검토 예정"} · 실제 요약은
        상담 내용에 따라 달라져요
      </p>
    </div>
  );
}

function SummaryRow({
  icon,
  title,
  body,
  chips,
  tone,
}: {
  icon: string;
  title: string;
  body?: string;
  chips?: string[];
  tone: "sky" | "emerald" | "violet";
}) {
  const toneMap = {
    sky: "bg-sky-100 text-sky-700",
    emerald: "bg-emerald-100 text-emerald-700",
    violet: "bg-violet-100 text-violet-700",
  } as const;
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {body && <p className="mt-1 text-sm text-slate-500">{body}</p>}
        {chips && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${toneMap[tone]}`}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
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
