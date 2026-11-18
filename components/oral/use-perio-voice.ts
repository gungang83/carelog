"use client";

// spec 040 §5-3 — 잇몸 기록 말로 입력: 마이크 → PCM16 24kHz → OpenAI Realtime(전사 세션, 단기 시크릿).
//   실시간 통역(spec 030 interpreter-stage)과 같은 연결 방식. 이 화면 전용 마이크를 따로 연다(상담 녹음과 별개).
//   한 마디가 끝날 때마다(서버 VAD) onFinal(문장) — 해석·기록은 부르는 쪽이.
import { useCallback, useEffect, useRef, useState } from "react";
import { recordPerioVoiceUsage } from "@/app/actions/perio-voice";

export type VoiceStatus = "off" | "connecting" | "live" | "error";

/** 조용할 때·잡음에 전사 모델이 지어내는 흔한 문장(무시) — 영상 자막투·힌트 되풀이 */
const HALLUCINATION = /시청해\s*주셔서|구독|좋아요|MBC|KBS|SBS|뉴스입니다|자막|치주 검사 기록|11~48|예:\s*\d/;

export function usePerioVoice(onFinal: (text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>("off");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState("");
  /** 마이크 소리 크기 0~1(말하고 있는지 눈으로 확인) */
  const [level, setLevel] = useState(0);
  const levelRef = useRef(0);
  const meter = useRef<ReturnType<typeof setInterval> | null>(null);
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  const ws = useRef<WebSocket | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const proc = useRef<ScriptProcessorNode | null>(null);
  const src = useRef<MediaStreamAudioSourceNode | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const started = useRef(0);
  const model = useRef("gpt-4o-transcribe");
  const alive = useRef(false);

  const teardown = useCallback(() => {
    alive.current = false;
    try {
      proc.current?.disconnect();
    } catch {}
    try {
      src.current?.disconnect();
    } catch {}
    try {
      void ctx.current?.close();
    } catch {}
    try {
      ws.current?.close();
    } catch {}
    mic.current?.getTracks().forEach((t) => t.stop());
    if (meter.current) clearInterval(meter.current);
    meter.current = null;
    levelRef.current = 0;
    setLevel(0);
    proc.current = src.current = ctx.current = ws.current = mic.current = null;
    if (started.current) {
      const sec = (Date.now() - started.current) / 1000;
      started.current = 0;
      void recordPerioVoiceUsage(sec, model.current);
    }
  }, []);

  const stop = useCallback(() => {
    teardown();
    setPartial("");
    setStatus("off");
  }, [teardown]);

  const start = useCallback(async () => {
    if (alive.current) return;
    alive.current = true;
    setError("");
    setStatus("connecting");
    const fail = (m: string) => {
      teardown();
      setError(m);
      setStatus("error");
    };
    try {
      mic.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch {
      return fail("마이크를 쓸 수 없어요. 브라우저의 마이크 권한을 확인해 주세요.");
    }
    if (!alive.current) return;
    let secret = "";
    try {
      const r = await fetch("/api/realtime/perio-token", { method: "POST" });
      const d = (await r.json()) as { ok: boolean; clientSecret?: string; model?: string; message?: string };
      if (!d.ok || !d.clientSecret) throw new Error(d.message ?? "연결 준비 실패");
      secret = d.clientSecret;
      if (d.model) model.current = d.model;
    } catch (e) {
      return fail(e instanceof Error ? e.message : "연결 준비 실패");
    }
    if (!alive.current) return;
    const sock = new WebSocket("wss://api.openai.com/v1/realtime?intent=transcription", ["realtime", `openai-insecure-api-key.${secret}`]);
    ws.current = sock;
    sock.onopen = () => {
      if (!alive.current || !mic.current) return;
      started.current = Date.now();
      setStatus("live");
      meter.current = setInterval(() => setLevel(levelRef.current), 120);
      try {
        const ac = new AudioContext({ sampleRate: 24000 });
        ctx.current = ac;
        const source = ac.createMediaStreamSource(mic.current);
        src.current = source;
        const p = ac.createScriptProcessor(4096, 1, 1);
        proc.current = p;
        p.onaudioprocess = (ev) => {
          if (sock.readyState !== WebSocket.OPEN) return;
          const input = ev.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(input.length);
          let sum = 0;
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            sum += s * s;
          }
          levelRef.current = Math.min(1, Math.sqrt(sum / input.length) * 6);
          let bin = "";
          const bytes = new Uint8Array(pcm.buffer);
          for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
          sock.send(JSON.stringify({ type: "input_audio_buffer.append", audio: btoa(bin) }));
        };
        source.connect(p);
        p.connect(ac.destination); // Chrome은 연결해야 onaudioprocess가 돈다(출력은 무음)
      } catch (e) {
        fail(`오디오 처리 실패: ${e instanceof Error ? e.message : "오류"}`);
      }
    };
    sock.onmessage = (msg) => {
      let e: { type?: string; delta?: string; transcript?: string; error?: { message?: string } };
      try {
        e = JSON.parse(msg.data as string);
      } catch {
        return;
      }
      const t = e.type ?? "";
      if (t.endsWith("input_audio_transcription.delta") && e.delta) setPartial((p) => p + e.delta);
      else if (t.endsWith("input_audio_transcription.completed")) {
        setPartial("");
        const text = (e.transcript ?? "").trim();
        if (text && !HALLUCINATION.test(text)) onFinalRef.current(text);
      } else if (t === "error") fail(e.error?.message ?? "실시간 연결 오류");
    };
    sock.onerror = () => {
      if (alive.current) fail("실시간 연결이 끊어졌어요. 다시 눌러 이어서 말해 주세요.");
    };
    sock.onclose = () => {
      if (alive.current) {
        teardown();
        setStatus("off");
      }
    };
  }, [teardown]);

  useEffect(() => () => teardown(), [teardown]);

  /** 개발 중 점검용 — 연결 없이 "듣는 중·자막"을 흉내(배포 빌드에선 쓰지 않음) */
  const simulate = useCallback((text: string) => {
    if (process.env.NODE_ENV === "production") return;
    setStatus("live");
    setPartial(text);
    levelRef.current = 0.5;
    setLevel(0.5);
  }, []);

  return { status, partial, error, level, start, stop, simulate };
}
