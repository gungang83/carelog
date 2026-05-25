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
        recorder.start(250);
        dispatch({ type: "SET_STATUS", chairId, status: "recording" });
        return { ok: true };
      } catch {
        return { ok: false, error: "마이크 접근 권한이 필요합니다." };
      }
    },
    [],
  );

  const stopRecording = useCallback((chairId: string): Blob | null => {
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
  }, []);

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
