// spec 027 상담 세션 안전망 — 기관 설정 타입·기본값. institutions.consult_settings jsonb.
export type ConsultSettings = {
  idle_minutes: number; // 무활동(조작∅+음성∅) 판정 기준 — 기본 10분
  grace_minutes: number; // 경고 후 응답 대기 — 기본 5분, 무응답 시 자동 '종료 및 저장'
  voice_detect: boolean; // 마이크 음성 활동을 '활동'으로 인정(대화 중 오판 방지) — 기본 on
  // spec 038 — 환자 문자·알림톡
  contact_phone: string; // 병원 대표번호(문자에 "문의: …"로 넣는 번호) — 빈 문자열 = 미설정
  include_contact: boolean; // 보낼 때 대표번호 넣기 기본 선택(보내는 순간 바꿀 수 있음)
};

export const DEFAULT_CONSULT_SETTINGS: ConsultSettings = {
  idle_minutes: 10,
  grace_minutes: 5,
  voice_detect: true,
  contact_phone: "",
  include_contact: true,
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
    contact_phone: typeof o.contact_phone === "string" ? formatContactPhone(o.contact_phone) : "",
    include_contact:
      typeof o.include_contact === "boolean" ? o.include_contact : DEFAULT_CONSULT_SETTINGS.include_contact,
  };
}

/** 대표번호 표시 형식(02-123-4567 · 031-123-4567 · 1588-1234 · 010-1234-5678). 숫자 아닌 건 버린다. */
export function formatContactPhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "").slice(0, 12);
  if (!d) return "";
  if (/^1[5-9]\d{6}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4)}`;
  if (d.startsWith("02")) return d.length > 9 ? `02-${d.slice(2, 6)}-${d.slice(6)}` : `02-${d.slice(2, 5)}-${d.slice(5)}`;
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}
