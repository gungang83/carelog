"use client";

// spec 034 — 상담 품질 평가 관리 UI · 🧪 테스트중
// 기관 선택 → 최근 상담 → [AI 평가 실행] → 결과(verdict 칩+근거+수동 입력+실험 점수)
// 탭: 평가 | 템플릿 편집 | 열람·평가 권한(당사자·기획공장 개방 대비)

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  getEvalTemplates,
  getEvalConsultations,
  runEvaluation,
  getEvalRun,
  saveManualResult,
  requestTranscriptCapture,
  updateEvalTemplate,
  createEvalTemplate,
  deleteEvalTemplate,
  getEvalGrants,
  upsertEvalGrant,
  removeEvalGrant,
  type EvalTemplate,
  type EvalTemplateItem,
  type EvalConsultationRow,
  type EvalRun,
  type EvalItemResult,
  type EvalVerdict,
  type EvalGrant,
} from "@/app/actions/consult-eval";

const VERDICT_META: Record<EvalVerdict, { label: string; cls: string }> = {
  met: { label: "충족", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  partial: { label: "부분", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  unmet: { label: "미충족", cls: "border-rose-200 bg-rose-50 text-rose-700" },
  na: { label: "판정불가", cls: "border-slate-200 bg-slate-50 text-slate-500" },
};

function VerdictChip({ verdict }: { verdict: EvalVerdict }) {
  const m = VERDICT_META[verdict] ?? VERDICT_META.na;
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}

/** 출처 라벨 — 배포 범위(전역/기관) × 제공 주체(케어로그/파트너). */
function templateSource(t: EvalTemplate): string {
  const scope = t.institution_id ? "이 기관" : "전역";
  const provider = t.provider ?? "케어로그 기본";
  return `${scope} · ${provider}`;
}

function templateOptionLabel(t: EvalTemplate): string {
  return `[${templateSource(t)}] ${t.name}${t.active ? "" : " (비활성)"}`;
}

type Props = { institutions: { id: string; name: string }[] };

export function EvalManager({ institutions }: Props) {
  const [tab, setTab] = useState<"run" | "template" | "grants">("run");
  const [instId, setInstId] = useState(institutions[0]?.id ?? "");
  const [templates, setTemplates] = useState<EvalTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [consults, setConsults] = useState<EvalConsultationRow[]>([]);
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  // 결과 뷰
  const [activeRun, setActiveRun] = useState<EvalRun | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  const reload = useCallback(() => {
    if (!instId) return;
    startTransition(async () => {
      setMsg("");
      setActiveRun(null);
      const [t, c] = await Promise.all([getEvalTemplates(instId), getEvalConsultations(instId)]);
      if (t.ok) {
        setTemplates(t.templates);
        setTemplateId((prev) =>
          t.templates.some((x) => x.id === prev) ? prev : (t.templates.find((x) => x.active)?.id ?? ""),
        );
      } else setMsg(t.message);
      if (c.ok) setConsults(c.rows);
      else setMsg(c.message);
    });
  }, [instId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleRun = (consultationId: number) => {
    if (!templateId) {
      setMsg("평가 템플릿을 선택하세요.");
      return;
    }
    const row = consults.find((c) => c.id === consultationId);
    // 원문 미보유 시 경고 — 요약 기반은 '판정불가'가 많다(첫 실측 교훈)
    const warn =
      row && !row.has_transcript
        ? row.capture_status === "in_progress"
          ? "⚠️ 원문 확보가 아직 진행 중입니다 — 지금 평가하면 '요약 기반'(판정불가 다수)으로 판정됩니다. 원문 보유 표시가 뜬 뒤 평가하는 것을 권장합니다.\n\n그래도 지금 "
          : row.has_audio
            ? "⚠️ 이 기록은 아직 원문이 없습니다 — '요약 기반'(판정불가 다수)으로 판정됩니다. [원문 확보] 후 평가하는 것을 권장합니다.\n\n그래도 지금 "
            : "ℹ️ 이 기록은 음성이 없어 요약 본문 기반으로만 판정됩니다.\n\n"
        : "";
    if (!confirm(`${warn}이 상담 기록을 AI로 평가할까요? (3크레딧 · 🧪 테스트중)`)) return;
    setRunningId(consultationId);
    startTransition(async () => {
      const r = await runEvaluation(consultationId, templateId);
      setRunningId(null);
      if (r.ok) {
        setActiveRun(r.run);
        setMsg("");
        const c = await getEvalConsultations(instId);
        if (c.ok) setConsults(c.rows);
      } else setMsg(r.message);
    });
  };

  const handleOpenRun = (runId: string) => {
    startTransition(async () => {
      const r = await getEvalRun(runId);
      if (r.ok) {
        setActiveRun(r.run);
        setMsg("");
      } else setMsg(r.message);
    });
  };

  // 원문 확보 — 보관된 음성을 전사만 해서 원문으로 저장(본문 불변, 워커가 수 분 내 처리)
  const handleCapture = (consultationId: number) => {
    if (!confirm("보관된 음성을 전사해 원문을 확보할까요? (1크레딧 · 수 분 소요, 본문은 바뀌지 않습니다)")) return;
    startTransition(async () => {
      const r = await requestTranscriptCapture(consultationId);
      setMsg(
        r.ok
          ? "원문 확보 작업을 등록했어요 — 수 분 뒤 목록을 새로고침하면 '원문' 표시가 붙고, 그때 평가를 실행하면 원문 기반으로 판정됩니다."
          : r.message,
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* 기관 선택 + 탭 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={instId}
          onChange={(e) => setInstId(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm"
        >
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {(
            [
              ["run", "평가"],
              ["template", "템플릿"],
              ["grants", "열람·평가 권한"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                tab === key ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {msg}
        </div>
      )}

      {tab === "run" && (
        <>
          {/* 템플릿 선택 */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">평가 템플릿:</span>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {templateOptionLabel(t)}
                </option>
              ))}
            </select>
          </div>

          {/* 결과 뷰 */}
          {activeRun && template && (
            <RunView
              run={activeRun}
              template={template}
              onClose={() => setActiveRun(null)}
              onSaved={(updated) => setActiveRun(updated)}
            />
          )}

          {/* 상담 목록 */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">최근 상담 기록 (20건)</h2>
              <button
                onClick={reload}
                disabled={isPending}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
              >
                {isPending ? "불러오는 중…" : "↻ 새로고침"}
              </button>
            </div>
            {consults.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400 shadow-sm">
                {isPending ? "불러오는 중…" : "상담 기록이 없습니다."}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {consults.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800">
                        {c.patient_name ?? "환자 미연결"}
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          #{c.id} · {new Date(c.created_at).toLocaleString("ko-KR")}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <span>
                          {c.author_name ?? "작성자 미상"}
                          {c.station_name ? ` · ${c.station_name}` : ""} · 본문 {c.content_chars.toLocaleString()}자
                        </span>
                        {c.has_transcript ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            원문 보유
                          </span>
                        ) : c.capture_status === "in_progress" ? (
                          <span className="animate-pulse rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                            원문 확보 중…
                          </span>
                        ) : c.capture_status === "failed" ? (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                            원문 확보 실패
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400">
                            요약만
                          </span>
                        )}
                      </div>
                    </div>
                    {!c.has_transcript && c.has_audio && c.capture_status !== "in_progress" && (
                      <button
                        onClick={() => handleCapture(c.id)}
                        disabled={isPending}
                        className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-40"
                        title="보관된 음성을 전사해 원문을 확보합니다(본문 불변)"
                      >
                        {c.capture_status === "failed" ? "원문 확보 재시도" : "원문 확보"}
                      </button>
                    )}
                    {c.last_run && (
                      <button
                        onClick={() => handleOpenRun(c.last_run!.id)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
                      >
                        최근 결과
                        {c.last_run.score !== null ? ` · ${c.last_run.score}점(실험)` : ""}
                      </button>
                    )}
                    <button
                      onClick={() => handleRun(c.id)}
                      disabled={isPending || c.content_chars < 50}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
                      title={c.content_chars < 50 ? "본문이 짧아 평가 불가" : ""}
                    >
                      {runningId === c.id ? "평가 중…" : "AI 평가 실행"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "template" && (
        <div className="space-y-6">
          <TemplateCreator
            instId={instId}
            instName={institutions.find((i) => i.id === instId)?.name ?? "이 기관"}
            templates={templates}
            onCreated={(id) => {
              setTemplateId(id);
              reload();
            }}
          />
          {template ? (
            <TemplateEditor
              key={template.id}
              templates={templates}
              templateId={templateId}
              onSelect={setTemplateId}
              template={template}
              onSaved={reload}
              onDeleted={() => {
                setTemplateId("");
                reload();
              }}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400 shadow-sm">
              {isPending ? "불러오는 중…" : "템플릿이 없습니다."}
            </div>
          )}
        </div>
      )}

      {tab === "grants" && <GrantsPanel instId={instId} />}
    </div>
  );
}

// ── 결과 뷰 + 수동 평가 입력 ─────────────────────────────────

function RunView({
  run,
  template,
  onClose,
  onSaved,
}: {
  run: EvalRun;
  template: EvalTemplate;
  onClose: () => void;
  onSaved: (run: EvalRun) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const autoItems = template.items.filter((i) => i.type === "auto");
  const manualItems = template.items.filter((i) => i.type === "manual");
  const aiMap = new Map((run.ai_result ?? []).map((r) => [r.item_id, r]));

  const [manual, setManual] = useState<EvalItemResult[]>(() =>
    manualItems.map((it) => {
      const prev = (run.manual_result ?? []).find((r) => r.item_id === it.id);
      return prev ?? { item_id: it.id, verdict: "na" as EvalVerdict, evidence: "", comment: "" };
    }),
  );

  const save = () => {
    startTransition(async () => {
      const r = await saveManualResult(run.id, manual);
      if (r.ok) {
        setMsg("수동 평가를 저장했습니다.");
        onSaved({ ...run, manual_result: manual });
      } else setMsg(r.message);
    });
  };

  return (
    <section className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              평가 결과 — 상담 #{run.consultation_id}
            </h3>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              🧪 테스트중
            </span>
            {run.basis === "transcript" ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                원문 기반
              </span>
            ) : (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                요약 기반
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {new Date(run.created_at).toLocaleString("ko-KR")} · {run.model}
            {run.score !== null && (
              <span className="ml-2 font-semibold text-indigo-700">
                자동 항목 {run.score}점 <span className="font-normal">(실험 — 배점 정교화 중)</span>
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 transition hover:bg-slate-50"
        >
          닫기
        </button>
      </div>

      {run.summary && (
        <p className="rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700">
          {run.summary}
        </p>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">AI 자동 판정 (본문 기반)</h4>
        {autoItems.map((it) => {
          const r = aiMap.get(it.id);
          return (
            <div key={it.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-800">{it.label}</span>
                <VerdictChip verdict={r?.verdict ?? "na"} />
              </div>
              {r?.evidence && (
                <blockquote className="mt-1.5 border-l-2 border-indigo-200 pl-2 text-xs text-slate-500">
                  “{r.evidence}”
                </blockquote>
              )}
              {r?.comment && <p className="mt-1 text-xs text-slate-600">{r.comment}</p>}
            </div>
          );
        })}
        <p className="text-xs text-slate-400">
          {run.basis === "transcript"
            ? "※ 전사 원문 전체 기반 판정 — 원문에 없는 발화는 '미충족'으로 판정될 수 있습니다(전사 오타는 의미 중심으로 감안)."
            : "※ 요약 본문 기반 판정 — 요약에 남지 않은 발화는 '판정불가'로 표시됩니다. 목록의 [원문 확보] 후 다시 평가하면 정확도가 올라갑니다."}
        </p>
      </div>

      {manualItems.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">
            수동 평가 (녹음을 듣고 판정 — 어조·경청 등)
          </h4>
          {manualItems.map((it, idx) => (
            <div key={it.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 text-sm font-medium text-slate-800">{it.label}</span>
                <select
                  value={manual[idx]?.verdict ?? "na"}
                  onChange={(e) =>
                    setManual((prev) =>
                      prev.map((m, i) =>
                        i === idx ? { ...m, verdict: e.target.value as EvalVerdict } : m,
                      ),
                    )
                  }
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                >
                  <option value="na">판정 안 함</option>
                  <option value="met">충족</option>
                  <option value="partial">부분</option>
                  <option value="unmet">미충족</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-slate-400">{it.guide}</p>
              <input
                value={manual[idx]?.comment ?? ""}
                onChange={(e) =>
                  setManual((prev) =>
                    prev.map((m, i) => (i === idx ? { ...m, comment: e.target.value } : m)),
                  )
                }
                placeholder="코멘트 (선택)"
                className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
              />
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
            >
              {isPending ? "저장 중…" : "수동 평가 저장"}
            </button>
            {msg && <span className="text-xs text-slate-500">{msg}</span>}
          </div>
        </div>
      )}
    </section>
  );
}

// ── 템플릿 생성 (3층: 케어로그 기본 / 컨설팅 파트너 / 워크스페이스) ──

function TemplateCreator({
  instId,
  instName,
  templates,
  onCreated,
}: {
  instId: string;
  instName: string;
  templates: EvalTemplate[];
  onCreated: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"global" | "institution">("institution");
  const [provider, setProvider] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [msg, setMsg] = useState("");

  const create = () => {
    startTransition(async () => {
      const r = await createEvalTemplate({
        institutionId: scope === "global" ? null : instId,
        provider: provider.trim() || null,
        name,
        copyFromTemplateId: copyFrom || undefined,
      });
      if (r.ok) {
        setName("");
        setProvider("");
        setCopyFrom("");
        setMsg("");
        onCreated(r.id);
      } else setMsg(r.message);
    });
  };

  return (
    <section className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">새 템플릿 만들기</h3>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="템플릿 이름 (예: 기획공장 교정 상담 v1)"
          className="min-w-64 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
        />
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as "global" | "institution")}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
        >
          <option value="institution">{instName} 전용</option>
          <option value="global">전역 (모든 기관)</option>
        </select>
        <input
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder="제공 주체 (빈칸=케어로그 기본)"
          className="w-52 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
        />
        <select
          value={copyFrom}
          onChange={(e) => setCopyFrom(e.target.value)}
          className="max-w-64 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
        >
          <option value="">항목: 기본 체크리스트로 시작</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              복제: {templateOptionLabel(t)}
            </option>
          ))}
        </select>
        <button
          onClick={create}
          disabled={isPending || !name.trim()}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
        >
          {isPending ? "생성 중…" : "만들기"}
        </button>
      </div>
      <p className="text-xs text-slate-400">
        제공 주체에 컨설팅 회사명(예: 기획공장)을 적으면 파트너 제공 템플릿으로 표시됩니다.
        전역 템플릿은 모든 워크스페이스에, 기관 전용은 해당 워크스페이스에만 보입니다.
      </p>
      {msg && <div className="text-xs text-rose-600">{msg}</div>}
    </section>
  );
}

// ── 템플릿 편집 ──────────────────────────────────────────────

function TemplateEditor({
  templates,
  templateId,
  onSelect,
  template,
  onSaved,
  onDeleted,
}: {
  templates: EvalTemplate[];
  templateId: string;
  onSelect: (id: string) => void;
  template: EvalTemplate;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(template.name);
  const [provider, setProvider] = useState(template.provider ?? "");
  const [items, setItems] = useState<EvalTemplateItem[]>(template.items);
  const [msg, setMsg] = useState("");

  const setItem = (idx: number, patch: Partial<EvalTemplateItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const save = () => {
    startTransition(async () => {
      const r = await updateEvalTemplate(templateId, { name, items, provider: provider.trim() || null });
      if (r.ok) {
        setMsg("저장했습니다.");
        onSaved();
      } else setMsg(r.message);
    });
  };

  const toggleActive = () => {
    startTransition(async () => {
      const r = await updateEvalTemplate(templateId, { active: !template.active });
      if (r.ok) onSaved();
      else setMsg(r.message);
    });
  };

  const remove = () => {
    if (!confirm(`'${template.name}' 템플릿을 삭제할까요? 기존 평가 결과는 보존됩니다.`)) return;
    startTransition(async () => {
      const r = await deleteEvalTemplate(templateId);
      if (r.ok) onDeleted();
      else setMsg(r.message);
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={templateId}
          onChange={(e) => onSelect(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {templateOptionLabel(t)}
            </option>
          ))}
        </select>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
          {templateSource(template)}
        </span>
        <button
          onClick={toggleActive}
          disabled={isPending}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
        >
          {template.active ? "비활성화" : "활성화"}
        </button>
        <button
          onClick={remove}
          disabled={isPending}
          className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs text-rose-500 transition hover:bg-rose-50 disabled:opacity-40"
        >
          삭제
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-64 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
          placeholder="템플릿 이름"
        />
        <input
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-52 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
          placeholder="제공 주체 (빈칸=케어로그 기본)"
        />
      </div>

      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={it.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={it.label}
                onChange={(e) => setItem(idx, { label: e.target.value })}
                className="min-w-48 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium"
                placeholder="항목 이름"
              />
              <select
                value={it.type}
                onChange={(e) => setItem(idx, { type: e.target.value as "auto" | "manual" })}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              >
                <option value="auto">AI 자동</option>
                <option value="manual">수동(녹음)</option>
              </select>
              <input
                type="number"
                value={it.weight ?? ""}
                onChange={(e) =>
                  setItem(idx, { weight: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                placeholder="배점"
              />
              <button
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                className="rounded-lg border border-rose-200 px-2 py-1.5 text-xs text-rose-500 transition hover:bg-rose-50"
              >
                삭제
              </button>
            </div>
            <input
              value={it.guide}
              onChange={(e) => setItem(idx, { guide: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600"
              placeholder="판정 기준 설명"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            setItems((prev) => [
              ...prev,
              {
                id: crypto.randomUUID().slice(0, 8),
                label: "",
                guide: "",
                type: "auto",
                weight: 10,
              },
            ])
          }
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
        >
          + 항목 추가
        </button>
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
        >
          {isPending ? "저장 중…" : "템플릿 저장"}
        </button>
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
      <p className="text-xs text-slate-400">
        배점은 실험값입니다 — 기획공장과 시뮬레이션을 돌려보며 함께 정교화합니다. 전역 템플릿 수정은 모든 기관에 적용됩니다.
      </p>
    </section>
  );
}

// ── 권한 관리 (당사자·기획공장 개방 대비) ───────────────────

function GrantsPanel({ instId }: { instId: string }) {
  const [grants, setGrants] = useState<EvalGrant[]>([]);
  const [email, setEmail] = useState("");
  const [canEvaluate, setCanEvaluate] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      const r = await getEvalGrants(instId);
      if (r.ok) setGrants(r.grants);
      else setMsg(r.message);
    });
  }, [instId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const add = () => {
    startTransition(async () => {
      const r = await upsertEvalGrant(instId, email, true, canEvaluate, note);
      if (r.ok) {
        setEmail("");
        setNote("");
        setCanEvaluate(false);
        setMsg("");
        reload();
      } else setMsg(r.message);
    });
  };

  return (
    <section className="space-y-3">
      <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        v1은 슈퍼어드민만 평가·열람합니다. 상담자 당사자나 기획공장 평가자에게 개방할 때 여기에
        이메일을 추가하세요. <span className="text-slate-400">(기획공장 열람은 계약·동의 설계 확정 후)</span>
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="min-w-56 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={canEvaluate}
            onChange={(e) => setCanEvaluate(e.target.checked)}
          />
          평가 권한(수동 입력·AI 실행)
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="메모 (예: 기획공장 평가자)"
          className="w-48 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
        />
        <button
          onClick={add}
          disabled={isPending || !email.trim()}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
        >
          추가
        </button>
      </div>

      {msg && <div className="text-sm text-rose-600">{msg}</div>}

      {grants.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-center text-sm text-slate-400 shadow-sm">
          부여된 권한이 없습니다 — 슈퍼어드민 전용 상태입니다.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {grants.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-800">{g.grantee_email}</div>
                <div className="mt-0.5 text-xs text-slate-400">
                  열람{g.can_evaluate ? " · 평가" : ""}
                  {g.note ? ` · ${g.note}` : ""}
                </div>
              </div>
              <button
                onClick={() =>
                  startTransition(async () => {
                    const r = await removeEvalGrant(g.id);
                    if (r.ok) reload();
                    else setMsg(r.message);
                  })
                }
                className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs text-rose-500 transition hover:bg-rose-50"
              >
                회수
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
