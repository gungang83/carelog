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
import { createBoardLivePublisher } from "@/lib/realtime/board-live";
import { uploadConsultationAudio } from "@/app/actions/audio";
import {
  transcribeChairAudio,
  saveChairRecord,
  getOrCreateChairByName,
  getRecentParticipants,
  reportAutoSaveFailure,
} from "@/app/actions/chairs";
import {
  transcribeSegment,
  summarizeChunkTranscript,
} from "@/app/actions/transcribe";
import { enqueueServerTranscription } from "@/app/actions/transcription-jobs";
import {
  CHUNK_CONCURRENCY,
  CHUNK_SEGMENT_RETRY,
  type EngineRun,
} from "@/lib/transcribe/engines";
import { EngineSelector } from "@/components/chair/engine-selector";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/rich-text-editor";
import { PrescriptionPicker } from "@/components/chair/prescription-picker";
import { ParticipantPicker } from "@/components/chair/participant-picker";
import { getLastChairId, setLastChairId } from "@/lib/chair/last-chair";
import {
  saveDraft,
  loadDraft,
  clearDraft,
  draftHasContent,
  type BoardDraft,
} from "@/lib/chair/draft-store";
import type { Participant } from "@/lib/types/database";

/**
 * 상담보드 (spec 008) — record-first 통합 상담 기록 캔버스.
 * 체어를 고르기 전에 1탭으로 녹음을 시작(DRAFT 세션)하고, 녹음이 도는 동안/끝난 뒤
 * 본문·그림·체어·참여자·처방을 한 화면에서 채워 저장한다.
 * 컴포넌트는 layout에 상시 마운트되어, 보드를 닫아도 작성 중 내용이 보존된다(FR-016).
 */
export function ConsultationBoard({
  institutionId,
  labEnabled = false,
}: {
  institutionId: string;
  labEnabled?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <BoardContent institutionId={institutionId} labEnabled={labEnabled} />,
    document.body,
  );
}

function BoardContent({
  institutionId,
  labEnabled,
}: {
  institutionId: string;
  labEnabled: boolean;
}) {
  const {
    chairs,
    members,
    me,
    openChairId,
    closeOverlay,
    getChairStatus,
    startRecording,
    stopRecording,
    stopRecordingChunked,
    registerSegmentHandler,
    setTranscriptionResult,
    resetChair,
    refreshUnlinkedCount,
    engine,
    setEngine,
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
  // 엔진은 컨텍스트 공유(히어로에서 녹음 시작 전 선택). 비-lab은 서버에서 basic 강제.
  // 비교 모드 결과(basic + multilingual). 사용자가 한쪽을 골라 본문에 삽입.
  const [comparison, setComparison] = useState<EngineRun[] | null>(null);
  // 저장 시 기록할 사용 엔진(어떤 엔진 결과를 본문에 넣었는지).
  const [usedEngine, setUsedEngine] = useState<string | null>(null);
  const [recoverable, setRecoverable] = useState<BoardDraft | null>(null);
  // 청크(긴 상담) 전사 진행률 — "n/m 구간 전사 중" 표시(spec 010 US4).
  const [chunkProgress, setChunkProgress] = useState<{ done: number; total: number } | null>(null);
  // spec 016 — 녹음 중 점진 전사 완료 구간 수(라이브 표시) + 자동저장 진행 표시.
  const [liveDone, setLiveDone] = useState(0);
  const [autoSaving, setAutoSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isCreatingChair, startCreateChair] = useTransition();

  const router = useRouter();
  const editorRef = useRef<RichTextEditorHandle | null>(null);
  // 녹음 원본 blob — 저장 후 음성 보관 업로드용(spec 009). 저장/버리기 시 해제.
  const audioBlobRef = useRef<Blob | null>(null);
  // 청크(긴 상담) 모드 분할 녹음 구간 blob 배열 — 복구 재전사용(spec 010).
  const audioSegmentsRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // spec 016 점진 전사 — 구간별 전사 결과(index→text|null)와 진행 중 작업 promise.
  const liveTextsRef = useRef<(string | null)[]>([]);
  const liveTasksRef = useRef<Promise<void>[]>([]);
  // spec 016 — 이번 종료가 '종료 및 저장'(자동저장)인지.
  const autoSaveRef = useRef(false);

  const status = getChairStatus(DRAFT_CHAIR_KEY);

  // 마운트 시 기본값: '나' 참여자, 마지막 체어, 최근 참여자 로드
  // + 이전 세션에서 미저장 임시본이 있으면 복구 후보로 띄운다(C-01 2차).
  useEffect(() => {
    resetDefaults();
    getRecentParticipants().then(setRecent).catch(() => {});
    loadDraft().then((d) => {
      if (draftHasContent(d)) setRecoverable(d);
    });
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

  // 미저장 작업 중 탭 닫기/새로고침 이탈 경고 (C-01 — 녹음·작성 유실 방지).
  // 보드를 닫아도 컴포넌트는 마운트 유지(FR-016)지만, 탭 종료·새로고침은 메모리를
  // 날린다. 녹음 중이거나 저장 전 작성물/음성이 있으면 브라우저 기본 확인창을 띄운다.
  useEffect(() => {
    const hasUnsaved =
      status === "recording" ||
      status === "processing" ||
      editText.trim() !== "" ||
      audioBlobRef.current !== null;
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status, editText]);

  // 미저장 작업을 IndexedDB에 주기 저장 (C-01 2차 — 탭이 닫혀도 복구 가능).
  // 디바운스(1초)로 입력 중 과도한 쓰기를 막는다. 깨끗한 상태면 저장하지 않는다.
  useEffect(() => {
    const hasUnsaved =
      status === "recording" ||
      status === "processing" ||
      editText.trim() !== "" ||
      audioBlobRef.current !== null;
    if (!hasUnsaved) return;
    const t = setTimeout(() => {
      void saveDraft({
        content: editText,
        prescriptions,
        participants,
        selectedChair,
        audioBlob: audioBlobRef.current,
        // 청크 구간 배열 보존(자동저장이 handleStopChunked 저장본을 덮어쓰지 않도록)
        audioSegments: audioSegmentsRef.current.length
          ? audioSegmentsRef.current
          : null,
        savedAt: Date.now(),
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [status, editText, prescriptions, participants, selectedChair]);

  // ── 실시간 진행 현황 broadcast (C-05 1단계) — 메타만, 본문 PII 제외 ──
  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current && typeof crypto !== "undefined") {
    sessionIdRef.current = crypto.randomUUID();
  }
  const startedAtRef = useRef(0);
  const wasActiveRef = useRef(false);
  const publisherRef = useRef<ReturnType<typeof createBoardLivePublisher> | null>(null);
  const authorName = me?.name ?? "직원";

  useEffect(() => {
    if (!institutionId) return;
    const pub = createBoardLivePublisher(institutionId);
    publisherRef.current = pub;
    return () => {
      pub.close();
      publisherRef.current = null;
    };
  }, [institutionId]);

  // 작성 중이면 3초마다 진행 현황 송신, 작성이 끝나면 종료 신호 1회.
  useEffect(() => {
    const pub = publisherRef.current;
    if (!pub) return;
    const active =
      status === "recording" ||
      status === "processing" ||
      editText.trim() !== "" ||
      audioBlobRef.current !== null;

    if (!active) {
      if (wasActiveRef.current) {
        wasActiveRef.current = false;
        pub.publish({
          sessionId: sessionIdRef.current,
          author: authorName,
          chairName: "",
          startedAt: startedAtRef.current,
          charCount: 0,
          ended: true,
        });
      }
      return;
    }

    if (!wasActiveRef.current) {
      wasActiveRef.current = true;
      startedAtRef.current = Date.now();
    }
    const send = () =>
      pub.publish({
        sessionId: sessionIdRef.current,
        author: authorName,
        chairName: selectedChair?.name ?? "",
        startedAt: startedAtRef.current,
        charCount: editText.replace(/<[^>]*>/g, "").trim().length,
      });
    send();
    const t = setInterval(send, 3000);
    return () => clearInterval(t);
  }, [status, editText, selectedChair, authorName]);

  if (!isOpen) return null;

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // 구간 1개 전사(1회 재시도). 무음/빈 구간은 빈 문자열 성공. 실패는 null.
  const transcribeSegmentWithRetry = async (blob: Blob, i: number): Promise<string | null> => {
    const attempt = async () => {
      const fd = new FormData();
      fd.append("audio", blob, `segment_${i}.webm`);
      fd.append("index", String(i));
      return transcribeSegment(fd).catch(() => ({ ok: false as const, message: "네트워크 오류" }));
    };
    let r = await attempt();
    for (let k = 0; !r.ok && k < CHUNK_SEGMENT_RETRY; k++) r = await attempt();
    return r.ok ? r.text : null;
  };

  const handleStart = async () => {
    setMicError("");
    // spec 016 — 점진 전사 리셋. 청크 모드면 구간 완료 즉시 백그라운드 전사(녹음 중에).
    liveTextsRef.current = [];
    liveTasksRef.current = [];
    setLiveDone(0);
    if (engine === "chunk") {
      registerSegmentHandler(DRAFT_CHAIR_KEY, (seg, index) => {
        // 미설정(undefined)=전사 진행 중, string=성공, null=실패. 구간 완료 즉시 백그라운드 전사.
        const task = transcribeSegmentWithRetry(seg, index).then((text) => {
          liveTextsRef.current[index] = text;
          setLiveDone((d) => d + 1);
        });
        liveTasksRef.current.push(task);
      });
    }
    const result = await startRecording(DRAFT_CHAIR_KEY);
    if (!result.ok) setMicError(result.error ?? "녹음 시작 실패");
  };

  // 상담 종료(전사) — 기존 동작. autoSave=true면 종료 후 자동 저장까지(handleStopAndSave 경유).
  const handleStop = () => {
    // 청크(긴 상담) 모드는 분할 녹음 → 별도 오케스트레이션.
    if (engine === "chunk") {
      void handleStopChunked();
      return;
    }
    const secs = elapsed;
    const blob = stopRecording(DRAFT_CHAIR_KEY);
    const sizeKB = blob ? Math.round((blob.size / 1024) * 10) / 10 : 0;

    // 빈/극소 녹음 = iOS 화면잠금·백그라운드로 정지된 전형적 케이스(원인 가시화).
    if (!blob || blob.size < 1024) {
      resetChair(DRAFT_CHAIR_KEY);
      setMicError(
        `녹음이 비어 있어요 (녹음 ${secs}초 · ${sizeKB}KB). 화면이 잠기거나 다른 앱으로 전환되면 녹음이 끊깁니다. 화면을 켠 채로 다시 녹음해 주세요.`,
      );
      if (autoSaveRef.current) {
        autoSaveRef.current = false;
        setAutoSaving(false);
        void reportAutoSaveFailure({ reason: "empty", chairId: selectedChair?.id ?? null });
      }
      return;
    }

    // 저장 후 음성 보관(spec 009) 업로드를 위해 원본 보존.
    audioBlobRef.current = blob;

    // 전사 중 크래시(모바일 OOM·함수 타임아웃 등)로 유실되지 않도록, 무거운 전사를
    // 시작하기 전에 음성+작성물을 IndexedDB에 즉시 1회 저장한다(1초 디바운스 자동저장을
    // 기다리지 않음). 재진입 시 복구 배너 → applyRecover가 음성을 재전사한다.
    void saveDraft({
      content: editText,
      prescriptions,
      participants,
      selectedChair,
      audioBlob: blob,
      savedAt: Date.now(),
    });

    transcribeBlob(blob, secs);
  };

  // 상담 종료 및 저장(spec 020 서버 비동기 전사) — 음성만 서버에 올리고 즉시 종료.
  // 전사·요약은 서버 백그라운드 워커가 처리 → 탭 닫거나 폰 잠가도 완료되면 알림이 온다.
  const handleStopAndSave = () => {
    setSaveMsg("");
    if (!selectedChair) {
      setSaveMsg("체어를 먼저 선택하면 저장돼요.");
      return;
    }
    const chair = selectedChair;
    const prefixHtml = editorRef.current?.getHTML() ?? ""; // 직접 입력해둔 본문 보존
    setAutoSaving(true);

    const finish = async () => {
      let blob: Blob | null = null;
      if (engine === "chunk") {
        const segs = await stopRecordingChunked(DRAFT_CHAIR_KEY);
        registerSegmentHandler(DRAFT_CHAIR_KEY, null);
        if (segs.length) blob = new Blob(segs, { type: segs[0]?.type || "audio/webm" });
      } else {
        blob = stopRecording(DRAFT_CHAIR_KEY);
      }
      if (!blob || blob.size < 1024) {
        resetChair(DRAFT_CHAIR_KEY);
        setAutoSaving(false);
        setMicError("녹음이 비어 있어요. 화면을 켠 채로 다시 녹음해 주세요.");
        return;
      }
      audioBlobRef.current = blob;
      // 등록 실패 대비 복구 안전망(음성+작성물 즉시 영속)
      void saveDraft({ content: prefixHtml, prescriptions, participants, selectedChair: chair, audioBlob: blob, savedAt: Date.now() });

      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      fd.append("chairId", chair.id);
      fd.append("engine", engine);
      fd.append("prescriptions", JSON.stringify(prescriptions));
      fd.append("participants", JSON.stringify(participants));
      fd.append("prefixHtml", prefixHtml);

      startTransition(async () => {
        const r = await enqueueServerTranscription(fd);
        if (r.ok) {
          markLocalSave(r.consultationId);
          audioBlobRef.current = null;
          audioSegmentsRef.current = [];
          liveTextsRef.current = [];
          liveTasksRef.current = [];
          void clearDraft();
          setLastChairId(chair.id);
          resetChair(DRAFT_CHAIR_KEY);
          setEditText("");
          editorRef.current?.clear();
          setPrescriptions([]);
          setMicError("");
          setSaveMsg("");
          setUsedEngine(null);
          setComparison(null);
          setEngine("basic");
          setAutoSaving(false);
          resetDefaults();
          await refreshUnlinkedCount(chair.id);
          closeOverlay();
          router.refresh();
        } else {
          setAutoSaving(false);
          setMicError(`백그라운드 전사 등록 실패: ${r.message} — 녹음은 보관됐어요. '상담 종료'로 다시 시도해 주세요.`);
          void reportAutoSaveFailure({ reason: "enqueue", message: r.message, chairId: chair.id });
        }
      });
    };
    void finish();
  };

  // 자동 저장 — 전사 완료 직후 호출. 실패는 비차단으로 로그 + 임시본 보존(복구 가능).
  const doAutoSave = async (engineUsed: string | null) => {
    const html = editorRef.current?.getHTML() ?? editText;
    const plain = html.replace(/<[^>]*>/g, "").trim();
    if (!plain) {
      autoSaveRef.current = false;
      setAutoSaving(false);
      setSaveMsg("저장할 내용이 없어요. 다시 시도해 주세요.");
      void reportAutoSaveFailure({ reason: "empty", chairId: selectedChair?.id ?? null });
      return;
    }
    if (!selectedChair) {
      autoSaveRef.current = false;
      setAutoSaving(false);
      setSaveMsg("체어를 선택하면 자동 저장돼요 — 작성한 내용은 보관됐어요.");
      void reportAutoSaveFailure({ reason: "no_chair", contentLength: plain.length });
      return; // 내용·음성 유지 → 체어 선택 후 수동 '저장' 가능
    }
    const chair = selectedChair;
    const result = await saveChairRecord({
      chairId: chair.id,
      content: html,
      prescriptions,
      participants,
      transcriptionEngine: engineUsed,
    });
    autoSaveRef.current = false;
    if (result.ok) {
      markLocalSave(result.consultationId);
      const audio = audioBlobRef.current;
      if (audio) {
        const fd = new FormData();
        fd.append("audio", audio, "recording.webm");
        void uploadConsultationAudio(result.consultationId, fd);
      }
      audioBlobRef.current = null;
      audioSegmentsRef.current = [];
      liveTextsRef.current = [];
      liveTasksRef.current = [];
      void clearDraft();
      setLastChairId(chair.id);
      resetChair(DRAFT_CHAIR_KEY);
      setEditText("");
      editorRef.current?.clear();
      setPrescriptions([]);
      setMicError("");
      setSaveMsg("");
      setUsedEngine(null);
      setComparison(null);
      setEngine("basic");
      setAutoSaving(false);
      resetDefaults();
      await refreshUnlinkedCount(chair.id);
      closeOverlay();
      router.refresh();
    } else {
      setAutoSaving(false);
      setSaveMsg(`자동 저장 실패: ${result.message} — 작성 내용·녹음은 보관됐어요. 다시 저장해 주세요.`);
      console.error("[autosave] saveChairRecord 실패:", result.message);
      void reportAutoSaveFailure({ reason: "save", message: result.message, chairId: chair.id, contentLength: plain.length });
      // 임시본은 이미 영속 — 사용자가 수동 '저장' 재시도 가능.
    }
  };

  // 음성 blob 전사(녹음 종료·복구 공용). secs/sizeKB는 실패 메시지에만 쓰인다.
  const transcribeBlob = (blob: Blob, secs: number) => {
    const sizeKB = Math.round((blob.size / 1024) * 10) / 10;
    startTransition(async () => {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const result = await transcribeChairAudio(formData, engine);
      if (result.ok) {
        // 자동저장(종료 및 저장) 시 비교 모드면 첫 결과(basic)로 자동 확정 — 사람 선택 불가.
        if (result.runs.length > 1 && !autoSaveRef.current) {
          // 비교 모드 — 본문 삽입은 사용자가 한쪽을 고를 때까지 보류.
          setTranscriptionResult(DRAFT_CHAIR_KEY, ""); // 녹음바 processing 해제
          setComparison(result.runs);
        } else {
          // 상태를 has_records로 전환(녹음바 processing 해제) + 본문 에디터에 전사 삽입.
          // RichTextEditor는 value 변경을 자동 반영하지 않으므로 insertText로 넣는다(onChange가 editText 갱신).
          const run = result.runs[0];
          setTranscriptionResult(DRAFT_CHAIR_KEY, run.summary);
          editorRef.current?.insertText(run.insertText);
          setUsedEngine(run.engine);
          if (autoSaveRef.current) await doAutoSave(run.engine);
        }
      } else {
        setMicError(`전사 실패 (녹음 ${secs}초 · ${sizeKB}KB): ${result.message}`);
        setTranscriptionResult(DRAFT_CHAIR_KEY, "");
        if (autoSaveRef.current) {
          autoSaveRef.current = false;
          setAutoSaving(false);
          void reportAutoSaveFailure({ reason: "transcribe", message: result.message, chairId: selectedChair?.id ?? null });
        }
      }
    });
  };

  // ── 청크(긴 상담) 종료 — 점진 전사(녹음 중 누적) 마무리 → 전체 요약 (spec 010/016) ──
  // 녹음 중 구간마다 백그라운드 전사가 돌았으므로, 종료 시엔 남은 작업만 기다리면 된다.
  const handleStopChunked = async () => {
    const segments = await stopRecordingChunked(DRAFT_CHAIR_KEY);
    registerSegmentHandler(DRAFT_CHAIR_KEY, null); // 라이브 핸들러 해제
    if (segments.length === 0) {
      resetChair(DRAFT_CHAIR_KEY);
      setMicError(
        "녹음이 비어 있어요. 화면이 잠기거나 다른 앱으로 전환되면 녹음이 끊깁니다. 화면을 켠 채로 다시 녹음해 주세요.",
      );
      if (autoSaveRef.current) {
        autoSaveRef.current = false;
        setAutoSaving(false);
        void reportAutoSaveFailure({ reason: "empty", chairId: selectedChair?.id ?? null });
      }
      return;
    }
    audioSegmentsRef.current = segments;
    // 보관(spec 009)·복구용 단일 blob — 구간을 이어붙인다(A안). 짧은 녹음=구간 1개도 동일.
    audioBlobRef.current = new Blob(segments, {
      type: segments[0]?.type || "audio/webm",
    });

    // 전사 마무리 전 즉시 영속화(복구 안전망) — 구간 배열도 함께 저장.
    void saveDraft({
      content: editText,
      prescriptions,
      participants,
      selectedChair,
      audioBlob: audioBlobRef.current,
      audioSegments: segments,
      savedAt: Date.now(),
    });

    finalizeChunked(segments.length);
  };

  // 점진 전사 마무리 — 진행 중 구간 작업 대기 + 누락 구간 안전망 전사 → 전체 요약.
  const finalizeChunked = (total: number) => {
    startTransition(async () => {
      setChunkProgress({
        done: liveTextsRef.current.slice(0, total).filter((t) => t !== undefined).length,
        total,
      });
      await Promise.allSettled(liveTasksRef.current);
      // 안전망: 라이브에서 누락된 구간(undefined)을 직접 전사(실무상 거의 없음).
      const segs = audioSegmentsRef.current;
      for (let i = 0; i < total; i++) {
        if (liveTextsRef.current[i] === undefined && segs[i]) {
          liveTextsRef.current[i] = await transcribeSegmentWithRetry(segs[i], i);
          setChunkProgress({ done: i + 1, total });
        }
      }
      setChunkProgress(null);
      await finishChunkTexts(liveTextsRef.current.slice(0, total), total);
    });
  };

  // 복구(applyRecover) 전용 — 저장된 구간 배열을 처음부터 동시성 전사(점진 데이터 없음).
  const transcribeSegments = (segments: Blob[]) => {
    startTransition(async () => {
      const total = segments.length;
      setChunkProgress({ done: 0, total });
      const texts: (string | null)[] = new Array(total).fill(null);
      let done = 0;
      let cursor = 0;
      const worker = async () => {
        while (cursor < total) {
          const i = cursor++;
          texts[i] = await transcribeSegmentWithRetry(segments[i], i);
          done++;
          setChunkProgress({ done, total });
        }
      };
      await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, total) }, worker));
      setChunkProgress(null);
      await finishChunkTexts(texts, total);
    });
  };

  // 구간 텍스트 배열(index→text|null|undefined) → 요약·삽입·(자동저장). 라이브/복구 공용.
  // string=성공(빈문자열=무음 구간, 누락 아님), null/undefined=전사 실패.
  const finishChunkTexts = async (texts: (string | null | undefined)[], total: number) => {
    const failed: number[] = [];
    for (let i = 0; i < total; i++) {
      if (typeof texts[i] !== "string") failed.push(i);
    }
    const succeeded = texts.filter((t): t is string => typeof t === "string" && t.trim() !== "");

    if (succeeded.length === 0) {
      setMicError("전사에 실패했어요. 녹음은 보관돼 있으니 잠시 후 다시 시도해 주세요.");
      setTranscriptionResult(DRAFT_CHAIR_KEY, "");
      if (autoSaveRef.current) {
        autoSaveRef.current = false;
        setAutoSaving(false);
        void reportAutoSaveFailure({ reason: "transcribe", chairId: selectedChair?.id ?? null, segmentsTotal: total, segmentsFailed: failed.length });
      }
      return;
    }

    const sum = await summarizeChunkTranscript(succeeded.join("\n"));
    const fallback = texts
      .map((t, i) => (typeof t === "string" ? t : `[⚠️ ${i + 1}번째 구간 전사 실패]`))
      .join("\n")
      .trim();
    let summary = sum.ok ? sum.summary : fallback;
    if (failed.length > 0) {
      summary += `\n\n> ⚠️ ${total}개 구간 중 ${failed.length}개 전사 실패(${failed
        .map((i) => i + 1)
        .join(", ")}번). 해당 부분이 누락됐을 수 있어요. 음성은 보관됩니다.`;
    }
    setTranscriptionResult(DRAFT_CHAIR_KEY, summary);
    editorRef.current?.insertText(summary);
    setUsedEngine("chunk");
    if (autoSaveRef.current) await doAutoSave("chunk");
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
    // 녹음/작성물이 있을 때만 확인 — 실수로 '버리기'를 눌러 날리는 사고 방지.
    const hasContent =
      status === "recording" ||
      editText.trim() !== "" ||
      audioBlobRef.current !== null;
    if (hasContent && !window.confirm("작성 중인 내용과 녹음을 버릴까요? 되돌릴 수 없어요.")) {
      return;
    }
    audioBlobRef.current = null;
    audioSegmentsRef.current = [];
    // spec 016 — 점진 전사·자동저장 상태 초기화
    liveTextsRef.current = [];
    liveTasksRef.current = [];
    autoSaveRef.current = false;
    setLiveDone(0);
    setAutoSaving(false);
    registerSegmentHandler(DRAFT_CHAIR_KEY, null);
    resetChair(DRAFT_CHAIR_KEY);
    setEditText("");
    editorRef.current?.clear();
    setPrescriptions([]);
    setMicError("");
    setSaveMsg("");
    setRecoverable(null);
    void clearDraft();
    resetDefaults();
    closeOverlay();
  };

  // 이전 세션 임시본 복구 — 본문(HTML)·처방·참여자·체어·녹음 음성을 되살린다.
  const applyRecover = () => {
    if (!recoverable) return;
    const rec = recoverable;
    setEditText(rec.content);
    editorRef.current?.setHTML(rec.content);
    setPrescriptions(rec.prescriptions ?? []);
    setParticipants(rec.participants ?? []);
    setSelectedChair(rec.selectedChair ?? null);
    audioBlobRef.current = rec.audioBlob ?? null;
    audioSegmentsRef.current = rec.audioSegments ?? [];
    // 녹음이 끝난 상태로 복구 → status를 has_records로 전환(저장 가능 상태).
    setTranscriptionResult(DRAFT_CHAIR_KEY, "");
    setRecoverable(null);
    // 전사 완료 전에 크래시 → 본문은 비고 음성만 남은 경우: 복구한 음성을 재전사한다
    // (그러지 않으면 음성은 살아도 본문이 없어 저장할 수 없다).
    if (!rec.content.trim()) {
      if (rec.audioSegments && rec.audioSegments.length > 0) {
        transcribeSegments(rec.audioSegments); // 청크 — 구간 재전사
      } else if (rec.audioBlob) {
        transcribeBlob(rec.audioBlob, 0); // 통짜
      }
    }
  };

  const dismissRecover = () => {
    setRecoverable(null);
    void clearDraft();
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
        transcriptionEngine: usedEngine,
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
        audioSegmentsRef.current = [];
        liveTextsRef.current = [];
        liveTasksRef.current = [];
        setLiveDone(0);
        void clearDraft();
        setLastChairId(chair.id);
        resetChair(DRAFT_CHAIR_KEY);
        setEditText("");
        editorRef.current?.clear();
        setPrescriptions([]);
        setMicError("");
        setSaveMsg("");
        setUsedEngine(null);
        setComparison(null);
        setEngine("basic");
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

  // 비교 모드에서 한쪽 결과를 골라 본문에 삽입.
  const applyComparison = (run: EngineRun) => {
    editorRef.current?.insertText(run.insertText);
    setTranscriptionResult(DRAFT_CHAIR_KEY, run.summary);
    setUsedEngine(run.engine);
    setComparison(null);
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
                {engine === "chunk" && liveDone > 0 && (
                  <span className="text-xs text-slate-400">· {liveDone}구간 전사됨</span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleStop}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600"
                  >
                    상담 종료
                  </button>
                  <button
                    type="button"
                    onClick={handleStopAndSave}
                    disabled={!selectedChair}
                    title={!selectedChair ? "체어를 먼저 선택하면 종료와 동시에 저장돼요" : undefined}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    상담 종료 및 저장
                  </button>
                </div>
              </>
            ) : processing ? (
              <>
                <span className="inline-block size-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                <span className="text-sm text-sky-700">
                  {chunkProgress
                    ? `음성 인식 중… (${chunkProgress.done}/${chunkProgress.total} 구간)`
                    : "음성 인식 중…"}
                  {autoSaving && " · 저장 예정 (이 창은 닫아도 됩니다)"}
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-slate-800">상담보드</span>
                {labEnabled && (
                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                    실험실
                  </span>
                )}
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

          {/* 녹음 시작 안내(정확도 가이드) — 녹음 중에만 노출. 말하는 사람이
              이름을 먼저, 부위(치식)를 말로 표현하도록 유도해 인식 정확도를 높인다. */}
          {recording && (
            <div className="border-b border-sky-100 bg-sky-50/70 px-5 py-2.5">
              <p className="text-sm font-semibold text-sky-800 break-keep">
                🎙️ 녹음이 시작되었습니다
              </p>
              <p className="mt-0.5 text-xs leading-snug text-sky-700 break-keep">
                환자분 성함을 먼저 말씀해 주세요. 치아 부위(번호)를 말로 또렷이
                표현하시면 더 정확하게 기록돼요.
              </p>
            </div>
          )}

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {micError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {micError}
              </p>
            )}

            {/* 실험실 — 녹음 엔진 선택(idle 폴백). 보통은 히어로에서 시작 전 선택하지만,
                보드가 idle로 열리는 경로를 위해 같은 컴포넌트로 노출한다(context 공유). */}
            {labEnabled && status === "idle" && (
              <EngineSelector engine={engine} onChange={setEngine} />
            )}

            {/* 실험실 비교 모드 — 기본 vs 다국어 결과를 나란히 보고 한쪽을 본문에 삽입 */}
            {comparison && (
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                <p className="text-sm font-semibold text-violet-800">
                  엔진 비교 — 사용할 결과를 고르세요
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {comparison.map((run) => (
                    <div
                      key={run.engine}
                      className="flex flex-col rounded-lg border border-violet-200 bg-white p-2.5"
                    >
                      <p className="text-xs font-bold text-violet-700">{run.label}</p>
                      <pre className="mt-1 max-h-44 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-snug text-slate-600">
                        {run.insertText}
                      </pre>
                      <button
                        type="button"
                        onClick={() => applyComparison(run)}
                        className="mt-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
                      >
                        이 결과 사용
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setComparison(null)}
                  className="mt-2 text-xs font-medium text-violet-600 hover:underline"
                >
                  닫기 (삽입 안 함)
                </button>
              </div>
            )}

            {/* 미저장 임시본 복구 제안 — 깨끗한 상태에서만(작성 중 덮어쓰기 방지) */}
            {recoverable && status === "idle" && !editText.trim() && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-sm font-semibold text-amber-800">
                  이전에 작성하던 상담 기록이 있어요
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  {new Date(recoverable.savedAt).toLocaleString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  저장{recoverable.audioBlob ? " · 녹음 포함" : ""}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={applyRecover}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
                  >
                    복구하기
                  </button>
                  <button
                    type="button"
                    onClick={dismissRecover}
                    className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                  >
                    새로 시작
                  </button>
                </div>
              </div>
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
