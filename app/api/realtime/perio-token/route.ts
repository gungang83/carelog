import { NextResponse } from "next/server";
import { getMyInstitutionId } from "@/lib/auth/institution";
import { getPerioVoiceConfig, parseCorrections } from "@/lib/oral/perio-voice-config";

// spec 040 §5-3 — 잇몸 기록 말로 입력: OpenAI Realtime(전사 세션) 단기 시크릿 발급.
//   서버 키는 브라우저에 내보내지 않는다 — 10분짜리 시크릿만. 로그인한 기관 멤버만.
//   모델·용어 힌트·보정 낱말 = 슈퍼어드민 → 말로 기록 보정(platform_settings 'perio_voice').
//   ★언어를 한국어로 묶지 않는다 — "13번 mesial부터 distal"처럼 한·영 섞어 말하므로(묶으면 영어 용어를 엉뚱한 한국어로 들음).
//   ⚠️ 힌트는 문장이 아닌 낱말 목록·숫자 없이 — 조용할 때 힌트를 "말한 것"처럼 돌려주는 일이 있어(2026-11-18) 화면에서 걸러낸다.

export async function POST() {
  const cfg = await getPerioVoiceConfig();
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === "your_openai_api_key_here") {
    return NextResponse.json({ ok: false, message: "OpenAI API 키가 설정되지 않았습니다." }, { status: 500 });
  }
  try {
    const resp = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "transcription",
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24000 },
              noise_reduction: { type: "near_field" },
              transcription: { model: cfg.model, prompt: cfg.hint },
              // 0.6초 쉬면 한 문장으로 끊는다 · 작은 소리(잡음)는 말로 치지 않게 문턱을 조금 높임
              turn_detection: { type: "server_vad", threshold: 0.6, silence_duration_ms: 600, prefix_padding_ms: 300 },
            },
          },
        },
      }),
    });
    const data = (await resp.json().catch(() => null)) as
      | { value?: string; client_secret?: { value?: string }; error?: { message?: string } }
      | null;
    const secret = data?.value ?? data?.client_secret?.value;
    if (!resp.ok || !secret) {
      const msg = data?.error?.message ?? `토큰 발급 실패 (HTTP ${resp.status})`;
      console.error("[realtime/perio-token] mint failed:", msg);
      return NextResponse.json({ ok: false, message: msg }, { status: 502 });
    }
    return NextResponse.json({ ok: true, clientSecret: secret, model: cfg.model, hint: cfg.hint, corrections: parseCorrections(cfg.corrections) });
  } catch (e) {
    console.error("[realtime/perio-token] error:", e);
    return NextResponse.json({ ok: false, message: "토큰 발급 중 오류가 발생했습니다." }, { status: 500 });
  }
}
