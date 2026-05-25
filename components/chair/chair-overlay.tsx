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
    getTranscribedText,
    getSavedConsultationId,
    startRecording,
    stopRecording,
    setTranscriptionResult,
    setSavedConsultationId,
    resetChair,
    refreshUnlinkedCount,
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

  // Timer for recording
  useEffect(() => {
    if (status === "recording") {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
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
    const blob = stopRecording(openChairId);
    if (!blob) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const result = await transcribeChairAudio(formData);
      if (result.ok) {
        setTranscriptionResult(openChairId, result.summary);
        setEditText(result.summary);
      } else {
        setMicError(result.message);
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
        });
        if (result.ok) {
          setSavedConsultationId(openChairId, result.consultationId);
          setSaveMsg("저장됨 ✓");
          await refreshUnlinkedCount(openChairId);
        } else {
          setSaveMsg(result.message);
        }
      }
    });
  };

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

            {/* ── recording 상태 ── */}
            {status === "recording" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <span className="inline-block size-2.5 animate-pulse rounded-full bg-red-500" />
                  <span className="text-sm font-semibold text-red-700">
                    녹음 중 {fmtTime(elapsed)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  오버레이를 닫아도 녹음은 계속됩니다.
                </p>
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600"
                >
                  중지 및 변환
                </button>
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
