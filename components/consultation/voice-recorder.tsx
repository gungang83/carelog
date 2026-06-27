"use client";

import { useCallback, useRef, useState } from "react";
import { transcribeAndSummarize } from "@/app/actions/transcribe";

type Status = "idle" | "recording" | "processing" | "error";

interface VoiceRecorderProps {
  onResult: (text: string) => void;
}

export function VoiceRecorder({ onResult }: VoiceRecorderProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      // 음성용 저비트레이트(~32kbps ≈ 0.25MB/분) — 긴 녹음 용량·업로드 안정화(spec 009).
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 32000,
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(250);
      mediaRef.current = recorder;
      setStatus("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setErrorMsg("마이크 접근 권한이 필요합니다.");
      setStatus("error");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!mediaRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus("processing");

    mediaRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mediaRef.current!.mimeType });
      mediaRef.current!.stream.getTracks().forEach((t) => t.stop());

      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const result = await transcribeAndSummarize(formData);
      if (result.ok) {
        onResult(result.summary);
        setStatus("idle");
        setElapsed(0);
      } else {
        setErrorMsg(result.message);
        setStatus("error");
      }
    };
    mediaRef.current.stop();
  }, [onResult]);

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (status === "idle" || status === "error") {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={startRecording}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <MicIcon className="size-4 text-slate-500" />
          음성으로 기록
        </button>
        {status === "error" && errorMsg && (
          <p className="text-xs text-red-500">{errorMsg}</p>
        )}
      </div>
    );
  }

  if (status === "recording") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
        <span className="inline-block size-2.5 animate-pulse rounded-full bg-red-500" />
        <span className="text-sm font-medium text-red-700">녹음 중 {fmtTime(elapsed)}</span>
        <button
          type="button"
          onClick={stopRecording}
          className="ml-auto rounded-lg bg-red-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-600"
        >
          중지 및 변환
        </button>
      </div>
    );
  }

  // processing
  return (
    <div className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-700">
      <span className="inline-block size-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
      음성 인식 및 요약 중…
    </div>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V4Z" />
      <path
        fillRule="evenodd"
        d="M5.5 10.5a.75.75 0 0 0-1.5 0 6 6 0 0 0 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.046A6 6 0 0 0 15.5 10.5a.75.75 0 0 0-1.5 0 4.5 4.5 0 0 1-9 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
