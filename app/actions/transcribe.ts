"use server";

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type {
  EngineId,
  EngineMode,
  EngineRun,
  EngineTranscribeResult,
} from "@/lib/transcribe/engines";

// ─── 엔진 레지스트리 (실험실) ────────────────────────────────────────────────
// 공유 타입·상수(EngineId/EngineMode/EngineRun/LAB_ENGINE_OPTIONS)는 lib/transcribe/engines.ts.
// ("use server" 파일은 async 함수만 export 가능 → 런타임 상수는 이 파일에 둘 수 없다.)

export type TranscribeResult =
  | { ok: true; transcription: string; summary: string }
  | { ok: false; message: string };

// ─── 클라이언트 준비 ──────────────────────────────────────────────────────────
function getClients():
  | { ok: true; openai: OpenAI; anthropic: Anthropic }
  | { ok: false; message: string } {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!openaiKey || openaiKey === "your_openai_api_key_here") {
    return { ok: false, message: "OpenAI API 키가 설정되지 않았습니다." };
  }
  if (!anthropicKey || anthropicKey === "your_anthropic_api_key_here") {
    return { ok: false, message: "Anthropic API 키가 설정되지 않았습니다." };
  }
  return {
    ok: true,
    openai: new OpenAI({ apiKey: openaiKey }),
    anthropic: new Anthropic({ apiKey: anthropicKey }),
  };
}

const LANG_LABEL: Record<string, string> = {
  ko: "한국어",
  korean: "한국어",
  en: "영어",
  english: "영어",
  ja: "일본어",
  japanese: "일본어",
  zh: "중국어",
  chinese: "중국어",
};
function langLabel(code?: string): string {
  if (!code) return "원문";
  return LANG_LABEL[code.toLowerCase()] ?? code;
}
function isKorean(code?: string): boolean {
  if (!code) return false;
  const c = code.toLowerCase();
  return c === "ko" || c === "korean";
}

const SUMMARY_PROMPT = (transcript: string) =>
  `다음은 치과 상담 녹취록입니다. 핵심 내용을 자연스러운 상담 기록 형태로 요약해주세요.
환자 증상, 진찰 소견, 처치 내용, 처방/권고 사항을 중심으로 간결하게 작성하되, 원문에 없는 내용은 추가하지 마세요.

[녹취록]
${transcript}`;

// ─── basic 엔진 ───────────────────────────────────────────────────────────────
async function runBasic(
  audioFile: File,
  openai: OpenAI,
  anthropic: Anthropic,
): Promise<{ ok: true; run: EngineRun } | { ok: false; message: string }> {
  let transcription: string;
  try {
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "ko",
      response_format: "text",
    });
    transcription =
      typeof response === "string" ? response : (response as { text: string }).text;
    if (!transcription?.trim()) {
      return { ok: false, message: "음성을 인식하지 못했습니다. 다시 녹음해 주세요." };
    }
  } catch (e) {
    return {
      ok: false,
      message: `음성 인식 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`,
    };
  }

  let summary = transcription;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: SUMMARY_PROMPT(transcription) }],
    });
    const block = message.content[0];
    summary = block.type === "text" ? block.text : transcription;
  } catch {
    summary = transcription;
  }

  return {
    ok: true,
    run: {
      engine: "basic",
      label: "기본모델",
      transcription,
      summary,
      insertText: summary,
    },
  };
}

// ─── multilingual 엔진 (자동 언어감지 + 번역) ────────────────────────────────
async function runMultilingual(
  audioFile: File,
  openai: OpenAI,
  anthropic: Anthropic,
): Promise<{ ok: true; run: EngineRun } | { ok: false; message: string }> {
  // 언어 힌트 없이 전사 → verbose_json으로 감지 언어 확보
  let transcription: string;
  let detectedLang: string | undefined;
  try {
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json",
    });
    const r = response as unknown as { text?: string; language?: string };
    transcription = r.text ?? "";
    detectedLang = r.language;
    if (!transcription.trim()) {
      return { ok: false, message: "음성을 인식하지 못했습니다. 다시 녹음해 주세요." };
    }
  } catch (e) {
    return {
      ok: false,
      message: `음성 인식 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`,
    };
  }

  // 번역 대상: 원문이 한국어가 아니면 한국어로, 한국어면 영어로(양방향 통역 보조)
  const targetIsKorean = !isKorean(detectedLang);
  const targetLabel = targetIsKorean ? "한국어" : "영어";

  // Claude 한 번 호출로 번역 + 한국어 요약을 함께 받는다(마커 파싱)
  let translation = "";
  let summary = transcription;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `다음은 치과 상담 녹취록입니다(원문 언어: ${langLabel(detectedLang)}).
아래 두 가지를 작성하세요. 원문에 없는 내용은 추가하지 마세요. 마커는 그대로 두세요.

[번역]
녹취록 전체를 ${targetLabel}로 자연스럽게 번역.

[요약]
환자 증상·진찰 소견·처치·처방/권고를 중심으로 한국어 상담 기록 형태로 간결하게 요약.

[녹취록]
${transcription}`,
        },
      ],
    });
    const block = message.content[0];
    const text = block.type === "text" ? block.text : "";
    const tMatch = text.match(/\[번역\]\s*([\s\S]*?)\s*\[요약\]/);
    const sMatch = text.match(/\[요약\]\s*([\s\S]*)$/);
    translation = tMatch?.[1]?.trim() ?? "";
    summary = sMatch?.[1]?.trim() || transcription;
  } catch {
    // 번역/요약 실패 시 전사만이라도 보존
    summary = transcription;
  }

  // 에디터 삽입용 정형 텍스트(서범기 안: 원문 위 · 번역 아래)
  const parts = [`[원문 · ${langLabel(detectedLang)}]\n${transcription}`];
  if (translation) parts.push(`[번역 · ${targetLabel}]\n${translation}`);
  parts.push(`[요약]\n${summary}`);
  const insertText = parts.join("\n\n");

  return {
    ok: true,
    run: {
      engine: "multilingual",
      label: "다국어",
      transcription,
      summary,
      translation: translation || undefined,
      detectedLang,
      insertText,
    },
  };
}

async function runEngine(
  engine: EngineId,
  audioFile: File,
  openai: OpenAI,
  anthropic: Anthropic,
) {
  return engine === "multilingual"
    ? runMultilingual(audioFile, openai, anthropic)
    : runBasic(audioFile, openai, anthropic);
}

// ─── 엔진 전사(실험실) — basic/multilingual/comparison ───────────────────────
// 호출자(chairs.transcribeChairAudio)가 lab 게이트로 mode를 결정해 넘긴다.
export async function transcribeEngine(
  formData: FormData,
  mode: EngineMode,
): Promise<EngineTranscribeResult> {
  const audioFile = formData.get("audio") as File | null;
  if (!audioFile || audioFile.size === 0) {
    return { ok: false, message: "녹음 파일이 없습니다." };
  }
  const clients = getClients();
  if (!clients.ok) return { ok: false, message: clients.message };
  const { openai, anthropic } = clients;

  if (mode === "comparison") {
    const [basic, multi] = await Promise.all([
      runBasic(audioFile, openai, anthropic),
      runMultilingual(audioFile, openai, anthropic),
    ]);
    const runs: EngineRun[] = [];
    if (basic.ok) runs.push(basic.run);
    if (multi.ok) runs.push(multi.run);
    if (runs.length === 0) {
      return { ok: false, message: basic.ok ? "" : basic.message };
    }
    return { ok: true, runs };
  }

  const result = await runEngine(mode, audioFile, openai, anthropic);
  if (!result.ok) {
    // 실험 엔진(multilingual) 실패 시 basic으로 자동 폴백 — 실 상담 끊김 방지
    if (mode === "multilingual") {
      const fallback = await runBasic(audioFile, openai, anthropic);
      if (fallback.ok) return { ok: true, runs: [fallback.run] };
    }
    return { ok: false, message: result.message };
  }
  return { ok: true, runs: [result.run] };
}

// ─── 기존 단일 진입점(basic) — voice-recorder 등 비-실험 경로 호환 유지 ───────
export async function transcribeAndSummarize(
  formData: FormData,
): Promise<TranscribeResult> {
  const audioFile = formData.get("audio") as File | null;
  if (!audioFile || audioFile.size === 0) {
    return { ok: false, message: "녹음 파일이 없습니다." };
  }
  const clients = getClients();
  if (!clients.ok) return { ok: false, message: clients.message };
  const result = await runBasic(audioFile, clients.openai, clients.anthropic);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, transcription: result.run.transcription, summary: result.run.summary };
}
