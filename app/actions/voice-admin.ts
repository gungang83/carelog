"use server";

// 슈퍼어드민 — 말로 기록 보정(spec 040 §17-2): 전사 모델 · 용어 힌트 · 보정 낱말 + 최근 들은 말(보정 낱말 만들 때 참고).
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isSuperAdmin } from "@/lib/admin";
import { platformSettingsReady, setPlatformSetting } from "@/lib/platform-settings";
import { DEFAULT_PERIO_HINT, envSttModel, getPerioVoiceConfig, type PerioVoiceConfig } from "@/lib/oral/perio-voice-config";

type Fail = { ok: false; message: string };

async function requireSuper(): Promise<{ ok: true; email: string } | Fail> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isSuperAdmin(user.email)) return { ok: false, message: "최고 관리자만 쓸 수 있습니다." };
  return { ok: true, email: user.email };
}

export type VoiceAdminData = {
  tableReady: boolean;
  config: PerioVoiceConfig;
  defaults: { hint: string; model: string };
  /** 최근 들은 말(저장된 잇몸 기록 회차에서) — 새것부터 */
  recent: { text: string; at: string }[];
};

export async function getVoiceAdminData(): Promise<{ ok: true; data: VoiceAdminData } | Fail> {
  const g = await requireSuper();
  if (!g.ok) return g;
  const [tableReady, cfg] = await Promise.all([platformSettingsReady(), getPerioVoiceConfig(true)]);
  let recent: { text: string; at: string }[] = [];
  try {
    const { data } = await createAdminSupabaseClient().from("oral_exams").select("data").order("updated_at", { ascending: false }).limit(20);
    recent = (data ?? [])
      .flatMap((r) => ((r as { data?: { utterances?: { text: string; at: string }[] } }).data?.utterances ?? []))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 60);
  } catch {
    /* 표가 없으면 빈 목록 */
  }
  return {
    ok: true,
    data: { tableReady, config: { hint: cfg.hint, corrections: cfg.corrections, model: cfg.model }, defaults: { hint: DEFAULT_PERIO_HINT, model: envSttModel() }, recent },
  };
}

export async function saveVoiceConfig(input: PerioVoiceConfig): Promise<{ ok: true } | Fail> {
  const g = await requireSuper();
  if (!g.ok) return g;
  const value: Partial<PerioVoiceConfig> = {
    hint: input.hint.trim().slice(0, 1000),
    corrections: input.corrections.slice(0, 5000),
    model: input.model.trim().slice(0, 80),
  };
  try {
    await setPlatformSetting("perio_voice", value, g.email);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "저장 실패" };
  }
}
