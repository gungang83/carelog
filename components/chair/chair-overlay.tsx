"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useChairContext } from "@/components/chair/chair-provider";
import {
  transcribeChairAudio,
  saveChairRecord,
  updateChairRecordContent,
} from "@/app/actions/chairs";
import { PrescriptionPicker } from "@/components/chair/prescription-picker";
import { ChairPatientSearch } from "@/components/chair/chair-patient-search";
import { maskName } from "@/lib/mask-name";
import { markLocalSave } from "@/lib/realtime/local-echo";

export function ChairOverlay() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(<OverlayContent />, document.body);
}

function OverlayContent() {
  const {
    chairs,
    openChairId,
    closeOverlay,
    getChairStatus,
    getParticipants,
    getTranscribedText,
    getSavedConsultationId,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    setTranscriptionResult,
    setSavedConsultationId,
    resetChair,
    refreshUnlinkedCount,
    registerAutoFinalize,
  } = useChairContext();

  const [elapsed, setElapsed] = useState(0);
  const [micError, setMicError] = useState("");
  const [editText, setEditText] = useState("");
  const [prescriptions, setPrescriptions] = useState<string[]>([]);
  const [saveMsg, setSaveMsg] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const chair = chairs.find((c) => c.id === openChairId);
  const rawStatus = openChairId ? getChairStatus(openChairId) : "idle";
  const transcribedText = openChairId ? getTranscribedText(openChairId) : "";
  const savedId = openChairId ? getSavedConsultationId(openChairId) : null;
  const participants = openChairId ? getParticipants(openChairId) : [];

  // has_records from DB alone (no current session text) → treat as idle in overlay
  const status =
    rawStatus === "has_records" && !transcribedText && !editText
      ? "idle"
      : rawStatus;

  // Sync editText when transcription arrives
  useEffect(() => {
    if (transcribedText && editText === "") setEditText(transcribedText);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcribedText]);

  // Reset per-session state when overlay opens to a fresh chair
  useEffect(() => {
    if (!openChairId) {
      setElapsed(0);
      setMicError("");
      setSaveMsg("");
      setShowLink(false);
    }
    if (openChairId && rawStatus === "idle") {
      setEditText("");
      setPrescriptions([]);
      setSaveMsg("");
      setShowLink(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChairId, rawStatus]);

  // Timer for recording — 일시정지(paused)는 멈추되 경과시간은 유지.
  useEffect(() => {
    if (status === "recording") {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else if (status === "paused") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // spec 027 — 방치 자동 종료(오버레이 세션) 등록. ⚠️ 훅은 아래 조기 return보다 반드시 위에(호출 순서 고정).
  const stopRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!openChairId || status !== "recording") return;
    const key = openChairId;
    registerAutoFinalize(key, () => stopRef.current());
    return () => registerAutoFinalize(key, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChairId, status]);

  if (!openChairId || !chair) return null;

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleStartRecording = async () => {
    setMicError("");
    const result = await startRecording(openChairId);
    if (!result.ok) setMicError(result.error ?? "녹음 시작 실패");
  };

  const handleStopRecording = () => {
    if (!openChairId) return;
    const secs = elapsed; // 상태 전환 전에 녹음 길이 포착
    const blob = stopRecording(openChairId);
    const sizeKB = blob ? Math.round((blob.size / 1024) * 10) / 10 : 0;
    // 진단 로그(연결 가능한 환경에서 확인용)
    console.log("[chair] 녹음 중지", { secs, bytes: blob?.size ?? 0 });

    // 빈/극소 녹음 = iOS 화면잠금·백그라운드로 MediaRecorder가 정지된 전형적 케이스.
    // 전사·저장으로 넘어가면 어차피 실패하므로 여기서 명확히 잡아 안내한다(원인 가시화).
    if (!blob || blob.size < 1024) {
      resetChair(openChairId);
      setMicError(
        `녹음이 비어 있어요 (녹음 ${secs}초 · ${sizeKB}KB). 화면이 잠기거나 다른 앱으로 전환되면 녹음이 끊깁니다. 화면을 켠 채로 다시 녹음해 주세요.`,
      );
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      // 이 경로(체어 즉시기록 오버레이)는 엔진 미선택 → 서버 기본 'basic'(runs 1개).
      const result = await transcribeChairAudio(formData);
      console.log("[chair] 전사 결과", result.ok ? "ok" : result.message);
      if (result.ok) {
        const run = result.runs[0];
        setTranscriptionResult(openChairId, run.summary);
        setEditText(run.summary);
      } else {
        setMicError(`전사 실패 (녹음 ${secs}초 · ${sizeKB}KB): ${result.message}`);
        setTranscriptionResult(openChairId, "");
        setEditText("");
      }
    });
  };

  const handleSave = () => {
    if (!openChairId) return;
    setSaveMsg("");
    startTransition(async () => {
      if (savedId) {
        const result = await updateChairRecordContent({
          consultationId: savedId,
          content: editText,
          prescriptions,
        });
        if (result.ok) {
          setSaveMsg("수정 저장됨 ✓");
          await refreshUnlinkedCount(openChairId);
        } else {
          setSaveMsg(result.message);
        }
      } else {
        const result = await saveChairRecord({
          chairId: openChairId,
          content: editText,
          prescriptions,
          participants,
        });
        if (result.ok) {
          markLocalSave(result.consultationId);
          setSavedConsultationId(openChairId, result.consultationId);
          setSaveMsg("저장됨 ✓");
          await refreshUnlinkedCount(openChairId);
        } else {
          setSaveMsg(result.message);
        }
      }
    });
  };

  // 가드 자동 종료가 항상 최신 핸들러를 잡도록 렌더마다 갱신(훅 아님 — 조건부 실행 무방)
  stopRef.current = handleStopRecording;

  const handleDiscard = () => {
    if (!openChairId) return;
    resetChair(openChairId);
    setEditText("");
    setPrescriptions([]);
    setSaveMsg("");
    setShowLink(false);
    closeOverlay();
  };

  const handleClose = () => {
    if (status === "recording") setSaveMsg("");
    setShowLink(false);
    closeOverlay();
  };

  const handleLinked = async () => {
    if (!openChairId) return;
    await refreshUnlinkedCount(openChairId);
    setShowLink(false);
    closeOverlay();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${chair.name} 기록`}
        className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-sky-600 text-sm font-bold text-white">
                {chair.name.slice(0, 2)}
              </div>
              <span className="text-sm font-semibold text-slate-800">
                {statusHeading(status)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="닫기"
            >
              <XIcon className="size-5" />
            </button>
          </div>

          {/* 본문 */}
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
            {participants.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-400">참여</span>
                {participants.map((p) => (
                  <span
                    key={p.id}
                    className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"
                  >
                    {maskName(p.name)}
                    {p.role ? ` · ${p.role}` : ""}
                  </span>
                ))}
              </div>
            )}

            {/* ── idle 상태 ── */}
            {status === "idle" && (
              <div className="flex flex-col gap-3">
                {micError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {micError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  <MicIcon className="size-4" />
                  녹음 시작
                </button>
                {micError && (
                  <>
                    <textarea
                      className="min-h-24 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
                      placeholder="텍스트로 직접 입력하세요…"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    {editText && (
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isPending}
                        className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
                      >
                        {isPending ? "저장 중…" : "임시 저장"}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── recording / paused 상태 ── */}
            {(status === "recording" || status === "paused") && (
              <div className="flex flex-col gap-3">
                <div
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                    status === "paused"
                      ? "border-amber-200 bg-amber-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <span
                    className={`inline-block size-2.5 rounded-full ${
                      status === "paused" ? "bg-amber-400" : "animate-pulse bg-red-500"
                    }`}
                  />
                  <span
                    className={`text-sm font-semibold ${
                      status === "paused" ? "text-amber-700" : "text-red-700"
                    }`}
                  >
                    {status === "paused" ? "일시정지" : "녹음 중"} {fmtTime(elapsed)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  오버레이를 닫아도 녹음은 계속됩니다.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      status === "paused"
                        ? resumeRecording(openChairId)
                        : pauseRecording(openChairId)
                    }
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      status === "paused"
                        ? "bg-sky-600 text-white hover:bg-sky-700"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {status === "paused" ? "이어서 녹음" : "일시정지"}
                  </button>
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600"
                  >
                    중지 및 변환
                  </button>
                </div>
              </div>
            )}

            {/* ── processing 상태 ── */}
            {status === "processing" && (
              <div className="flex flex-col items-center gap-3 py-4">
                <span className="inline-block size-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                <p className="text-sm text-slate-600">음성 인식 및 요약 중…</p>
                {micError && <p className="mt-2 text-xs text-red-500">{micError}</p>}
              </div>
            )}

            {/* ── has_records 상태 (전사 완료 후 편집) ── */}
            {status === "has_records" && (
              <div className="flex flex-col gap-4">
                {showLink && savedId ? (
                  <ChairPatientSearch
                    consultationId={savedId}
                    onLinked={handleLinked}
                    onCancel={() => setShowLink(false)}
                  />
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-slate-500">상담 내용</label>
                      <textarea
                        className="min-h-32 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                      />
                    </div>

                    <PrescriptionPicker value={prescriptions} onChange={setPrescriptions} />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isPending || !editText}
                        className="flex-1 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
                      >
                        {isPending ? "저장 중…" : savedId ? "수정 저장" : "임시 저장"}
                      </button>
                      {savedId && (
                        <button
                          type="button"
                          onClick={() => setShowLink(true)}
                          className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                        >
                          환자 연결
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleDiscard}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        버리기
                      </button>
                    </div>

                    {saveMsg && (
                      <p className={`text-xs ${saveMsg.includes("✓") ? "text-green-600" : "text-red-500"}`}>
                        {saveMsg}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function statusHeading(status: string): string {
  switch (status) {
    case "idle":       return "녹음 시작";
    case "recording":  return "녹음 중";
    case "paused":     return "일시정지";
    case "processing": return "변환 중";
    case "has_records": return "기록 편집";
    default:           return "체어 기록";
  }
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V4Z" />
      <path fillRule="evenodd" d="M5.5 10.5a.75.75 0 0 0-1.5 0 6 6 0 0 0 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.046A6 6 0 0 0 15.5 10.5a.75.75 0 0 0-1.5 0 4.5 4.5 0 0 1-9 0Z" clipRule="evenodd" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}
