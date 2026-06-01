"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { ChairRow } from "@/lib/types/database";
import { getUnlinkedChairRecords } from "@/app/actions/chairs";

export type ChairStatus = "idle" | "recording" | "processing" | "has_records";

type ChairRecordingState = {
  status: ChairStatus;
  transcribedText: string;
  savedConsultationId: string | null;
};

type ChairState = {
  chairs: ChairRow[];
  openChairId: string | null;
  recording: Record<string, ChairRecordingState>;
  unlinkedCounts: Record<string, number>;
};

type ChairAction =
  | { type: "OPEN_OVERLAY"; chairId: string }
  | { type: "CLOSE_OVERLAY" }
  | { type: "SET_STATUS"; chairId: string; status: ChairStatus }
  | { type: "SET_TRANSCRIPTION"; chairId: string; text: string }
  | { type: "SET_SAVED_ID"; chairId: string; consultationId: string }
  | { type: "SET_UNLINKED_COUNT"; chairId: string; count: number }
  | { type: "RESET_CHAIR"; chairId: string };

function getDefaultRecording(): ChairRecordingState {
  return { status: "idle", transcribedText: "", savedConsultationId: null };
}

function reducer(state: ChairState, action: ChairAction): ChairState {
  switch (action.type) {
    case "OPEN_OVERLAY":
      return { ...state, openChairId: action.chairId };
    case "CLOSE_OVERLAY":
      return { ...state, openChairId: null };
    case "SET_STATUS": {
      const prev = state.recording[action.chairId] ?? getDefaultRecording();
      return {
        ...state,
        recording: {
          ...state.recording,
          [action.chairId]: { ...prev, status: action.status },
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
    case "RESET_CHAIR":
      return {
        ...state,
        recording: {
          ...state.recording,
          [action.chairId]: getDefaultRecording(),
        },
        unlinkedCounts: { ...state.unlinkedCounts, [action.chairId]: 0 },
      };
    default:
      return state;
  }
}

type MediaRefs = {
  mediaRecorder: MediaRecorder | null;
  chunks: Blob[];
};

// Wake Lock API 타입 (tsconfig lib에 없을 수 있어 최소 정의)
type WakeLockLike = { release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
};

type ChairContextValue = {
  chairs: ChairRow[];
  openChairId: string | null;
  openOverlay: (chairId: string) => void;
  closeOverlay: () => void;
  getChairStatus: (chairId: string) => ChairStatus;
  getTranscribedText: (chairId: string) => string;
  getSavedConsultationId: (chairId: string) => string | null;
  startRecording: (chairId: string) => Promise<{ ok: boolean; error?: string }>;
  stopRecording: (chairId: string) => Blob | null;
  setTranscriptionResult: (chairId: string, text: string) => void;
  setSavedConsultationId: (chairId: string, consultationId: string) => void;
  resetChair: (chairId: string) => void;
  unlinkedCounts: Record<string, number>;
  refreshUnlinkedCount: (chairId: string) => Promise<void>;
};

const ChairContext = createContext<ChairContextValue | null>(null);

export function useChairContext() {
  const ctx = useContext(ChairContext);
  if (!ctx) throw new Error("useChairContext must be used within ChairProvider");
  return ctx;
}

export function ChairProvider({
  initialChairs,
  children,
}: {
  initialChairs: ChairRow[];
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    chairs: initialChairs,
    openChairId: null,
    recording: {},
    unlinkedCounts: {},
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
      mediaRefsMap.current[chairId] = { mediaRecorder: null, chunks: [] };
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

  const openOverlay = useCallback((chairId: string) => {
    dispatch({ type: "OPEN_OVERLAY", chairId });
  }, []);

  const closeOverlay = useCallback(() => {
    dispatch({ type: "CLOSE_OVERLAY" });
  }, []);

  const getChairStatus = useCallback(
    (chairId: string): ChairStatus =>
      state.recording[chairId]?.status ?? "idle",
    [state.recording],
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
        const recorder = new MediaRecorder(stream, { mimeType });
        const refs = getMediaRefs(chairId);
        refs.chunks = [];
        refs.mediaRecorder = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) refs.chunks.push(e.data);
        };
        recorder.onerror = () => {
          // 백그라운드/잠금으로 OS가 녹음을 끊은 경우 등 — 트랙 정리
          recorder.stream.getTracks().forEach((t) => t.stop());
        };
        recorder.start(250);
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
    dispatch({ type: "RESET_CHAIR", chairId });
  }, []);

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
    openChairId: state.openChairId,
    openOverlay,
    closeOverlay,
    getChairStatus,
    getTranscribedText,
    getSavedConsultationId,
    startRecording,
    stopRecording,
    setTranscriptionResult,
    setSavedConsultationId,
    resetChair,
    unlinkedCounts: state.unlinkedCounts,
    refreshUnlinkedCount,
  };

  return <ChairContext.Provider value={value}>{children}</ChairContext.Provider>;
}
