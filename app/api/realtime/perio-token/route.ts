import { NextResponse } from "next/server";
import { getMyInstitutionId } from "@/lib/auth/institution";

// spec 040 §5-3 — 잇몸 기록 말로 입력: OpenAI Realtime(전사 세션) 단기 시크릿 발급.
//   서버 키는 브라우저에 내보내지 않는다 — 10분짜리 시크릿만. 로그인한 기관 멤버만.
//   전사 모델 = env PERIO_STT_MODEL(기본 gpt-4o-transcribe), 한국어(힌트 문장 없음 — 아래 주의).
const PERIO_STT_MODEL = () => process.env.PERIO_STT_MODEL?.trim() || "gpt-4o-transcribe";

// ⚠️ 용어 힌트(prompt)는 넣지 않는다 — 조용할 때 모델이 힌트 문장을 그대로 "말한 것"처럼 돌려줘
//   엉뚱한 칸이 채워졌다(2026-11-18 실사용: 힌트 속 "46번 … 결손"이 기록됨). 숫자·용어는 화면 해석기가 맡는다.

export async function POST() {
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
              transcription: { model: PERIO_STT_MODEL(), language: "ko" },
              // 숫자를 부르다 잠깐 쉬면 한 문장으로 끊는다(짧게 — 바로바로 차트에)
              turn_detection: { type: "server_vad", silence_duration_ms: 450, prefix_padding_ms: 250 },
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
    return NextResponse.json({ ok: true, clientSecret: secret, model: PERIO_STT_MODEL() });
  } catch (e) {
    console.error("[realtime/perio-token] error:", e);
    return NextResponse.json({ ok: false, message: "토큰 발급 중 오류가 발생했습니다." }, { status: 500 });
  }
}
