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
import type { EngineMode } from "@/lib/transcribe/engines";
import { getUnlinkedChairRecords } from "@/app/actions/chairs";

export type ChairStatus = "idle" | "recording" | "processing" | "has_records";

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
  stopRecording: (chairId: string) => Blob | null;
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
        // 음성용 저비트레이트(~32kbps ≈ 0.25MB/분). 긴 상담(예 18분≈4.5MB)도
        // 서버액션 bodySizeLimit·메모리·업로드 시간 안에 들어오게 한다(spec 009 결정).
        const recorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: 32000,
        });
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
    stopRecording,
    setTranscriptionResult,
    setSavedConsultationId,
    resetChair,
    unlinkedCounts: state.unlinkedCounts,
    refreshUnlinkedCount,
    labEnabled,
    engine,
    setEngine,
  };

  return <ChairContext.Provider value={value}>{children}</ChairContext.Provider>;
}
