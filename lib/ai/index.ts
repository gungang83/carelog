// spec 041 — askAI: 작업(task)마다 정한 순서대로 회사·모델을 시도하고, 실패하면 다음으로. 호출마다 사용량을 남긴다.
// 서버 전용. 키는 서비스 키(Vercel 환경변수)만. 크레딧 차감은 지금처럼 기능 단위(lib/credits) — 여기는 실제 비용 기록.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  AI_PROVIDERS,
  DEFAULT_ROUTES,
  PROVIDER_LABEL,
  costUsd,
  normalizeRoutes,
  type AiProvider,
  type AiRoutes,
  type AiTask,
  type RouteStep,
} from "@/lib/ai/catalog";

export type AskInput = {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** 사용량 기록용(없으면 비움) */
  institutionId?: string | null;
  userEmail?: string | null;
};

export type AskResult = {
  text: string;
  provider: AiProvider;
  model: string;
  tokensIn: number;
  tokensOut: number;
};

function serviceKey(p: AiProvider): string | null {
  const env = AI_PROVIDERS.find((x) => x.key === p)!.env;
  const v = (process.env[env] ?? "").trim();
  return v && !v.startsWith("your_") ? v : null;
}

export function providerReady(p: AiProvider): boolean {
  return serviceKey(p) !== null;
}

// ── 설정(작업별 순서) — ai_settings 'routes' 1행. 테이블이 없거나 실패하면 기본값 ──
let cache: { at: number; routes: AiRoutes } | null = null;
export async function getAiRoutes(fresh = false): Promise<AiRoutes> {
  if (!fresh && cache && Date.now() - cache.at < 60_000) return cache.routes;
  let routes = DEFAULT_ROUTES;
  try {
    const { data } = await createAdminSupabaseClient().from("ai_settings").select("value").eq("key", "routes").maybeSingle();
    if (data?.value) routes = normalizeRoutes(data.value);
  } catch {
    /* 기본값 */
  }
  cache = { at: Date.now(), routes };
  return routes;
}

export async function saveAiRoutes(v: unknown, by: string): Promise<AiRoutes> {
  const routes = normalizeRoutes(v);
  const { error } = await createAdminSupabaseClient()
    .from("ai_settings")
    .upsert({ key: "routes", value: routes, updated_by: by, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  cache = { at: Date.now(), routes };
  return routes;
}

// ── 회사별 호출 ──
async function callProvider(step: RouteStep, input: AskInput): Promise<Omit<AskResult, "provider">> {
  const key = serviceKey(step.provider);
  if (!key) throw new Error("키 없음");
  const maxTokens = input.maxTokens ?? 1024;
  if (step.provider === "anthropic") {
    const msg = await new Anthropic({ apiKey: key }).messages.create({
      model: step.model,
      max_tokens: maxTokens,
      ...(input.system ? { system: input.system } : {}),
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      messages: [{ role: "user", content: input.prompt }],
    });
    const text = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return { text, model: msg.model ?? step.model, tokensIn: msg.usage?.input_tokens ?? 0, tokensOut: msg.usage?.output_tokens ?? 0 };
  }
  const res = await new OpenAI({ apiKey: key }).chat.completions.create({
    model: step.model,
    max_completion_tokens: maxTokens,
    ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    messages: [
      ...(input.system ? [{ role: "system" as const, content: input.system }] : []),
      { role: "user" as const, content: input.prompt },
    ],
  });
  return {
    text: (res.choices[0]?.message?.content ?? "").trim(),
    model: res.model ?? step.model,
    tokensIn: res.usage?.prompt_tokens ?? 0,
    tokensOut: res.usage?.completion_tokens ?? 0,
  };
}

async function recordAiUsage(row: {
  task: AiTask;
  provider: AiProvider;
  model: string;
  ok: boolean;
  error?: string;
  tokensIn: number;
  tokensOut: number;
  ms: number;
  institutionId?: string | null;
  userEmail?: string | null;
}) {
  try {
    await createAdminSupabaseClient()
      .from("ai_usage")
      .insert({
        task: row.task,
        provider: row.provider,
        model: row.model,
        ok: row.ok,
        error: (row.error ?? "").slice(0, 300),
        tokens_in: row.tokensIn,
        tokens_out: row.tokensOut,
        cost_usd: costUsd(row.provider, row.model, row.tokensIn, row.tokensOut),
        latency_ms: row.ms,
        institution_id: row.institutionId ?? null,
        user_email: row.userEmail ?? null,
      });
  } catch {
    /* 기록 실패는 무시(테이블 미생성 포함) */
  }
}

/** 작업 순서대로 시도 — 키 없는 회사는 건너뛰고, 실패하면 다음 모델. 모두 실패하면 throw. */
export async function askAI(task: AiTask, input: AskInput): Promise<AskResult> {
  const routes = await getAiRoutes();
  const errors: string[] = [];
  for (const step of routes[task] ?? DEFAULT_ROUTES[task]) {
    if (!serviceKey(step.provider)) continue;
    const t0 = Date.now();
    try {
      const r = await callProvider(step, input);
      if (!r.text) throw new Error("빈 응답");
      await recordAiUsage({ task, provider: step.provider, ...r, ok: true, ms: Date.now() - t0, institutionId: input.institutionId, userEmail: input.userEmail });
      return { ...r, provider: step.provider };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${PROVIDER_LABEL[step.provider]} ${step.model}: ${msg.slice(0, 120)}`);
      await recordAiUsage({ task, provider: step.provider, model: step.model, ok: false, error: msg, tokensIn: 0, tokensOut: 0, ms: Date.now() - t0, institutionId: input.institutionId, userEmail: input.userEmail });
    }
  }
  throw new Error(errors.length ? `AI 호출 실패 (${errors.join(" / ")})` : "AI 키가 설정되지 않았습니다.");
}
