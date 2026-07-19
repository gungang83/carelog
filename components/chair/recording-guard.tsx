"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useChairContext, DRAFT_CHAIR_KEY } from "@/components/chair/chair-provider";
import { getConsultSettings } from "@/app/actions/consult-settings";
import {
  DEFAULT_CONSULT_SETTINGS,
  type ConsultSettings,
} from "@/lib/consult-settings";

// spec 027 상담 세션 안전망(레이아웃 상시 마운트) —
//  ① 전역 플로팅 필: 어느 페이지에서든 "상담중(녹음중)" 표시 + 경과·무활동 시간 + 탭하면 복귀
//  ② 방치 감시: 활동(입력 이벤트 ∪ 마이크 음성 RMS) 없음 idle분 → 경고(모달·비프·OS알림)
//     → grace분 무응답 → 등록된 '종료 및 저장' 자동 실행(runAutoFinalize)
//  ③ 전역 beforeunload · 탭 제목 🔴 · (지원 시) Document PiP 항상-위 미니창

const TICK_MS = 1000;
const VOICE_CHECK_MS = 2000;
const VOICE_RMS_THRESHOLD = 12; // 0~128 편차 — 보수적(속삭임 이하 무시)
const IDLE_SHOW_MS = 2 * 60_000; // 무활동 표시는 2분부터

type DocPiPWindow = Window & { __label?: HTMLElement };
type WindowWithPiP = Window & {
  documentPictureInPicture?: {
    requestWindow: (opts?: { width?: number; height?: number }) => Promise<DocPiPWindow>;
  };
};

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// 가드 자체 오류가 앱을 무너뜨리지 않게 격리 — 안전망이 사고 원인이 되면 안 된다.
class GuardBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function RecordingGuard() {
  return (
    <GuardBoundary>
      <RecordingGuardInner />
    </GuardBoundary>
  );
}

function RecordingGuardInner() {
  const {
    chairs,
    activeRecordingKeys,
    getChairStatus,
    getStartedAt,
    getStream,
    openOverlay,
    runAutoFinalize,
  } = useChairContext();

  const [settings, setSettings] = useState<ConsultSettings>(DEFAULT_CONSULT_SETTINGS);
  const [now, setNow] = useState(() => Date.now());
  const [warnDeadline, setWarnDeadline] = useState<number | null>(null); // 경고 중이면 자동종료 시각
  const [notice, setNotice] = useState(""); // 자동 종료 등 일회성 안내
  const lastActivityRef = useRef(Date.now());
  const warnRef = useRef<number | null>(null);
  warnRef.current = warnDeadline;
  const pipRef = useRef<DocPiPWindow | null>(null);
  const origTitleRef = useRef<string | null>(null);

  const active = activeRecordingKeys;
  const isActive = active.length > 0;
  const primaryKey = active[0] ?? null;

  const sessionLabel = useCallback(
    (key: string) =>
      key === DRAFT_CHAIR_KEY ? "상담보드" : (chairs.find((c) => c.id === key)?.name ?? "체어"),
    [chairs],
  );

  // 기관 설정 로드(실패 시 기본값)
  useEffect(() => {
    getConsultSettings().then(setSettings).catch(() => {});
  }, []);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // 활동 = 사람이 있다 → 경고 자동 해제(은행식 '계속하기'와 동일 효과)
    if (warnRef.current) setWarnDeadline(null);
  }, []);

  // ── 활동 신호 1: 입력 이벤트(스로틀) ──────────────────────────
  useEffect(() => {
    if (!isActive) return;
    let lastMove = 0;
    const onMove = () => {
      const t = Date.now();
      if (t - lastMove > 3000) {
        lastMove = t;
        resetActivity();
      }
    };
    const onAct = () => resetActivity();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onAct, { passive: true });
    window.addEventListener("keydown", onAct);
    window.addEventListener("touchstart", onAct, { passive: true });
    window.addEventListener("wheel", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onAct);
      window.removeEventListener("keydown", onAct);
      window.removeEventListener("touchstart", onAct);
      window.removeEventListener("wheel", onMove);
    };
  }, [isActive, resetActivity]);

  // ── 활동 신호 2: 마이크 음성 활동(RMS) — 대화 중 방치 오판 방지 ──
  const activeJoined = active.join(",");
  useEffect(() => {
    if (!isActive || !settings.voice_detect) return;
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      return; // 오디오 분석 불가 — 입력 이벤트 신호만으로 동작
    }
    const analysers: AnalyserNode[] = [];
    for (const key of activeJoined.split(",").filter(Boolean)) {
      const stream = getStream(key);
      if (!stream) continue;
      try {
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an); // 분석만 — 출력에 연결하지 않음(에코 없음)
        analysers.push(an);
      } catch {
        // 스트림 소멸 등 — 무시(입력 이벤트 신호는 계속 동작)
      }
    }
    const buf = new Uint8Array(512);
    const timer = setInterval(() => {
      for (const an of analysers) {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const d = Math.abs(buf[i] - 128);
          if (d > peak) peak = d;
        }
        if (peak >= VOICE_RMS_THRESHOLD) {
          resetActivity();
          break;
        }
      }
    }, VOICE_CHECK_MS);
    return () => {
      clearInterval(timer);
      ctx.close().catch(() => {});
    };
  }, [isActive, activeJoined, settings.voice_detect, getStream, resetActivity]);

  // ── 1초 틱: 경과·무활동 갱신 + 방치 판정 + grace 만료 처리 ──────
  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [isActive]);

  const idleMs = now - lastActivityRef.current;

  useEffect(() => {
    if (!isActive || !primaryKey) return;
    // 일시정지 중엔 방치 감시 제외(의도된 멈춤) — 표시는 유지
    const recordingNow = active.some((k) => getChairStatus(k) === "recording");
    if (!recordingNow) return;

    if (warnDeadline === null && idleMs >= settings.idle_minutes * 60_000) {
      setWarnDeadline(Date.now() + settings.grace_minutes * 60_000);
      beep();
      notifyOS(
        "상담이 계속 녹음되고 있어요",
        `${settings.idle_minutes}분간 활동이 없어요. ${settings.grace_minutes}분 내 응답이 없으면 자동 저장됩니다.`,
      );
    } else if (warnDeadline !== null && now >= warnDeadline) {
      setWarnDeadline(null);
      const done = runAutoFinalize(primaryKey);
      setNotice(
        done
          ? "활동이 없어 상담을 자동으로 종료하고 저장했어요."
          : "활동이 없지만 이 세션은 자동 저장 대상이 아니에요 — 화면에서 직접 종료해 주세요.",
      );
      setTimeout(() => setNotice(""), 12_000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // ── 전역 beforeunload(탭 닫기 경고) — 세션 있는 동안 항상 ────────
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isActive]);

  // ── 탭 제목 🔴 ──────────────────────────────────────────────
  const startedAt = primaryKey ? getStartedAt(primaryKey) : null;
  const elapsed = startedAt ? fmtElapsed(now - startedAt) : "";
  useEffect(() => {
    if (isActive) {
      if (origTitleRef.current === null) origTitleRef.current = document.title;
      document.title = `🔴 녹음중 ${elapsed} — Carelog`;
    } else if (origTitleRef.current !== null) {
      document.title = origTitleRef.current;
      origTitleRef.current = null;
    }
  }, [isActive, elapsed]);

  // ── Document PiP(항상-위 미니창) — 지원 브라우저에서만 ───────────
  const pipSupported = useMemo(
    () => typeof window !== "undefined" && "documentPictureInPicture" in window,
    [],
  );
  const pipText = `🔴 ${primaryKey ? sessionLabel(primaryKey) : ""} 상담중 ${elapsed}${
    idleMs >= IDLE_SHOW_MS ? ` · 활동 없음 ${Math.floor(idleMs / 60_000)}분` : ""
  }`;
  useEffect(() => {
    const pip = pipRef.current;
    if (!pip) return;
    if (!isActive) {
      pip.close();
      pipRef.current = null;
      return;
    }
    if (pip.__label) {
      pip.__label.textContent = pipText;
      pip.__label.style.background = warnDeadline ? "#b45309" : "#0f172a";
    }
  }, [isActive, pipText, warnDeadline]);

  const openPiP = async () => {
    try {
      const w = await (window as WindowWithPiP).documentPictureInPicture!.requestWindow({
        width: 280,
        height: 64,
      });
      const label = w.document.createElement("div");
      label.textContent = pipText;
      Object.assign(label.style, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        fontWeight: "600",
        color: "#fff",
        background: "#0f172a",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 10px",
        cursor: "pointer",
      });
      label.onclick = () => {
        window.focus();
        if (primaryKey) openOverlay(primaryKey);
      };
      w.document.body.style.margin = "0";
      w.document.body.appendChild(label);
      w.__label = label;
      w.addEventListener("pagehide", () => {
        pipRef.current = null;
      });
      pipRef.current = w;
    } catch {
      // 사용자 거부/미지원 — 무시
    }
  };

  if (!isActive && !notice) return null;

  const warned = warnDeadline !== null;
  const graceLeft = warned ? Math.max(0, warnDeadline - now) : 0;

  return createPortal(
    <>
      {/* 플로팅 필 */}
      {isActive && primaryKey && (
        <button
          type="button"
          onClick={() => openOverlay(primaryKey)}
          className={`fixed bottom-4 right-4 z-[95] flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition ${
            warned ? "animate-pulse bg-amber-600 hover:bg-amber-700" : "bg-slate-900 hover:bg-slate-800"
          }`}
          title="탭하면 상담 화면으로 돌아갑니다"
        >
          <span className={`size-2.5 rounded-full ${warned ? "bg-white" : "animate-pulse bg-red-500"}`} />
          <span>
            {sessionLabel(primaryKey)} 상담중{" "}
            {getChairStatus(primaryKey) === "paused" ? "(일시정지)" : "(녹음중)"} {elapsed}
          </span>
          {active.length > 1 && (
            <span className="rounded-full bg-white/20 px-1.5 text-xs">+{active.length - 1}</span>
          )}
          {idleMs >= IDLE_SHOW_MS && !warned && (
            <span className="text-xs font-normal text-slate-300">
              · 활동 없음 {Math.floor(idleMs / 60_000)}분
            </span>
          )}
          {warned && <span className="text-xs">· {fmtElapsed(graceLeft)} 후 자동 저장</span>}
        </button>
      )}
      {/* PiP 승격 버튼(지원 시, 필 왼쪽) */}
      {isActive && pipSupported && !pipRef.current && (
        <button
          type="button"
          onClick={openPiP}
          className="fixed bottom-4 right-4 z-[95] -translate-x-[calc(100%+120px)] rounded-full border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-600 shadow-lg transition hover:bg-slate-50"
          title="다른 프로그램 위에 항상 떠 있는 미니창으로 표시 (데스크톱 크롬)"
        >
          ⧉ 항상 위
        </button>
      )}

      {/* 일회성 안내(자동 종료 등) */}
      {notice && (
        <div className="fixed bottom-20 right-4 z-[95] max-w-xs rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          {notice}
        </div>
      )}

      {/* 방치 경고 모달 */}
      {warned && primaryKey && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-center shadow-xl">
            <p className="text-3xl">⏰</p>
            <div>
              <p className="text-base font-bold text-slate-900">상담이 계속 녹음되고 있어요</p>
              <p className="mt-1 text-sm text-slate-500">
                {settings.idle_minutes}분간 활동이 없었어요. 계속하시겠어요?
              </p>
              <p className="mt-2 text-lg font-bold text-amber-600">
                {fmtElapsed(graceLeft)} 후 자동으로 종료·저장됩니다
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setWarnDeadline(null);
                  const done = runAutoFinalize(primaryKey);
                  if (!done) openOverlay(primaryKey);
                }}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                종료 및 저장
              </button>
              <button
                type="button"
                onClick={resetActivity}
                className="flex-1 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                상담 계속하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

/** 경고 알림음 — 오실레이터 2음(다운로드·의존성 없음) */
function beep() {
  try {
    const ctx = new AudioContext();
    const play = (freq: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.18);
    };
    play(880, 0);
    play(660, 0.25);
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    // 오디오 불가 — 무시
  }
}

/** OS 로컬 알림(권한이 이미 있을 때만 — 흐름 중 권한 팝업을 띄우지 않는다) */
function notifyOS(title: string, body: string) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, tag: "carelog-recording-guard" });
    }
  } catch {
    // 미지원 — 무시
  }
}
