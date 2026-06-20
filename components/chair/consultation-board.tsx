"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  useChairContext,
  DRAFT_CHAIR_KEY,
} from "@/components/chair/chair-provider";
import { CopyAllButton } from "@/components/copy-all-button";
import { markLocalSave } from "@/lib/realtime/local-echo";
import { uploadConsultationAudio } from "@/app/actions/audio";
import {
  transcribeChairAudio,
  saveChairRecord,
  getOrCreateChairByName,
  getRecentParticipants,
} from "@/app/actions/chairs";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/rich-text-editor";
import { PrescriptionPicker } from "@/components/chair/prescription-picker";
import { ParticipantPicker } from "@/components/chair/participant-picker";
import { getLastChairId, setLastChairId } from "@/lib/chair/last-chair";
import type { Participant } from "@/lib/types/database";

/**
 * 상담보드 (spec 008) — record-first 통합 상담 기록 캔버스.
 * 체어를 고르기 전에 1탭으로 녹음을 시작(DRAFT 세션)하고, 녹음이 도는 동안/끝난 뒤
 * 본문·그림·체어·참여자·처방을 한 화면에서 채워 저장한다.
 * 컴포넌트는 layout에 상시 마운트되어, 보드를 닫아도 작성 중 내용이 보존된다(FR-016).
 */
export function ConsultationBoard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<BoardContent />, document.body);
}

function BoardContent() {
  const {
    chairs,
    members,
    me,
    openChairId,
    closeOverlay,
    getChairStatus,
    startRecording,
    stopRecording,
    setTranscriptionResult,
    resetChair,
    refreshUnlinkedCount,
  } = useChairContext();

  const isOpen = openChairId === DRAFT_CHAIR_KEY;

  const [selectedChair, setSelectedChair] = useState<{ id: string; name: string } | null>(null);
  const [editText, setEditText] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [prescriptions, setPrescriptions] = useState<string[]>([]);
  const [recent, setRecent] = useState<Participant[]>([]);
  const [customName, setCustomName] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [micError, setMicError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isCreatingChair, startCreateChair] = useTransition();

  const router = useRouter();
  const editorRef = useRef<RichTextEditorHandle | null>(null);
  // 녹음 원본 blob — 저장 후 음성 보관 업로드용(spec 009). 저장/버리기 시 해제.
  const audioBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const status = getChairStatus(DRAFT_CHAIR_KEY);

  // 마운트 시 기본값: '나' 참여자, 마지막 체어, 최근 참여자 로드
  useEffect(() => {
    resetDefaults();
    getRecentParticipants().then(setRecent).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetDefaults() {
    setParticipants(me ? [me] : []);
    const lastId = getLastChairId();
    const last = lastId ? chairs.find((c) => c.id === lastId) : undefined;
    setSelectedChair(last ? { id: last.id, name: last.name } : null);
  }

  // 녹음 타이머
  useEffect(() => {
    if (status === "recording") {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  if (!isOpen) return null;

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleStart = async () => {
    setMicError("");
    const result = await startRecording(DRAFT_CHAIR_KEY);
    if (!result.ok) setMicError(result.error ?? "녹음 시작 실패");
  };

  const handleStop = () => {
    const secs = elapsed;
    const blob = stopRecording(DRAFT_CHAIR_KEY);
    const sizeKB = blob ? Math.round((blob.size / 1024) * 10) / 10 : 0;

    // 빈/극소 녹음 = iOS 화면잠금·백그라운드로 정지된 전형적 케이스(원인 가시화).
    if (!blob || blob.size < 1024) {
      resetChair(DRAFT_CHAIR_KEY);
      setMicError(
        `녹음이 비어 있어요 (녹음 ${secs}초 · ${sizeKB}KB). 화면이 잠기거나 다른 앱으로 전환되면 녹음이 끊깁니다. 화면을 켠 채로 다시 녹음해 주세요.`,
      );
      return;
    }

    // 저장 후 음성 보관(spec 009) 업로드를 위해 원본 보존.
    audioBlobRef.current = blob;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const result = await transcribeChairAudio(formData);
      if (result.ok) {
        // 상태를 has_records로 전환(녹음바 processing 해제) + 본문 에디터에 전사 삽입.
        // RichTextEditor는 value 변경을 자동 반영하지 않으므로 insertText로 넣는다(onChange가 editText 갱신).
        setTranscriptionResult(DRAFT_CHAIR_KEY, result.summary);
        editorRef.current?.insertText(result.summary);
      } else {
        setMicError(`전사 실패 (녹음 ${secs}초 · ${sizeKB}KB): ${result.message}`);
        setTranscriptionResult(DRAFT_CHAIR_KEY, "");
      }
    });
  };

  const handlePickCustomChair = () => {
    const name = customName.trim();
    if (!name) return;
    startCreateChair(async () => {
      const result = await getOrCreateChairByName(name);
      if (result.ok) {
        setSelectedChair({ id: result.chairId, name });
        setCustomName("");
      } else {
        setSaveMsg(result.message);
      }
    });
  };

  const closeBoard = () => {
    // 작성 중 내용은 보존(FR-016) — 닫기만 한다.
    closeOverlay();
  };

  const discard = () => {
    audioBlobRef.current = null;
    resetChair(DRAFT_CHAIR_KEY);
    setEditText("");
    editorRef.current?.clear();
    setPrescriptions([]);
    setMicError("");
    setSaveMsg("");
    resetDefaults();
    closeOverlay();
  };

  const handleSave = () => {
    setSaveMsg("");
    if (status === "recording") {
      setSaveMsg("녹음을 먼저 중지해 주세요.");
      return;
    }
    if (!editText.trim()) {
      setSaveMsg("기록할 내용이 없어요. 녹음하거나 직접 입력해 주세요.");
      return;
    }
    if (!selectedChair) {
      setSaveMsg("체어를 선택해 주세요.");
      return;
    }
    const chair = selectedChair;
    startTransition(async () => {
      const result = await saveChairRecord({
        chairId: chair.id,
        content: editText,
        prescriptions,
        participants,
      });
      if (result.ok) {
        // 이 탭이 저장한 기록 → 내 토스트만 숨김(같은 계정 다른 기기는 알림 받음)
        markLocalSave(result.consultationId);
        // 음성 원본 보관(spec 009) — 비차단(저장은 이미 완료, 음성은 보조)
        const audio = audioBlobRef.current;
        if (audio) {
          const fd = new FormData();
          fd.append("audio", audio, "recording.webm");
          void uploadConsultationAudio(result.consultationId, fd);
        }
        audioBlobRef.current = null;
        setLastChairId(chair.id);
        resetChair(DRAFT_CHAIR_KEY);
        setEditText("");
        editorRef.current?.clear();
        setPrescriptions([]);
        setMicError("");
        setSaveMsg("");
        resetDefaults();
        await refreshUnlinkedCount(chair.id);
        closeOverlay();
        // 저장한 기기의 '미연결 기록' 목록 즉시 갱신(타 기기는 realtime이 갱신)
        router.refresh();
      } else {
        setSaveMsg(result.message);
      }
    });
  };

  const recording = status === "recording";
  const processing = status === "processing" || isPending;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={closeBoard}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="상담보드"
        className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* 녹음 바 (상단, 항상) */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
            {recording ? (
              <>
                <span className="inline-block size-2.5 animate-pulse rounded-full bg-red-500" />
                <span className="text-sm font-semibold text-red-700">
                  녹음 중 {fmtTime(elapsed)}
                </span>
                <button
                  type="button"
                  onClick={handleStop}
                  className="ml-auto rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600"
                >
                  중지 및 변환
                </button>
              </>
            ) : processing ? (
              <>
                <span className="inline-block size-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                <span className="text-sm text-sky-700">음성 인식 중…</span>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-slate-800">상담보드</span>
                <button
                  type="button"
                  onClick={handleStart}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700"
                >
                  <MicIcon className="size-3.5" />
                  녹음 시작
                </button>
              </>
            )}
            <button
              type="button"
              onClick={closeBoard}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="닫기"
            >
              <XIcon className="size-5" />
            </button>
          </div>

          {/* 환자 안심 배너 — 상담보드는 보통 환자 옆에서 작성하므로,
              녹음의 '좋은 의도'를 환자에게 크게·항상 보이게 안내한다.
              녹음 중에는 빨간 표시가 긴장될 수 있어 문구를 더 또렷하게 바꾼다.
              문구는 여기서 바로 수정 가능(향후 기관별 커스터마이즈 후보). */}
          <div
            className={`flex items-center gap-3 border-b px-5 py-3 transition-colors ${
              recording
                ? "border-sky-200 bg-gradient-to-r from-sky-100 to-sky-50"
                : "border-sky-100 bg-gradient-to-r from-sky-50 to-white"
            }`}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              <ShieldIcon className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-slate-800 break-keep">
                {recording
                  ? "정확한 진료를 위해 상담을 기록하고 있어요"
                  : "안심하세요 — 환자분을 위한 기록이에요"}
              </p>
              <p className="mt-0.5 text-sm leading-snug text-slate-500 break-keep">
                내용을 빠짐없이 남겨 더 정확히 봐드리려는 거예요. 기록은 안전하게
                보관되고, 환자분도 받아보실 수 있어요.
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {micError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {micError}
              </p>
            )}

            <p className="text-xs text-slate-400">
              녹음하면서 내용을 적거나, 사진에 그림으로 표시할 수 있어요. 보드를 닫아도 녹음은
              계속됩니다.
            </p>

            {/* 본문 — 타이핑 + 인라인 이미지/그림 주석 */}
            <RichTextEditor
              ref={editorRef}
              value={editText}
              onChange={setEditText}
              placeholder="상담 내용을 입력하거나 녹음을 정리하세요…"
            />
            {editText.trim() && (
              <CopyAllButton
                html={editText}
                label="전체 복사 (덴트웹 붙여넣기)"
                className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              />
            )}

            {/* 체어 */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">체어 (저장 시 선택)</p>
              <div className="flex flex-wrap gap-1.5">
                {chairs.map((c) => {
                  const active = selectedChair?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedChair({ id: c.id, name: c.name })}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? "bg-sky-600 text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePickCustomChair();
                  }}
                  placeholder="직접 입력 (예: 상담실)"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-sky-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handlePickCustomChair}
                  disabled={isCreatingChair || !customName.trim()}
                  className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
                >
                  {isCreatingChair ? "…" : "추가"}
                </button>
              </div>
              {selectedChair && !chairs.some((c) => c.id === selectedChair.id) && (
                <p className="text-xs text-sky-600">선택: {selectedChair.name}</p>
              )}
            </div>

            {/* 참여자 */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">참여자 (선택)</p>
              <ParticipantPicker
                members={members}
                recent={recent}
                me={me}
                value={participants}
                onChange={setParticipants}
              />
            </div>

            {/* 처방 */}
            <PrescriptionPicker value={prescriptions} onChange={setPrescriptions} />
          </div>

          {/* 저장 */}
          <div className="border-t border-slate-100 px-5 py-3">
            {saveMsg && (
              <p className={`mb-2 text-xs ${saveMsg.includes("✓") ? "text-green-600" : "text-red-500"}`}>
                {saveMsg}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
              >
                {isPending ? "저장 중…" : "저장"}
              </button>
              <button
                type="button"
                onClick={discard}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                버리기
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V4Z" />
      <path fillRule="evenodd" d="M5.5 10.5a.75.75 0 0 0-1.5 0 6 6 0 0 0 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.046A6 6 0 0 0 15.5 10.5a.75.75 0 0 0-1.5 0 4.5 4.5 0 0 1-9 0Z" clipRule="evenodd" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.749ZM13.28 8.78a.75.75 0 0 0-1.06-1.06l-2.97 2.97-1.19-1.19a.75.75 0 0 0-1.06 1.06l1.72 1.72a.75.75 0 0 0 1.06 0l3.5-3.5Z"
        clipRule="evenodd"
      />
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
