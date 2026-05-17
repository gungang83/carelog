"use server";

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export type TranscribeResult =
  | { ok: true; transcription: string; summary: string }
  | { ok: false; message: string };

export async function transcribeAndSummarize(
  formData: FormData,
): Promise<TranscribeResult> {
  const audioFile = formData.get("audio") as File | null;
  if (!audioFile || audioFile.size === 0) {
    return { ok: false, message: "녹음 파일이 없습니다." };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!openaiKey || openaiKey === "your_openai_api_key_here") {
    return { ok: false, message: "OpenAI API 키가 설정되지 않았습니다." };
  }
  if (!anthropicKey || anthropicKey === "your_anthropic_api_key_here") {
    return { ok: false, message: "Anthropic API 키가 설정되지 않았습니다." };
  }

  // 1. Whisper STT
  let transcription: string;
  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "ko",
      response_format: "text",
    });
    transcription = typeof response === "string" ? response : (response as { text: string }).text;
    if (!transcription?.trim()) {
      return { ok: false, message: "음성을 인식하지 못했습니다. 다시 녹음해 주세요." };
    }
  } catch (e) {
    return {
      ok: false,
      message: `음성 인식 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`,
    };
  }

  // 2. Claude 요약
  let summary: string;
  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `다음은 치과 상담 녹취록입니다. 핵심 내용을 자연스러운 상담 기록 형태로 요약해주세요.
환자 증상, 진찰 소견, 처치 내용, 처방/권고 사항을 중심으로 간결하게 작성하되, 원문에 없는 내용은 추가하지 마세요.

[녹취록]
${transcription}`,
        },
      ],
    });
    const block = message.content[0];
    summary = block.type === "text" ? block.text : transcription;
  } catch (e) {
    // 요약 실패 시 전사 텍스트를 그대로 반환
    summary = transcription;
  }

  return { ok: true, transcription, summary };
}
