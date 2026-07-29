import { NextResponse } from "next/server";
import { getMyInstitutionLab, getMyInstitutionId } from "@/lib/auth/institution";
import { getCreditBalance } from "@/lib/credits";

// spec 030 — 실시간 통역 PoC: OpenAI Realtime(전사 세션) ephemeral client secret 발급.
// 브라우저에 서버 키를 절대 노출하지 않는다(R6) — 단기 시크릿만 내려준다.
// 게이트: 실험실(lab) 워크스페이스 전용(세션 기반 — 비로그인/비-lab 403).

export async function POST() {
  const lab = await getMyInstitutionLab();
  if (!lab) {
    return NextResponse.json({ ok: false, message: "실험실 전용 기능입니다." }, { status: 403 });
  }
  // spec 030 §3(b) — 소진 시 프리미엄 시작 게이트(진행 중 세션은 중단하지 않음 — 시작만 차단).
  const institutionId = await getMyInstitutionId();
  if (institutionId && (await getCreditBalance(institutionId)) <= 0) {
    return NextResponse.json(
      { ok: false, message: "크레딧이 소진되어 실시간 통역을 시작할 수 없습니다. 충전 후 이용해 주세요." },
      { status: 403 },
    );
  }
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
              // 언어 힌트 없음 — 한·영 혼용(코드스위칭) 발화를 그대로 받는다(spec 030 §1).
              transcription: { model: "gpt-4o-transcribe" },
              turn_detection: { type: "server_vad", silence_duration_ms: 700 },
            },
          },
        },
      }),
    });
    const data = (await resp.json().catch(() => null)) as
      | { value?: string; client_secret?: { value?: string }; error?: { message?: string } }
      | null;
    // GA(top-level value)·구(client_secret.value) 응답 형태 모두 수용
    const secret = data?.value ?? data?.client_secret?.value;
    if (!resp.ok || !secret) {
      const msg = data?.error?.message ?? `토큰 발급 실패 (HTTP ${resp.status})`;
      console.error("[realtime/token] mint failed:", msg);
      return NextResponse.json({ ok: false, message: msg }, { status: 502 });
    }
    return NextResponse.json({ ok: true, clientSecret: secret });
  } catch (e) {
    console.error("[realtime/token] error:", e);
    return NextResponse.json({ ok: false, message: "토큰 발급 중 오류가 발생했습니다." }, { status: 500 });
  }
}
