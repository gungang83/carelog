"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { translateUtterance, recordInterpretUsage } from "@/app/actions/interpret";
import { INTERPRET_CREDIT_PER_MIN } from "@/lib/transcribe/engines";

// spec 030 — 실시간 통역 스테이지(PoC · 실험실 전용).
// 환자와 화면을 같이 보는 전체화면: 말하는 중 원문 자막(스트리밍) + 문장 확정 시 번역이 뒤따른다.
// 파이프: ChairProvider 마이크 스트림 분기 → PCM16 24kHz → OpenAI Realtime(전사 세션, ephemeral)
//        → 확정 문장마다 translateUtterance(Claude Haiku) → 쌍 누적 → "기록에 담기"로 에디터 삽입.
// ⚠️ 스트림은 읽기 전용 분기 — 기존 MediaRecorder 녹음은 그대로 계속된다(사후 전사 안전망).

type Utterance = {
  id: number;
  original: string;
  translated?: string; // 번역 도착 전 undefined
  failed?: boolean;
};

type Status = "connecting" | "live" | "error" | "closed";

export function InterpreterStage({
  stream,
  onInsert,
  onClose,
}: {
  stream: MediaStream | null;
  onInsert: (text: string) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>("connecting");
  const [errorMsg, setErrorMsg] = useState("");
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [partial, setPartial] = useState(""); // 말하는 중 스트리밍 원문
  const [elapsed, setElapsed] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const idRef = useRef(0);
  const startTsRef = useRef(Date.now());
  const settledRef = useRef(false); // 크레딧 정산 1회 보장
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 경과 타이머
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTsRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // 새 자막 도착 시 아래로 자동 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [utterances, partial]);

  const teardown = useCallback(() => {
    try { processorRef.current?.disconnect(); } catch {}
    try { sourceRef.current?.disconnect(); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    try { wsRef.current?.close(); } catch {}
    processorRef.current = null;
    sourceRef.current = null;
    audioCtxRef.current = null;
    wsRef.current = null;
  }, []);

  const settleCredits = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    const minutes = Math.max(1, Math.round((Date.now() - startTsRef.current) / 60000));
    void recordInterpretUsage(minutes);
  }, []);

  // 연결 + 오디오 펌프. stream이 없으면(녹음 전) 에러 표시.
  useEffect(() => {
    if (!stream) {
      setStatus("error");
      setErrorMsg("활성 마이크가 없습니다. 녹음을 먼저 시작해 주세요.");
      return;
    }
    let cancelled = false;

    (async () => {
      // 1) ephemeral secret
      let secret: string;
      try {
        const res = await fetch("/api/realtime/token", { method: "POST" });
        const data = (await res.json()) as { ok: boolean; clientSecret?: string; message?: string };
        if (!data.ok || !data.clientSecret) throw new Error(data.message ?? "토큰 발급 실패");
        secret = data.clientSecret;
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : "토큰 발급 실패");
        return;
      }
      if (cancelled) return;

      // 2) WebSocket (브라우저 표준 패턴 — 서브프로토콜에 ephemeral key 운반)
      const ws = new WebSocket("wss://api.openai.com/v1/realtime?intent=transcription", [
        "realtime",
        `openai-insecure-api-key.${secret}`,
      ]);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setStatus("live");
        // 3) 오디오 펌프 — 스트림 분기 → PCM16 24kHz
        try {
          const ctx = new AudioContext({ sampleRate: 24000 });
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          sourceRef.current = source;
          const processor = ctx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;
          processor.onaudioprocess = (ev) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const input = ev.inputBuffer.getChannelData(0);
            const pcm = new Int16Array(input.length);
            for (let i = 0; i < input.length; i++) {
              const s = Math.max(-1, Math.min(1, input[i]));
              pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
            let bin = "";
            const bytes = new Uint8Array(pcm.buffer);
            for (let i = 0; i < bytes.length; i += 8192) {
              bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
            }
            ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: btoa(bin) }));
          };
          source.connect(processor);
          processor.connect(ctx.destination); // Chrome은 연결해야 onaudioprocess 발화(출력은 무음)
        } catch (e) {
          setStatus("error");
          setErrorMsg(`오디오 처리 실패: ${e instanceof Error ? e.message : "오류"}`);
        }
      };

      ws.onmessage = (msg) => {
        if (cancelled) return;
        let e: { type?: string; delta?: string; transcript?: string; error?: { message?: string } };
        try {
          e = JSON.parse(msg.data as string);
        } catch {
          return;
        }
        const t = e.type ?? "";
        // 전사 스트리밍(부분) / 확정 — 베타·GA 이벤트명 차이를 접미사 매칭으로 흡수
        if (t.endsWith("input_audio_transcription.delta") && e.delta) {
          setPartial((p) => p + e.delta);
        } else if (t.endsWith("input_audio_transcription.completed")) {
          const original = (e.transcript ?? "").trim();
          setPartial("");
          if (!original) return;
          const id = ++idRef.current;
          setUtterances((u) => [...u, { id, original }]);
          // 문장 단위 번역(한영 혼용 포함) — 도착 순서대로 채움
          translateUtterance(original).then((r) => {
            setUtterances((u) =>
              u.map((x) =>
                x.id === id
                  ? r.ok
                    ? { ...x, translated: r.translated }
                    : { ...x, failed: true }
                  : x,
              ),
            );
          });
        } else if (t === "error") {
          setStatus("error");
          setErrorMsg(e.error?.message ?? "실시간 연결 오류");
        }
      };

      ws.onerror = () => {
        if (cancelled) return;
        setStatus((s) => (s === "live" || s === "connecting" ? "error" : s));
        setErrorMsg((m) => m || "실시간 연결이 끊어졌습니다. 녹음은 계속되고 있으니 사후 다국어 전사로 보완됩니다.");
      };
      ws.onclose = () => {
        if (cancelled) return;
        setStatus((s) => (s === "live" ? "closed" : s));
      };
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [stream, teardown]);

  function fmt(sec: number): string {
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  }

  function buildInsertText(): string {
    const d = new Date(startTsRef.current);
    const stamp = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const lines = utterances.map((u) =>
      u.translated ? `원문: ${u.original}\n번역: ${u.translated}` : `원문: ${u.original}`,
    );
    return `[실시간 통역 — ${stamp} · ${Math.max(1, Math.round(elapsed / 60))}분]\n\n${lines.join("\n\n")}`;
  }

  function handleInsertAndClose() {
    if (utterances.length > 0) onInsert(buildInsertText());
    settleCredits();
    teardown();
    onClose();
  }

  function handleCloseOnly() {
    settleCredits();
    teardown();
    onClose();
  }

  const statusDot =
    status === "live" ? "bg-emerald-400" : status === "connecting" ? "bg-amber-400 animate-pulse" : "bg-red-400";
  const statusLabel =
    status === "live" ? "통역 중" : status === "connecting" ? "연결 중…" : status === "closed" ? "연결 종료" : "오류";

  return createPortal(
    <div className="fixed inset-0 z-[300] flex flex-col bg-slate-900 text-white">
      {/* 헤더 */}
      <div className="flex items-center gap-3 border-b border-slate-700 px-5 py-3">
        <span className={`size-2.5 rounded-full ${statusDot}`} />
        <span className="text-sm font-bold">🌐 실시간 통역</span>
        <span className="rounded bg-violet-500/30 px-1.5 py-0.5 text-[10px] font-bold text-violet-200">
          실험실 PoC
        </span>
        <span className="text-sm text-slate-400">{statusLabel} · {fmt(elapsed)}</span>
        <span className="ml-auto text-[11px] text-slate-500">
          분당 {INTERPRET_CREDIT_PER_MIN} 크레딧 · 녹음은 계속 저장됩니다
        </span>
      </div>

      {errorMsg && (
        <p className="border-b border-red-900 bg-red-950/60 px-5 py-2 text-sm text-red-300">{errorMsg}</p>
      )}

      {/* 대화 누적 — 환자와 같이 보는 화면이라 크게 */}
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-6 py-5 sm:px-10">
        {utterances.length === 0 && !partial && status === "live" && (
          <p className="mt-10 text-center text-lg text-slate-500">
            말씀하시면 이 화면에 원문과 번역이 실시간으로 표시됩니다
          </p>
        )}
        {utterances.map((u) => (
          <div key={u.id}>
            <p className="text-xl font-medium leading-relaxed text-slate-100 sm:text-2xl">{u.original}</p>
            {u.translated ? (
              <p className="mt-1 text-xl font-semibold leading-relaxed text-emerald-300 sm:text-2xl">
                {u.translated}
              </p>
            ) : u.failed ? (
              <p className="mt-1 text-sm text-red-400">번역 실패 — 원문만 기록됩니다</p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">번역 중…</p>
            )}
          </div>
        ))}
        {partial && (
          <p className="text-xl leading-relaxed text-sky-300 sm:text-2xl">
            {partial}
            <span className="ml-1 inline-block h-5 w-0.5 animate-pulse bg-sky-300 align-middle" />
          </p>
        )}
      </div>

      {/* 푸터 */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-700 px-5 py-3">
        <p className="mr-auto text-[11px] leading-snug text-slate-500">
          통역은 보조 도구입니다 — 기록에 담은 뒤 내용을 확인해 주세요.
        </p>
        <button
          type="button"
          onClick={handleCloseOnly}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
        >
          닫기 (담지 않음)
        </button>
        <button
          type="button"
          onClick={handleInsertAndClose}
          disabled={utterances.length === 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          기록에 담고 닫기
        </button>
      </div>
    </div>,
    document.body,
  );
}
