// spec 041 — AI 엔진 목록 · 작업 목록 · 작업별 순서(화면·서버 공용 순수 모듈).
// 참고: Signal lib/ai/catalog.ts(2026-11). Carelog는 서비스 키 기본(병원은 크레딧), 설정은 슈퍼어드민 전체 기본값.
// ★Carelog 작업은 거의 다 환자 정보 → phi(환자 정보 가능)=true 인 엔진만 고를 수 있다.
//   phi 기준(유료 API·학습 미사용·보관 기간)은 솔론 확인 후 확정 — 지금은 유료 API(Anthropic·OpenAI)만 true.
// 단가: USD / 1M 토큰. Claude 4.x는 공식 가격, 그 밖은 Signal 카탈로그(2026-11) 값 — 바뀌면 여기만 고친다.

export const AI_PROVIDERS = [
  { key: "anthropic", label: "Anthropic Claude", env: "ANTHROPIC_API_KEY" },
  { key: "openai", label: "OpenAI", env: "OPENAI_API_KEY" },
] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number]["key"];
export const PROVIDER_LABEL = Object.fromEntries(AI_PROVIDERS.map((p) => [p.key, p.label])) as Record<AiProvider, string>;

export type AiModel = {
  provider: AiProvider;
  id: string;
  label: string;
  input: number;
  output: number;
  /** 환자 정보 작업에 쓸 수 있나 */
  phi: boolean;
  note?: string;
};

export const AI_MODELS: AiModel[] = [
  { provider: "anthropic", id: "claude-opus-5-5", label: "Claude Opus 5.5", input: 4, output: 20, phi: true, note: "가장 정교" },
  { provider: "anthropic", id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", input: 2, output: 10, phi: true, note: "품질·속도 균형" },
  { provider: "anthropic", id: "claude-haiku-5-5", label: "Claude Haiku 5.5", input: 0.1, output: 0.5, phi: true, note: "빠르고 쌈" },
  { provider: "anthropic", id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", input: 3, output: 15, phi: true, note: "기존 기본" },
  { provider: "anthropic", id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", input: 1, output: 5, phi: true, note: "기존 통역" },
  { provider: "openai", id: "gpt-6.1-sol", label: "GPT-6.1 Sol", input: 2, output: 10, phi: true },
  { provider: "openai", id: "gpt-6.1-terra", label: "GPT-6.1 Terra", input: 1, output: 5, phi: true },
  { provider: "openai", id: "gpt-6-luna", label: "GPT-6 Luna", input: 0.1, output: 0.5, phi: true, note: "빠르고 쌈" },
  { provider: "openai", id: "gpt-5-mini", label: "GPT-5 mini", input: 0.25, output: 2, phi: true },
];

export function modelInfo(provider: AiProvider, id: string): AiModel | undefined {
  return AI_MODELS.find((m) => m.provider === provider && id.startsWith(m.id));
}

export function costUsd(provider: AiProvider, model: string, tokensIn: number, tokensOut: number): number {
  const m = modelInfo(provider, model);
  if (!m) return 0;
  return (tokensIn * m.input + tokensOut * m.output) / 1_000_000;
}

// ── 작업 ──────────────────────────────────────────────────────────────────
export const AI_TASKS = [
  { key: "summary", label: "상담 요약", what: "녹음 전사 → 상담 기록 요약(기본·상세·용어 보정·긴 상담)" },
  { key: "translate", label: "번역·통역", what: "다국어 녹취 번역, 실시간 통역 문장 번역" },
  { key: "patient_draft", label: "환자용 안내 초안", what: "직원 기록 → 환자가 읽기 쉬운 말(spec 038)" },
  { key: "consult_eval", label: "상담 품질 평가", what: "체크리스트 대조 판정(spec 034)" },
  { key: "chart_parse", label: "잇몸 기록 말 해석", what: "\"17번 구개측 5 3 5\" → 치아·부위·수치(spec 040 2단계)" },
] as const;
export type AiTask = (typeof AI_TASKS)[number]["key"];

export type RouteStep = { provider: AiProvider; model: string };
export type AiRoutes = Record<AiTask, RouteStep[]>;

/** 기본 = 지금 동작 그대로(1순위) + 다른 회사 예비(2순위) */
export const DEFAULT_ROUTES: AiRoutes = {
  summary: [
    { provider: "anthropic", model: "claude-sonnet-4-6" },
    { provider: "openai", model: "gpt-6.1-sol" },
  ],
  translate: [
    { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    { provider: "openai", model: "gpt-6-luna" },
  ],
  patient_draft: [
    { provider: "anthropic", model: "claude-sonnet-4-6" },
    { provider: "openai", model: "gpt-6.1-sol" },
  ],
  consult_eval: [
    { provider: "anthropic", model: "claude-sonnet-4-6" },
    { provider: "openai", model: "gpt-6.1-sol" },
  ],
  chart_parse: [
    { provider: "anthropic", model: "claude-haiku-5-5" },
    { provider: "openai", model: "gpt-6-luna" },
  ],
};

/** 품질 우선 추천 — 최신 세대 1순위, 다른 회사 2순위, 빠른 모델 3순위 */
export const QUALITY_ROUTES: AiRoutes = {
  summary: [
    { provider: "anthropic", model: "claude-sonnet-5-5" },
    { provider: "openai", model: "gpt-6.1-sol" },
    { provider: "anthropic", model: "claude-sonnet-4-6" },
  ],
  translate: [
    { provider: "anthropic", model: "claude-sonnet-5-5" },
    { provider: "openai", model: "gpt-6.1-terra" },
    { provider: "anthropic", model: "claude-haiku-5-5" },
  ],
  patient_draft: [
    { provider: "anthropic", model: "claude-sonnet-5-5" },
    { provider: "openai", model: "gpt-6.1-sol" },
    { provider: "anthropic", model: "claude-sonnet-4-6" },
  ],
  consult_eval: [
    { provider: "anthropic", model: "claude-opus-5-5" },
    { provider: "openai", model: "gpt-6.1-sol" },
    { provider: "anthropic", model: "claude-sonnet-5-5" },
  ],
  chart_parse: [
    { provider: "anthropic", model: "claude-haiku-5-5" },
    { provider: "openai", model: "gpt-6-luna" },
    { provider: "anthropic", model: "claude-sonnet-5-5" },
  ],
};

const isProvider = (p: unknown): p is AiProvider => AI_PROVIDERS.some((x) => x.key === p);

/** 저장된 값(JSON)을 안전한 순서표로 — 모르는 회사·환자 정보 불가 모델은 버리고, 비면 기본값 */
export function normalizeRoutes(v: unknown): AiRoutes {
  const o = (v ?? {}) as Partial<Record<string, unknown>>;
  const out = {} as AiRoutes;
  for (const t of AI_TASKS) {
    const raw = Array.isArray(o[t.key]) ? (o[t.key] as unknown[]) : [];
    const steps = raw
      .map((s) => s as Partial<RouteStep>)
      .filter((s) => isProvider(s.provider) && typeof s.model === "string" && /^[\w.:-]{2,60}$/.test(s.model))
      .map((s) => ({ provider: s.provider as AiProvider, model: s.model as string }))
      .filter((s) => modelInfo(s.provider, s.model)?.phi !== false)
      .slice(0, 3);
    out[t.key] = steps.length ? steps : DEFAULT_ROUTES[t.key];
  }
  return out;
}
