// spec 027 상담 세션 안전망 — 기관 설정 타입·기본값. institutions.consult_settings jsonb.
export type ConsultSettings = {
  idle_minutes: number; // 무활동(조작∅+음성∅) 판정 기준 — 기본 10분
  grace_minutes: number; // 경고 후 응답 대기 — 기본 5분, 무응답 시 자동 '종료 및 저장'
  voice_detect: boolean; // 마이크 음성 활동을 '활동'으로 인정(대화 중 오판 방지) — 기본 on
};

export const DEFAULT_CONSULT_SETTINGS: ConsultSettings = {
  idle_minutes: 10,
  grace_minutes: 5,
  voice_detect: true,
};

export function parseConsultSettings(raw: unknown): ConsultSettings {
  const o = (raw ?? {}) as Partial<Record<keyof ConsultSettings, unknown>>;
  const num = (v: unknown, d: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : d;
  };
  return {
    idle_minutes: num(o.idle_minutes, DEFAULT_CONSULT_SETTINGS.idle_minutes, 1, 120),
    grace_minutes: num(o.grace_minutes, DEFAULT_CONSULT_SETTINGS.grace_minutes, 1, 60),
    voice_detect:
      typeof o.voice_detect === "boolean" ? o.voice_detect : DEFAULT_CONSULT_SETTINGS.voice_detect,
  };
}
