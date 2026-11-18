// spec 040 §17-2 — 말로 기록 보정 설정(서버). 슈퍼어드민 → 말로 기록 보정에서 바꾼다(platform_settings 'perio_voice').
//   hint: 전사 모델에 주는 용어 목록(문장 말고 낱말 — 조용할 때 되풀이돼도 걸러내기 쉽게, 숫자는 넣지 않음)
//   corrections: "잘못 들은 말 → 바른 말" 한 줄에 하나(해석 전에 바꿔 끼움)
//   model: 전사 모델(비우면 env PERIO_STT_MODEL → gpt-4o-transcribe)
import { getPlatformSetting } from "@/lib/platform-settings";

export const DEFAULT_PERIO_HINT =
  "mesial, distal, buccal, palatal, lingual, 근심, 원심, 중앙, 협측, 구개측, 설측, 바깥, 안쪽, probing, 깊이, 퇴축, recession, 출혈, bleeding, 동요, 타진, 플러스, 투플러스, 결손, 취소, 건너뛰기";

export type PerioVoiceConfig = { hint: string; corrections: string; model: string };

export const envSttModel = () => process.env.PERIO_STT_MODEL?.trim() || "gpt-4o-transcribe";

export async function getPerioVoiceConfig(fresh = false): Promise<PerioVoiceConfig & { saved: Partial<PerioVoiceConfig> }> {
  const v = (await getPlatformSetting<Partial<PerioVoiceConfig>>("perio_voice", fresh)) ?? {};
  return {
    hint: v.hint?.trim() || DEFAULT_PERIO_HINT,
    corrections: v.corrections ?? "",
    model: v.model?.trim() || envSttModel(),
    saved: v,
  };
}

/** "틀린 말 → 바른 말" 줄들 → 쌍 목록 */
export function parseCorrections(text: string): [string, string][] {
  return text
    .split(/\n+/)
    .map((l) => l.split(/\s*(?:→|->|=>|=)\s*/))
    .filter((p) => p.length === 2 && p[0].trim() && p[1].trim())
    .map(([a, b]) => [a.trim(), b.trim()] as [string, string]);
}
