"use server";

// spec 034 — 상담 품질 평가 (체크리스트 대조) · 🧪 테스트중
// v1 권한: 슈퍼어드민 전용. 단 eval_grants(이메일별 can_view/can_evaluate)로
// 상담자 당사자·기획공장 개방을 언제든 할 수 있게 가드를 grants 인지형으로 구현.
// 한계: 전사 원문 미저장 — 평가는 상담 기록 '요약 본문' 기반(프롬프트에 명시, na 유도).

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isSuperAdmin } from "@/lib/admin";
import { deductCredit } from "@/lib/credits";

// ── 타입 ─────────────────────────────────────────────────────

export type EvalItemType = "auto" | "manual";
export type EvalVerdict = "met" | "partial" | "unmet" | "na";

export type EvalTemplateItem = {
  id: string;
  label: string;
  guide: string;
  type: EvalItemType;
  weight: number | null; // 배점(실험 — null=미배점)
};

export type EvalTemplate = {
  id: string;
  institution_id: string | null; // null = 전역(파트너 템플릿 대비)
  name: string;
  items: EvalTemplateItem[];
  active: boolean;
  created_at: string;
};

export type EvalItemResult = {
  item_id: string;
  verdict: EvalVerdict;
  evidence: string; // 근거 인용(필수 — 신뢰의 핵심)
  comment: string;
};

export type EvalRun = {
  id: string;
  institution_id: string;
  consultation_id: number;
  template_id: string | null;
  status: string;
  ai_result: EvalItemResult[] | null;
  manual_result: EvalItemResult[] | null;
  score: number | null; // 실험값 — 표시 시 '실험' 라벨 필수
  summary: string | null;
  error: string | null;
  model: string | null;
  created_by: string | null;
  created_at: string;
};

export type EvalGrant = {
  id: string;
  institution_id: string;
  grantee_email: string;
  can_view: boolean;
  can_evaluate: boolean;
  note: string | null;
  created_at: string;
};

type Fail = { ok: false; message: string };

// ── 권한 가드 — v1 슈퍼어드민, grants 개방 대비 ─────────────

type Access = { email: string; superAdmin: boolean; canView: boolean; canEvaluate: boolean };

/** 평가 기능 접근 판정: 슈퍼어드민이면 전권, 아니면 eval_grants에서 조회(개방 대비). */
async function resolveEvalAccess(institutionId: string | null): Promise<Access | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email;
  if (!email) return null;
  if (isSuperAdmin(email)) {
    return { email, superAdmin: true, canView: true, canEvaluate: true };
  }
  if (!institutionId) return null;
  const admin = createAdminSupabaseClient();
  const { data: grant } = await admin
    .from("eval_grants")
    .select("can_view, can_evaluate")
    .eq("institution_id", institutionId)
    .eq("grantee_email", email)
    .maybeSingle();
  if (!grant) return null;
  return {
    email,
    superAdmin: false,
    canView: grant.can_view === true,
    canEvaluate: grant.can_evaluate === true,
  };
}

// ── 기본 템플릿 씨드 ─────────────────────────────────────────

const DEFAULT_ITEMS: EvalTemplateItem[] = [
  { id: "chief", label: "주소(主訴) 확인", guide: "환자가 온 이유·불편을 먼저 확인하고 대화를 시작했는가", type: "auto", weight: 10 },
  { id: "empathy", label: "공감 표현", guide: "환자의 불안·통증에 공감하는 표현이 있었는가", type: "auto", weight: 10 },
  { id: "plain", label: "쉬운 설명", guide: "전문 용어를 환자 눈높이로 풀어 설명했는가", type: "auto", weight: 10 },
  { id: "options", label: "치료 옵션 제시", guide: "치료 옵션을 2개 이상 제시하고 차이를 설명했는가", type: "auto", weight: 10 },
  { id: "cost", label: "비용 안내", guide: "비용(또는 비용 상담 경로)을 안내했는가", type: "auto", weight: 10 },
  { id: "caution", label: "주의사항 고지", guide: "치료 전후 주의사항·부작용 가능성을 고지했는가", type: "auto", weight: 10 },
  { id: "qna", label: "질문 응대", guide: "환자 질문에 회피 없이 답했는가 (질문 기회 제공 포함)", type: "auto", weight: 10 },
  { id: "next", label: "다음 단계 안내", guide: "다음 내원·검사·결정 등 다음 단계를 명확히 안내했는가", type: "auto", weight: 10 },
  { id: "tone", label: "어조·말투 (수동)", guide: "녹음을 듣고 판정 — 부드럽고 안정적인 어조였는가", type: "manual", weight: 10 },
  { id: "listen", label: "경청·끼어들기 (수동)", guide: "녹음을 듣고 판정 — 환자 말을 끊지 않고 경청했는가", type: "manual", weight: 5 },
  { id: "closing", label: "마무리 인사 (수동)", guide: "녹음을 듣고 판정 — 따뜻한 마무리였는가", type: "manual", weight: 5 },
];

/** 활성 템플릿 목록(전역+기관). 하나도 없으면 기본 템플릿(전역)을 씨드. */
export async function getEvalTemplates(
  institutionId: string,
): Promise<{ ok: true; templates: EvalTemplate[] } | Fail> {
  const access = await resolveEvalAccess(institutionId);
  if (!access?.canView) return { ok: false, message: "접근 권한이 없습니다." };

  const admin = createAdminSupabaseClient();
  const fetchAll = () =>
    admin
      .from("eval_templates")
      .select("id, institution_id, name, items, active, created_at")
      .or(`institution_id.is.null,institution_id.eq.${institutionId}`)
      .order("created_at", { ascending: true });

  let { data, error } = await fetchAll();
  if (error) return { ok: false, message: "템플릿 조회에 실패했습니다." };

  if (!data || data.length === 0) {
    await admin.from("eval_templates").insert({
      institution_id: null,
      name: "기본 상담 체크리스트 (기획공장 협업 초안)",
      items: DEFAULT_ITEMS,
      created_by: access.email,
    });
    ({ data, error } = await fetchAll());
    if (error || !data) return { ok: false, message: "기본 템플릿 생성에 실패했습니다." };
  }

  return { ok: true, templates: data as EvalTemplate[] };
}

/** 템플릿 항목·이름 수정 (슈퍼어드민 전용 — 배점 시뮬레이션용). */
export async function updateEvalTemplate(
  templateId: string,
  patch: { name?: string; items?: EvalTemplateItem[]; active?: boolean },
): Promise<{ ok: true } | Fail> {
  const access = await resolveEvalAccess(null);
  if (!access?.superAdmin) return { ok: false, message: "슈퍼어드민 전용입니다." };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.active !== undefined) update.active = patch.active;
  if (patch.items !== undefined) {
    const cleaned = patch.items
      .map((it) => ({
        id: String(it.id || "").trim() || crypto.randomUUID().slice(0, 8),
        label: String(it.label || "").trim(),
        guide: String(it.guide || "").trim(),
        type: it.type === "manual" ? "manual" : "auto",
        weight: it.weight === null || Number.isNaN(Number(it.weight)) ? null : Number(it.weight),
      }))
      .filter((it) => it.label);
    if (cleaned.length === 0) return { ok: false, message: "항목이 비어 있습니다." };
    update.items = cleaned;
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("eval_templates").update(update).eq("id", templateId);
  if (error) return { ok: false, message: "템플릿 저장에 실패했습니다." };
  revalidatePath("/admin/eval");
  return { ok: true };
}

// ── 평가 대상 상담 목록 ──────────────────────────────────────

export type EvalConsultationRow = {
  id: number;
  created_at: string;
  station_name: string | null;
  author_name: string | null;
  patient_name: string | null;
  content_chars: number; // 본문 텍스트 길이(평가 가능성 가늠)
  last_run: { id: string; created_at: string; score: number | null } | null;
};

export async function getEvalConsultations(
  institutionId: string,
): Promise<{ ok: true; rows: EvalConsultationRow[] } | Fail> {
  const access = await resolveEvalAccess(institutionId);
  if (!access?.canView) return { ok: false, message: "접근 권한이 없습니다." };

  const admin = createAdminSupabaseClient();
  const { data: consults, error } = await admin
    .from("consultation")
    .select("id, created_at, station_name, author_name, content, patient_id")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !consults) return { ok: false, message: "상담 목록 조회에 실패했습니다." };

  const patientIds = [...new Set(consults.map((c) => c.patient_id).filter(Boolean))] as number[];
  const patientMap = new Map<number, string>();
  if (patientIds.length > 0) {
    const { data: patients } = await admin
      .from("patient")
      .select("id, name")
      .in("id", patientIds);
    for (const p of patients ?? []) patientMap.set(p.id as number, p.name as string);
  }

  const ids = consults.map((c) => c.id);
  const { data: runs } = await admin
    .from("eval_runs")
    .select("id, consultation_id, created_at, score")
    .in("consultation_id", ids)
    .order("created_at", { ascending: false });
  const lastRunMap = new Map<number, { id: string; created_at: string; score: number | null }>();
  for (const r of runs ?? []) {
    if (!lastRunMap.has(r.consultation_id as number)) {
      lastRunMap.set(r.consultation_id as number, {
        id: r.id as string,
        created_at: r.created_at as string,
        score: r.score === null ? null : Number(r.score),
      });
    }
  }

  return {
    ok: true,
    rows: consults.map((c) => ({
      id: c.id as number,
      created_at: c.created_at as string,
      station_name: c.station_name as string | null,
      author_name: c.author_name as string | null,
      patient_name: c.patient_id ? (patientMap.get(c.patient_id as number) ?? null) : null,
      content_chars: htmlToText(String(c.content ?? "")).length,
      last_run: lastRunMap.get(c.id as number) ?? null,
    })),
  };
}

// ── AI 평가 실행 ─────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const EVAL_MODEL = "claude-sonnet-4-6";

/** 자동 항목 가중 점수(실험) — met=1, partial=0.5, unmet=0, na=분모 제외. 100점 환산. */
function computeScore(items: EvalTemplateItem[], results: EvalItemResult[]): number | null {
  const byId = new Map(results.map((r) => [r.item_id, r]));
  let got = 0;
  let total = 0;
  for (const it of items) {
    if (it.type !== "auto") continue;
    const w = it.weight ?? 0;
    if (w <= 0) continue;
    const r = byId.get(it.id);
    if (!r || r.verdict === "na") continue;
    total += w;
    if (r.verdict === "met") got += w;
    else if (r.verdict === "partial") got += w * 0.5;
  }
  if (total === 0) return null;
  return Math.round((got / total) * 1000) / 10;
}

export async function runEvaluation(
  consultationId: number,
  templateId: string,
): Promise<{ ok: true; run: EvalRun } | Fail> {
  const admin = createAdminSupabaseClient();

  const { data: consult } = await admin
    .from("consultation")
    .select("id, institution_id, content, created_at, author_name")
    .eq("id", consultationId)
    .maybeSingle();
  if (!consult) return { ok: false, message: "상담 기록을 찾을 수 없습니다." };

  const access = await resolveEvalAccess(consult.institution_id as string);
  if (!access?.canEvaluate) return { ok: false, message: "평가 권한이 없습니다." };

  const { data: template } = await admin
    .from("eval_templates")
    .select("id, items")
    .eq("id", templateId)
    .maybeSingle();
  if (!template) return { ok: false, message: "평가 템플릿을 찾을 수 없습니다." };
  const items = (template.items ?? []) as EvalTemplateItem[];
  const autoItems = items.filter((it) => it.type === "auto");
  if (autoItems.length === 0) return { ok: false, message: "자동 판정 항목이 없는 템플릿입니다." };

  const text = htmlToText(String(consult.content ?? ""));
  if (text.length < 50) {
    return { ok: false, message: "본문이 너무 짧아 평가할 수 없습니다(50자 미만)." };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey || anthropicKey === "your_anthropic_api_key_here") {
    return { ok: false, message: "ANTHROPIC_API_KEY가 설정되지 않았습니다." };
  }
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const checklist = autoItems
    .map((it) => `- id "${it.id}" · ${it.label}: ${it.guide}`)
    .join("\n");

  let aiResult: EvalItemResult[];
  let summary = "";
  let tokensIn = 0;
  let tokensOut = 0;
  try {
    const message = await anthropic.messages.create({
      model: EVAL_MODEL,
      max_tokens: 3000,
      system: `당신은 치과 상담 품질 코치입니다. 아래 '상담 기록 본문'을 체크리스트와 대조해 항목별로 판정합니다.

중요한 전제: 이 본문은 상담 대화의 AI 요약본이며 전사 원문이 아닙니다. 요약에 남지 않은 발화는 판정할 수 없으므로, 본문에 해당 내용의 흔적이 전혀 없으면 'unmet'이 아니라 'na'(판정 불가)로 두십시오. 'unmet'은 본문상 명백히 누락·회피가 드러날 때만 씁니다.

판정값: met(충족) | partial(부분 충족) | unmet(미충족 — 명백할 때만) | na(본문만으로 판정 불가)
evidence: 본문에서 그대로 인용한 근거 구절(필수 — 없으면 빈 문자열, 그 경우 verdict는 na). 조작 금지.
comment: 한 줄 코칭 코멘트(한국어, 존중하는 톤 — 이 평가는 코칭 보조이지 인사평가가 아님).

반드시 아래 JSON만 출력(설명·마크다운 금지):
{"items":[{"item_id":"...","verdict":"met","evidence":"...","comment":"..."}],"summary":"전체 총평·개선 제안 2~3문장"}`,
      messages: [
        {
          role: "user",
          content: `[체크리스트]\n${checklist}\n\n[상담 기록 본문]\n${text.slice(0, 24000)}`,
        },
      ],
    });
    tokensIn = message.usage?.input_tokens ?? 0;
    tokensOut = message.usage?.output_tokens ?? 0;
    const raw = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const jsonText = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonText) as { items?: EvalItemResult[]; summary?: string };
    const validIds = new Set(autoItems.map((it) => it.id));
    aiResult = (parsed.items ?? [])
      .filter((r) => validIds.has(r.item_id))
      .map((r) => ({
        item_id: r.item_id,
        verdict: (["met", "partial", "unmet", "na"] as const).includes(r.verdict as EvalVerdict)
          ? (r.verdict as EvalVerdict)
          : "na",
        evidence: String(r.evidence ?? ""),
        comment: String(r.comment ?? ""),
      }));
    summary = String(parsed.summary ?? "");
    if (aiResult.length === 0) throw new Error("판정 결과가 비어 있습니다.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI 판정 실패";
    await admin.from("eval_runs").insert({
      institution_id: consult.institution_id,
      consultation_id: consultationId,
      template_id: templateId,
      status: "error",
      error: msg,
      model: EVAL_MODEL,
      created_by: access.email,
    });
    return { ok: false, message: `AI 판정에 실패했습니다: ${msg}` };
  }

  const score = computeScore(items, aiResult);

  const { data: run, error } = await admin
    .from("eval_runs")
    .insert({
      institution_id: consult.institution_id,
      consultation_id: consultationId,
      template_id: templateId,
      status: "done",
      ai_result: aiResult,
      score,
      summary,
      model: EVAL_MODEL,
      created_by: access.email,
    })
    .select("*")
    .single();
  if (error || !run) return { ok: false, message: "평가 결과 저장에 실패했습니다." };

  // 크레딧 기록(비차단 — spec 034 E안 3크레딧)
  await deductCredit(consult.institution_id as string, "consult_eval", access.email, {
    refId: String(consultationId),
    memo: "상담 품질 평가(🧪 테스트중)",
    tokensIn,
    tokensOut,
  });

  revalidatePath("/admin/eval");
  return { ok: true, run: run as EvalRun };
}

// ── 수동 평가 입력 (어조·경청 등 — 녹음 듣고 판정) ──────────

export async function saveManualResult(
  runId: string,
  results: EvalItemResult[],
): Promise<{ ok: true } | Fail> {
  const admin = createAdminSupabaseClient();
  const { data: run } = await admin
    .from("eval_runs")
    .select("id, institution_id")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return { ok: false, message: "평가 결과를 찾을 수 없습니다." };

  const access = await resolveEvalAccess(run.institution_id as string);
  if (!access?.canEvaluate) return { ok: false, message: "평가 권한이 없습니다." };

  const cleaned = results.map((r) => ({
    item_id: String(r.item_id),
    verdict: (["met", "partial", "unmet", "na"] as const).includes(r.verdict as EvalVerdict)
      ? r.verdict
      : "na",
    evidence: String(r.evidence ?? ""),
    comment: String(r.comment ?? ""),
  }));

  const { error } = await admin
    .from("eval_runs")
    .update({ manual_result: cleaned, updated_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) return { ok: false, message: "수동 평가 저장에 실패했습니다." };
  revalidatePath("/admin/eval");
  return { ok: true };
}

// ── 결과 조회 ────────────────────────────────────────────────

export async function getEvalRun(
  runId: string,
): Promise<{ ok: true; run: EvalRun; contentText: string } | Fail> {
  const admin = createAdminSupabaseClient();
  const { data: run } = await admin
    .from("eval_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return { ok: false, message: "평가 결과를 찾을 수 없습니다." };

  const access = await resolveEvalAccess(run.institution_id as string);
  if (!access?.canView) return { ok: false, message: "접근 권한이 없습니다." };

  const { data: consult } = await admin
    .from("consultation")
    .select("content")
    .eq("id", run.consultation_id)
    .maybeSingle();

  return {
    ok: true,
    run: run as EvalRun,
    contentText: htmlToText(String(consult?.content ?? "")),
  };
}

// ── 권한(grants) 관리 — 당사자·기획공장 개방 대비 ───────────

export async function getEvalGrants(
  institutionId: string,
): Promise<{ ok: true; grants: EvalGrant[] } | Fail> {
  const access = await resolveEvalAccess(institutionId);
  if (!access?.superAdmin) return { ok: false, message: "슈퍼어드민 전용입니다." };

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("eval_grants")
    .select("*")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, message: "권한 목록 조회에 실패했습니다." };
  return { ok: true, grants: (data ?? []) as EvalGrant[] };
}

export async function upsertEvalGrant(
  institutionId: string,
  granteeEmail: string,
  canView: boolean,
  canEvaluate: boolean,
  note?: string,
): Promise<{ ok: true } | Fail> {
  const access = await resolveEvalAccess(institutionId);
  if (!access?.superAdmin) return { ok: false, message: "슈퍼어드민 전용입니다." };

  const email = granteeEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, message: "올바른 이메일을 입력하세요." };

  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("eval_grants").upsert(
    {
      institution_id: institutionId,
      grantee_email: email,
      can_view: canView,
      can_evaluate: canEvaluate,
      note: note?.trim() || null,
    },
    { onConflict: "institution_id,grantee_email" },
  );
  if (error) return { ok: false, message: "권한 저장에 실패했습니다." };
  revalidatePath("/admin/eval");
  return { ok: true };
}

export async function removeEvalGrant(grantId: string): Promise<{ ok: true } | Fail> {
  const access = await resolveEvalAccess(null);
  if (!access?.superAdmin) return { ok: false, message: "슈퍼어드민 전용입니다." };

  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("eval_grants").delete().eq("id", grantId);
  if (error) return { ok: false, message: "권한 삭제에 실패했습니다." };
  revalidatePath("/admin/eval");
  return { ok: true };
}
