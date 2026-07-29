"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getMyInstitutionLab, getMyInstitutionId, getSessionUser } from "@/lib/auth/institution";
import { deductCredit } from "@/lib/credits";

// spec 030 — 실시간 통역 PoC 서버 지원.
//   ① translateUtterance: 확정 문장 1개를 번역(Claude Haiku — 속도·단가 우선).
//      방향 자동: 한국어 발화 → 영어 / 그 외(한영 혼용 포함) → 한국어.
//   ② recordInterpretUsage: 세션 종료 시 경과 분으로 크레딧 정산(비차단 — spec 013 원칙).

export type UtteranceTranslation =
  | { ok: true; translated: string; direction: "ko2en" | "any2ko" }
  | { ok: false; message: string };

// 한글 비율로 방향 판정 — 혼용 문장은 주 언어 기준(한글이 40% 이상이면 한국어 발화로 본다).
function isMostlyKorean(text: string): boolean {
  const letters = text.replace(/[\s\d\p{P}]/gu, "");
  if (!letters) return false;
  const hangul = letters.match(/[가-힯]/g)?.length ?? 0;
  return hangul / letters.length >= 0.4;
}

export async function translateUtterance(text: string): Promise<UtteranceTranslation> {
  const lab = await getMyInstitutionLab();
  if (!lab) return { ok: false, message: "실험실 전용 기능입니다." };
  const trimmed = text?.trim();
  if (!trimmed) return { ok: false, message: "빈 발화입니다." };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === "your_anthropic_api_key_here") {
    return { ok: false, message: "Anthropic API 키가 설정되지 않았습니다." };
  }

  const ko = isMostlyKorean(trimmed);
  const target = ko ? "영어" : "한국어";
  try {
    const anthropic = new Anthropic({ apiKey: key });
    const message = await anthropic.messages.create({
      // 실시간 자막 — 문장당 수백 ms 응답이 목표라 Haiku 사용(요약 품질 불필요, 직역 충실).
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `치과 상담 중 발화 한 문장입니다. ${target}로 자연스럽게 번역하세요.
한국어·영어가 섞여 있어도 전체 의미를 ${target} 한 문장으로 옮기세요.
치과 용어(임플란트·크라운·신경치료·bone graft 등)는 정확하게. 번역문만 출력하고 다른 말은 하지 마세요.

${trimmed}`,
        },
      ],
    });
    const block = message.content[0];
    const translated = block.type === "text" ? block.text.trim() : "";
    if (!translated) return { ok: false, message: "번역 결과가 비었습니다." };
    return { ok: true, translated, direction: ko ? "ko2en" : "any2ko" };
  } catch (e) {
    return { ok: false, message: `번역 실패: ${e instanceof Error ? e.message : "오류"}` };
  }
}

/** 통역 세션 종료 정산 — 경과 분(최소 1) × 분당 단가. 비차단(실패 무시). */
export async function recordInterpretUsage(minutes: number): Promise<void> {
  try {
    const lab = await getMyInstitutionLab();
    if (!lab) return;
    const [institutionId, user] = await Promise.all([getMyInstitutionId(), getSessionUser()]);
    if (!institutionId || !user?.email) return;
    await deductCredit(institutionId, "interpret_realtime", user.email, {
      units: Math.max(1, Math.round(minutes)),
      memo: `실시간 통역 ${Math.max(1, Math.round(minutes))}분`,
    });
  } catch {
    /* 정산 실패는 상담 흐름에 영향 없음 */
  }
}
