"use server";

// spec 040 §5-3 — 잇몸 기록 말로 입력(서버): 규칙으로 못 알아들은 문장의 AI 해석 · 사용 시간 기록.
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitutionId } from "@/lib/auth/institution";
import { askAI } from "@/lib/ai";
import { sanitizeActions, type VoiceAction } from "@/lib/oral/perio-voice";

const SYSTEM = `너는 치과 치주 검사 받아쓰기 해석기다. 치과의사가 말한 한 문장을 기록 동작 JSON 배열로만 바꾼다(설명 금지).
동작 모양:
- {"k":"ctx","t":"17","s":"B|L","p":"D|C|M","toward":"M|D","mode":"pd|rec"} — 위치·면·시작 부위·진행 방향·지표(있는 것만)
  s: B=협측/순측/바깥, L=구개측/설측/안쪽. toward: M=근심(앞쪽), D=원심(뒤쪽). "원심부터"면 p=D, toward=M.
- {"k":"val","v":3} — 깊이(0~15) 또는 "F"(뿌리 끝까지), 퇴축은 -3~10. 숫자는 말한 순서대로 하나씩.
- {"k":"bop"} 출혈 · {"k":"mob","v":0~3} 동요 · {"k":"perc","v":0~3} 타진 · {"k":"missing"} 결손 · {"k":"undo"} 취소 · {"k":"skip"} 건너뛰기
치아 번호는 FDI 두 자리(상악 우측 제2대구치 = 17). 기록과 상관없는 말이면 [].`;

export async function interpretPerioUtterance(text: string): Promise<VoiceAction[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const institutionId = await getMyInstitutionId();
  try {
    const r = await askAI("chart_parse", {
      system: SYSTEM,
      prompt: `문장: ${text.slice(0, 300)}\nJSON 배열:`,
      maxTokens: 400,
      temperature: 0,
      institutionId,
      userEmail: user.email ?? null,
    });
    const m = r.text.match(/\[[\s\S]*\]/);
    return m ? sanitizeActions(JSON.parse(m[0])) : [];
  } catch {
    return [];
  }
}

/** 말로 입력 세션 사용 시간 기록(ai_usage — 슈퍼어드민 AI 엔진 화면 사용량에 함께 보임) */
export async function recordPerioVoiceUsage(seconds: number, model: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(seconds > 0)) return;
  const institutionId = await getMyInstitutionId();
  const minutes = seconds / 60;
  try {
    await createAdminSupabaseClient()
      .from("ai_usage")
      .insert({
        task: "perio_voice",
        provider: "openai",
        model,
        ok: true,
        error: "",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: Math.round(minutes * 0.006 * 10000) / 10000, // gpt-4o-transcribe 분당 약 $0.006
        latency_ms: Math.round(seconds * 1000),
        institution_id: institutionId ?? null,
        user_email: user.email ?? null,
      });
  } catch {
    /* 기록 실패는 무시 */
  }
}
