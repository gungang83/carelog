"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ChairRow, ClinicMemberRow, Participant } from "@/lib/types/database";
import { CHUNK_SEGMENT_MS, type EngineMode } from "@/lib/transcribe/engines";
import { getUnlinkedChairRecords } from "@/app/actions/chairs";

export type ChairStatus = "idle" | "recording" | "paused" | "processing" | "has_records";

/**
 * record-first 보드용 예약 세션 키.
 * 체어를 고르기 전에 녹음을 시작할 때, 녹음 상태·MediaRecorder를 이 키로 키잉한다.
 * 실제 체어 id가 아니므로 `chairs.find(id===KEY)`는 항상 미스 → 기존 per-chair 오버레이는
 * 이 키에 반응하지 않고, 상담보드(ConsultationBoard)만 이 키로 열린다.
 */
export const DRAFT_CHAIR_KEY = "__draft__";

type ChairRecordingState = {
  status: ChairStatus;
  transcribedText: string;
  savedConsultationId: string | null;
  startedAt: number | null; // spec 027 — 녹음 시작 시각(상시 표시 경과시간용)
};

type ChairState = {
  chairs: ChairRow[];
  openChairId: string | null;
  recording: Record<string, ChairRecordingState>;
  unlinkedCounts: Record<string, number>;
  participants: Record<string, Participant[]>;
};

type ChairAction =
  | { type: "OPEN_OVERLAY"; chairId: string }
  | { type: "CLOSE_OVERLAY" }
  | { type: "SET_STATUS"; chairId: string; status: ChairStatus }
  | { type: "SET_TRANSCRIPTION"; chairId: string; text: string }
  | { type: "SET_SAVED_ID"; chairId: string; consultationId: string }
  | { type: "SET_UNLINKED_COUNT"; chairId: string; count: number }
  | { type: "SET_PARTICIPANTS"; chairId: string; participants: Participant[] }
  | { type: "RESET_CHAIR"; chairId: string };

function getDefaultRecording(): ChairRecordingState {
  return { status: "idle", transcribedText: "", savedConsultationId: null, startedAt: null };
}

function reducer(state: ChairState, action: ChairAction): ChairState {
  switch (action.type) {
    case "OPEN_OVERLAY":
      return { ...state, openChairId: action.chairId };
    case "CLOSE_OVERLAY":
      return { ...state, openChairId: null };
    case "SET_STATUS": {
      const prev = state.recording[action.chairId] ?? getDefaultRecording();
      // spec 027 — recording 진입 시 시작 시각 기록(일시정지/재개는 유지), 세션 종료 시 해제
      const startedAt =
        action.status === "recording"
          ? (prev.startedAt ?? Date.now())
          : action.status === "idle" || action.status === "has_records"
            ? null
            : prev.startedAt;
      return {
        ...state,
        recording: {
          ...state.recording,
          [action.chairId]: { ...prev, status: action.status, startedAt },
        },
      };
    }
    case "SET_TRANSCRIPTION": {
      const prev = state.recording[action.chairId] ?? getDefaultRecording();
      return {
        ...state,
        recording: {
          ...state.recording,
          [action.chairId]: { ...prev, transcribedText: action.text, status: "has_records" },
        },
      };
    }
    case "SET_SAVED_ID": {
      const prev = state.recording[action.chairId] ?? getDefaultRecording();
      return {
        ...state,
        recording: {
          ...state.recording,
          [action.chairId]: {
            ...prev,
            savedConsultationId: action.consultationId,
            status: "has_records",
          },
        },
      };
    }
    case "SET_UNLINKED_COUNT":
      return {
        ...state,
        unlinkedCounts: {
          ...state.unlinkedCounts,
          [action.chairId]: action.count,
        },
      };
    case "SET_PARTICIPANTS":
      return {
        ...state,
        participants: {
          ...state.participants,
          [action.chairId]: action.participants,
        },
      };
    case "RESET_CHAIR":
      return {
        ...state,
        recording: {
          ...state.recording,
          [action.chairId]: getDefaultRecording(),
        },
        unlinkedCounts: { ...state.unlinkedCounts, [action.chairId]: 0 },
        participants: { ...state.participants, [action.chairId]: [] },
      };
    default:
      return state;
  }
}

type MediaRefs = {
  mediaRecorder: MediaRecorder | null;
  chunks: Blob[];
  // 청크(긴 상담) 분할 녹음 — spec 010
  segments: Blob[]; // 완료된 구간 blob들
  segmentTimer: ReturnType<typeof setInterval> | null; // 구간 회전 타이머
  stream: MediaStream | null; // 구간 재시작 간 유지하는 스트림
  mimeType: string;
  chunked: boolean; // 이번 녹음이 청크 모드인가
  userStopping: boolean; // 사용자 종료 중(다음 구간 재시작 금지)
  onSegmentsReady: ((segs: Blob[]) => void) | null; // 종료 시 구간 배열 resolve
  // spec 016 점진 전사 — 구간이 잘릴 때마다(녹음 중 포함) 즉시 호출(보드가 백그라운드 전사).
  onSegmentReady: ((seg: Blob, index: number) => void) | null;
};

// Wake Lock API 타입 (tsconfig lib에 없을 수 있어 최소 정의)
type WakeLockLike = { release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
};

type ChairContextValue = {
  chairs: ChairRow[];
  /** 기관 멤버 디렉터리(참여자 후보) — 보드/참여자 피커 공용 */
  members: ClinicMemberRow[];
  /** 로그인한 '나'(참여자 기본 포함 대상) */
  me: Participant | null;
  openChairId: string | null;
  openOverlay: (chairId: string, participants?: Participant[]) => void;
  closeOverlay: () => void;
  getParticipants: (chairId: string) => Participant[];
  getChairStatus: (chairId: string) => ChairStatus;
  getTranscribedText: (chairId: string) => string;
  getSavedConsultationId: (chairId: string) => string | null;
  startRecording: (chairId: string) => Promise<{ ok: boolean; error?: string }>;
  /** 녹음 일시정지 — 청크 구간 회전도 함께 멈춘다(spec 021 후속). */
  pauseRecording: (chairId: string) => void;
  /** 일시정지 재개 — 청크 구간 회전 타이머 복원. */
  resumeRecording: (chairId: string) => void;
  stopRecording: (chairId: string) => Blob | null;
  /** 청크(긴 상담) 종료 — 분할 구간 blob 배열 반환(spec 010) */
  stopRecordingChunked: (chairId: string) => Promise<Blob[]>;
  /** spec 016 — 점진 전사: 구간 완료 콜백 등록(녹음 시작 직후 보드가 등록). null로 해제. */
  registerSegmentHandler: (chairId: string, cb: ((seg: Blob, index: number) => void) | null) => void;
  setTranscriptionResult: (chairId: string, text: string) => void;
  setSavedConsultationId: (chairId: string, consultationId: string) => void;
  resetChair: (chairId: string) => void;
  unlinkedCounts: Record<string, number>;
  refreshUnlinkedCount: (chairId: string) => Promise<void>;
  /** 실험실(lab) 활성 워크스페이스 여부 — 녹음 엔진 선택 노출 조건 */
  labEnabled: boolean;
  /** 다음 녹음에 쓸 엔진(히어로에서 시작 전 선택 → 보드가 사용). 비-lab은 서버에서 basic 강제 */
  engine: EngineMode;
  setEngine: (engine: EngineMode) => void;
  // ── spec 027 상담 세션 안전망 ──────────────────────────────────
  /** 녹음/일시정지 중인 세션 키 목록(DRAFT 포함) — 상시 표시·방치 감시 대상 */
  activeRecordingKeys: string[];
  /** 녹음 시작 시각(경과 표시용) */
  getStartedAt: (chairId: string) => number | null;
  /** 활성 마이크 스트림(음성 활동 감지용 — 읽기 전용으로만 사용할 것) */
  getStream: (chairId: string) => MediaStream | null;
  /** 방치 자동 종료 콜백 등록 — 보드/오버레이가 자기 '종료 및 저장'을 등록한다 */
  registerAutoFinalize: (chairId: string, cb: (() => void) | null) => void;
  /** 등록된 자동 종료 콜백 실행. 등록이 없으면 false(가드는 경고만 유지) */
  runAutoFinalize: (chairId: string) => boolean;
  // ── spec 027 ④ 이어서 상담 ────────────────────────────────────
  /** 기존 상담 기록을 실어 보드를 연다(카드 → 보드 핸드오프). */
  openBoardWithPrefill: (prefill: BoardPrefill) => void;
  /** 보드가 오픈 시 1회 소비. 없으면 null. */
  consumeBoardPrefill: () => BoardPrefill | null;
};

/** spec 027 ④ — 이어서 상담 프리필(카드 → 보드) */
export type BoardPrefill = {
  consultationId: string;
  content: string;
  prescriptions: string[];
  participants: Participant[];
  chairId: string | null;
};

const ChairContext = createContext<ChairContextValue | null>(null);

export function useChairContext() {
  const ctx = useContext(ChairContext);
  if (!ctx) throw new Error("useChairContext must be used within ChairProvider");
  return ctx;
}

export function ChairProvider({
  initialChairs,
  members = [],
  me = null,
  labEnabled = false,
  children,
}: {
  initialChairs: ChairRow[];
  members?: ClinicMemberRow[];
  me?: Participant | null;
  labEnabled?: boolean;
  children: ReactNode;
}) {
  // 녹음 엔진 — 히어로(녹음 시작 전)에서 고르고 보드가 사용. 세션 공유 단일 상태.
  const [engine, setEngine] = useState<EngineMode>("basic");
  // startRecording이 최신 엔진을 읽도록 ref 미러(콜백 의존성 churn 방지)
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const [state, dispatch] = useReducer(reducer, {
    chairs: initialChairs,
    openChairId: null,
    recording: {},
    unlinkedCounts: {},
    participants: {},
  });

  // 마운트 시 DB에서 미연결 기록 수 초기 로드 — 다른 기기/계정에서도 체어 상태 동기화
  useEffect(() => {
    for (const chair of initialChairs) {
      getUnlinkedChairRecords(chair.id).then((records) => {
        dispatch({ type: "SET_UNLINKED_COUNT", chairId: chair.id, count: records.length });
        if (records.length > 0) {
          dispatch({ type: "SET_STATUS", chairId: chair.id, status: "has_records" });
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MediaRecorder refs keyed by chairId — survive overlay close
  const mediaRefsMap = useRef<Record<string, MediaRefs>>({});

  const getMediaRefs = (chairId: string): MediaRefs => {
    if (!mediaRefsMap.current[chairId]) {
      mediaRefsMap.current[chairId] = {
        mediaRecorder: null,
        chunks: [],
        segments: [],
        segmentTimer: null,
        stream: null,
        mimeType: "",
        chunked: false,
        userStopping: false,
        onSegmentsReady: null,
        onSegmentReady: null,
      };
    }
    return mediaRefsMap.current[chairId];
  };

  // ── Screen Wake Lock ──────────────────────────────────────────────
  // 모바일은 화면이 잠기면 마이크 스트림·MediaRecorder를 OS가 정지시켜
  // 녹음이 손상된다. 녹음 중에는 화면 꺼짐을 막는다.
  const wakeLockRef = useRef<WakeLockLike | null>(null);
  const wantWakeLockRef = useRef(false);

  const acquireWakeLock = useCallback(async () => {
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;
    try {
      wakeLockRef.current = await nav.wakeLock.request("screen");
    } catch {
      // 권한 거부/미지원 — 무시 (녹음은 계속)
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wantWakeLockRef.current = false;
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  // 탭이 백그라운드로 갔다 돌아오면 wake lock이 해제되므로 재획득
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && wantWakeLockRef.current && !wakeLockRef.current) {
        acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [acquireWakeLock]);

  const openOverlay = useCallback(
    (chairId: string, participants?: Participant[]) => {
      dispatch({ type: "OPEN_OVERLAY", chairId });
      // 히어로에서 참여자를 함께 넘긴 경우에만 갱신(기존 호출은 영향 없음)
      if (participants) {
        dispatch({ type: "SET_PARTICIPANTS", chairId, participants });
      }
    },
    [],
  );

  const closeOverlay = useCallback(() => {
    dispatch({ type: "CLOSE_OVERLAY" });
  }, []);

  const getChairStatus = useCallback(
    (chairId: string): ChairStatus =>
      state.recording[chairId]?.status ?? "idle",
    [state.recording],
  );

  const getParticipants = useCallback(
    (chairId: string): Participant[] => state.participants[chairId] ?? [],
    [state.participants],
  );

  const getTranscribedText = useCallback(
    (chairId: string) => state.recording[chairId]?.transcribedText ?? "",
    [state.recording],
  );

  const getSavedConsultationId = useCallback(
    (chairId: string) => state.recording[chairId]?.savedConsultationId ?? null,
    [state.recording],
  );

  const startRecording = useCallback(
    async (chairId: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        const refs = getMediaRefs(chairId);
        refs.stream = stream;
        refs.mimeType = mimeType;
        refs.segments = [];
        refs.userStopping = false;
        refs.onSegmentsReady = null;
        refs.onSegmentReady = null;
        if (refs.segmentTimer) {
          clearInterval(refs.segmentTimer);
          refs.segmentTimer = null;
        }
        // 청크(긴 상담) 모드면 분할 녹음 — 구간마다 stop→onstop이 다음 구간 시작(spec 010).
        const chunked = engineRef.current === "chunk";
        refs.chunked = chunked;

        // 음성용 저비트레이트(~32kbps ≈ 0.25MB/분). 긴 상담도 용량·메모리 안전(spec 009).
        const newRecorder = () => {
          const recorder = new MediaRecorder(stream, {
            mimeType,
            audioBitsPerSecond: 32000,
          });
          refs.chunks = [];
          refs.mediaRecorder = recorder;
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) refs.chunks.push(e.data);
          };
          if (chunked) {
            recorder.onstop = () => {
              const blob = new Blob(refs.chunks, { type: mimeType });
              if (blob.size > 0) {
                refs.segments.push(blob);
                // spec 016 — 구간 완료 즉시 통지(녹음 중 구간·마지막 구간 모두). 보드가 백그라운드 전사.
                refs.onSegmentReady?.(blob, refs.segments.length - 1);
              }
              refs.chunks = [];
              if (!refs.userStopping) {
                newRecorder(); // 다음 구간 시작
              } else {
                // 사용자 종료 — 스트림 정리 후 구간 배열 resolve
                refs.stream?.getTracks().forEach((t) => t.stop());
                refs.stream = null;
                refs.mediaRecorder = null;
                const done = refs.onSegmentsReady;
                refs.onSegmentsReady = null;
                done?.(refs.segments);
              }
            };
          } else {
            recorder.onerror = () => {
              // 백그라운드/잠금으로 OS가 녹음을 끊은 경우 등 — 트랙 정리
              recorder.stream.getTracks().forEach((t) => t.stop());
            };
          }
          recorder.start(250);
        };
        newRecorder();

        if (chunked) {
          // 일정 간격마다 현재 구간을 끊는다(stop→onstop이 다음 구간을 시작).
          refs.segmentTimer = setInterval(() => {
            if (refs.mediaRecorder && refs.mediaRecorder.state === "recording") {
              refs.mediaRecorder.stop();
            }
          }, CHUNK_SEGMENT_MS);
        }

        // 녹음 중 화면 꺼짐 방지 (모바일 잠금으로 인한 녹음 손상 방지)
        wantWakeLockRef.current = true;
        void acquireWakeLock();
        dispatch({ type: "SET_STATUS", chairId, status: "recording" });
        return { ok: true };
      } catch {
        return { ok: false, error: "마이크 접근 권한이 필요합니다." };
      }
    },
    [acquireWakeLock],
  );

  const stopRecording = useCallback((chairId: string): Blob | null => {
    releaseWakeLock();
    const refs = mediaRefsMap.current[chairId];
    if (!refs?.mediaRecorder) return null;

    dispatch({ type: "SET_STATUS", chairId, status: "processing" });

    const mimeType = refs.mediaRecorder.mimeType;
    refs.mediaRecorder.stop();
    refs.mediaRecorder.stream.getTracks().forEach((t) => t.stop());
    refs.mediaRecorder = null;

    const blob = new Blob(refs.chunks, { type: mimeType });
    refs.chunks = [];
    return blob;
  }, [releaseWakeLock]);

  // 청크(긴 상담) 종료 — 마지막 구간 flush 후 구간 blob 배열을 반환(spec 010).
  const stopRecordingChunked = useCallback(
    (chairId: string): Promise<Blob[]> => {
      releaseWakeLock();
      const refs = mediaRefsMap.current[chairId];
      if (!refs?.mediaRecorder || !refs.chunked) {
        return Promise.resolve(refs?.segments ?? []);
      }
      dispatch({ type: "SET_STATUS", chairId, status: "processing" });
      if (refs.segmentTimer) {
        clearInterval(refs.segmentTimer);
        refs.segmentTimer = null;
      }
      refs.userStopping = true;
      return new Promise<Blob[]>((resolve) => {
        refs.onSegmentsReady = resolve;
        try {
          refs.mediaRecorder?.stop(); // onstop이 마지막 구간 push 후 resolve
        } catch {
          resolve(refs.segments);
        }
      });
    },
    [releaseWakeLock],
  );

  // 일시정지 — MediaRecorder.pause()로 스트림 유지한 채 데이터 수집만 멈춘다.
  // 청크 모드는 구간 회전 타이머를 함께 꺼야 일시정지 중 구간이 잘리지 않는다.
  const pauseRecording = useCallback((chairId: string) => {
    const refs = mediaRefsMap.current[chairId];
    if (!refs?.mediaRecorder || refs.mediaRecorder.state !== "recording") return;
    if (refs.segmentTimer) {
      clearInterval(refs.segmentTimer);
      refs.segmentTimer = null;
    }
    try {
      refs.mediaRecorder.pause();
    } catch {
      return; // pause 미지원/실패 — 상태 전환하지 않음(계속 녹음)
    }
    dispatch({ type: "SET_STATUS", chairId, status: "paused" });
  }, []);

  // 재개 — resume() 후 청크 구간 회전 타이머 복원. 누적 chunks는 그대로 이어진다.
  const resumeRecording = useCallback((chairId: string) => {
    const refs = mediaRefsMap.current[chairId];
    if (!refs?.mediaRecorder || refs.mediaRecorder.state !== "paused") return;
    try {
      refs.mediaRecorder.resume();
    } catch {
      return;
    }
    if (refs.chunked && !refs.segmentTimer) {
      refs.segmentTimer = setInterval(() => {
        if (refs.mediaRecorder && refs.mediaRecorder.state === "recording") {
          refs.mediaRecorder.stop();
        }
      }, CHUNK_SEGMENT_MS);
    }
    dispatch({ type: "SET_STATUS", chairId, status: "recording" });
  }, []);

  const registerSegmentHandler = useCallback(
    (chairId: string, cb: ((seg: Blob, index: number) => void) | null) => {
      getMediaRefs(chairId).onSegmentReady = cb;
    },
    [],
  );

  const setTranscriptionResult = useCallback(
    (chairId: string, text: string) => {
      dispatch({ type: "SET_TRANSCRIPTION", chairId, text });
    },
    [],
  );

  const setSavedConsultationId = useCallback(
    (chairId: string, consultationId: string) => {
      dispatch({ type: "SET_SAVED_ID", chairId, consultationId });
    },
    [],
  );

  const resetChair = useCallback((chairId: string) => {
    // 청크 잔여물 정리(타이머·구간 배열) — 다음 녹음에 누수 방지
    const refs = mediaRefsMap.current[chairId];
    if (refs) {
      if (refs.segmentTimer) {
        clearInterval(refs.segmentTimer);
        refs.segmentTimer = null;
      }
      refs.segments = [];
    }
    dispatch({ type: "RESET_CHAIR", chairId });
  }, []);

  // ── spec 027 ④ — 이어서 상담 프리필(ref 핸드오프, 1회 소비) ──────
  const boardPrefillRef = useRef<BoardPrefill | null>(null);
  const openBoardWithPrefill = useCallback((prefill: BoardPrefill) => {
    boardPrefillRef.current = prefill;
    dispatch({ type: "OPEN_OVERLAY", chairId: DRAFT_CHAIR_KEY });
  }, []);
  const consumeBoardPrefill = useCallback(() => {
    const p = boardPrefillRef.current;
    boardPrefillRef.current = null;
    return p;
  }, []);

  // ── spec 027 — 세션 안전망 지원 ─────────────────────────────────
  const autoFinalizeMap = useRef<Record<string, (() => void) | null>>({});

  const registerAutoFinalize = useCallback((chairId: string, cb: (() => void) | null) => {
    autoFinalizeMap.current[chairId] = cb;
  }, []);

  const runAutoFinalize = useCallback((chairId: string): boolean => {
    const cb = autoFinalizeMap.current[chairId];
    if (!cb) return false;
    cb();
    return true;
  }, []);

  const getStartedAt = useCallback(
    (chairId: string) => state.recording[chairId]?.startedAt ?? null,
    [state.recording],
  );

  const getStream = useCallback(
    (chairId: string) => mediaRefsMap.current[chairId]?.stream ?? null,
    [],
  );

  const activeRecordingKeys = Object.entries(state.recording)
    .filter(([, v]) => v.status === "recording" || v.status === "paused")
    .map(([k]) => k);

  const refreshUnlinkedCount = useCallback(async (chairId: string) => {
    const records = await getUnlinkedChairRecords(chairId);
    dispatch({
      type: "SET_UNLINKED_COUNT",
      chairId,
      count: records.length,
    });
    if (records.length > 0) {
      dispatch({ type: "SET_STATUS", chairId, status: "has_records" });
    } else {
      const currentStatus = state.recording[chairId]?.status;
      if (currentStatus === "has_records") {
        dispatch({ type: "SET_STATUS", chairId, status: "idle" });
      }
    }
  }, [state.recording]);

  const value: ChairContextValue = {
    chairs: state.chairs,
    members,
    me,
    openChairId: state.openChairId,
    openOverlay,
    closeOverlay,
    getParticipants,
    getChairStatus,
    getTranscribedText,
    getSavedConsultationId,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    stopRecordingChunked,
    registerSegmentHandler,
    setTranscriptionResult,
    setSavedConsultationId,
    resetChair,
    unlinkedCounts: state.unlinkedCounts,
    refreshUnlinkedCount,
    labEnabled,
    engine,
    setEngine,
    activeRecordingKeys,
    getStartedAt,
    getStream,
    registerAutoFinalize,
    runAutoFinalize,
    openBoardWithPrefill,
    consumeBoardPrefill,
  };

  return <ChairContext.Provider value={value}>{children}</ChairContext.Provider>;
}
