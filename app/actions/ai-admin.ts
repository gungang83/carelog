"use server";

// spec 041 — 슈퍼어드민 AI 설정: 작업별 모델 순서 저장 · 사용량(호출별 기록) 집계.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isSuperAdmin } from "@/lib/admin";
import { getAiRoutes, providerReady, saveAiRoutes } from "@/lib/ai";
import { AI_PROVIDERS, type AiProvider, type AiRoutes } from "@/lib/ai/catalog";

type Fail = { ok: false; message: string };

async function requireSuper(): Promise<{ ok: true; email: string } | Fail> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isSuperAdmin(user.email)) return { ok: false, message: "최고 관리자만 쓸 수 있습니다." };
  return { ok: true, email: user.email };
}

export type AiUsageRow = {
  at: string;
  task: string;
  provider: string;
  model: string;
  ok: boolean;
  error: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms: number;
};

export type AiUsageGroup = { key: string; calls: number; fails: number; tokensIn: number; tokensOut: number; costUsd: number; avgMs: number };

export type AiAdminData = {
  routes: AiRoutes;
  ready: Record<AiProvider, boolean>;
  usage: { days: number; tableReady: boolean; byTask: AiUsageGroup[]; byModel: AiUsageGroup[]; recent: AiUsageRow[]; total: AiUsageGroup };
};

function group(rows: AiUsageRow[], keyOf: (r: AiUsageRow) => string): AiUsageGroup[] {
  const m = new Map<string, AiUsageGroup & { msSum: number; okCount: number }>();
  for (const r of rows) {
    const k = keyOf(r);
    const g = m.get(k) ?? { key: k, calls: 0, fails: 0, tokensIn: 0, tokensOut: 0, costUsd: 0, avgMs: 0, msSum: 0, okCount: 0 };
    g.calls += 1;
    if (!r.ok) g.fails += 1;
    else {
      g.okCount += 1;
      g.msSum += r.latency_ms;
    }
    g.tokensIn += r.tokens_in;
    g.tokensOut += r.tokens_out;
    g.costUsd += Number(r.cost_usd) || 0;
    m.set(k, g);
  }
  return [...m.values()]
    .map(({ msSum, okCount, ...g }) => ({ ...g, avgMs: okCount ? Math.round(msSum / okCount) : 0 }))
    .sort((a, b) => b.calls - a.calls);
}

export async function getAiAdminData(days = 7): Promise<{ ok: true; data: AiAdminData } | Fail> {
  const auth = await requireSuper();
  if (!auth.ok) return auth;
  const routes = await getAiRoutes(true);
  const ready = Object.fromEntries(AI_PROVIDERS.map((p) => [p.key, providerReady(p.key)])) as Record<AiProvider, boolean>;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await createAdminSupabaseClient()
    .from("ai_usage")
    .select("at, task, provider, model, ok, error, tokens_in, tokens_out, cost_usd, latency_ms")
    .gte("at", since)
    .order("at", { ascending: false })
    .limit(5000);
  const rows = (data ?? []) as AiUsageRow[];
  return {
    ok: true,
    data: {
      routes,
      ready,
      usage: {
        days,
        tableReady: !error,
        byTask: group(rows, (r) => r.task),
        byModel: group(rows, (r) => `${r.provider} · ${r.model}`),
        recent: rows.slice(0, 20),
        total: group(rows, () => "전체")[0] ?? { key: "전체", calls: 0, fails: 0, tokensIn: 0, tokensOut: 0, costUsd: 0, avgMs: 0 },
      },
    },
  };
}

export async function saveAiRoutesAction(routes: AiRoutes): Promise<{ ok: true; routes: AiRoutes } | Fail> {
  const auth = await requireSuper();
  if (!auth.ok) return auth;
  try {
    return { ok: true, routes: await saveAiRoutes(routes, auth.email) };
  } catch (e) {
    return { ok: false, message: `저장 실패: ${e instanceof Error ? e.message : "원인 미상"} — SQL(ai_settings) 실행 여부를 확인해 주세요.` };
  }
}
