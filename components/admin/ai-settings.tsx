"use client";

// spec 041 — 슈퍼어드민 AI 설정 화면: 작업별 1→2→3순위 모델 · 사용량(호출·토큰·추정 비용·응답 시간·실패).

import { useState, useTransition } from "react";
import {
  AI_MODELS,
  AI_TASKS,
  DEFAULT_ROUTES,
  PROVIDER_LABEL,
  QUALITY_ROUTES,
  type AiRoutes,
  type AiTask,
  type RouteStep,
} from "@/lib/ai/catalog";
import { getAiAdminData, saveAiRoutesAction, type AiAdminData, type AiUsageGroup } from "@/app/actions/ai-admin";

const KRW_PER_USD = 1400;
const won = (usd: number) => `${Math.round(usd * KRW_PER_USD).toLocaleString()}원`;
const stepKey = (s: RouteStep) => `${s.provider}|${s.model}`;
const TASK_LABEL = Object.fromEntries(AI_TASKS.map((t) => [t.key, t.label])) as Record<string, string>;

function UsageTable({ title, rows, label }: { title: string; rows: AiUsageGroup[]; label?: (k: string) => string }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-slate-700">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">기록 없음</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="py-1 text-left font-medium">항목</th>
              <th className="text-right font-medium">호출</th>
              <th className="text-right font-medium">토큰 입/출</th>
              <th className="text-right font-medium">추정 비용</th>
              <th className="text-right font-medium">평균</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key} className="border-t border-slate-100">
                <td className="py-1 text-slate-700">{label ? label(g.key) : g.key}</td>
                <td className="text-right">
                  {g.calls}
                  {g.fails > 0 && <span className="text-red-500"> ({g.fails})</span>}
                </td>
                <td className="text-right text-slate-500">
                  {(g.tokensIn / 1000).toFixed(1)}k / {(g.tokensOut / 1000).toFixed(1)}k
                </td>
                <td className="text-right">{won(g.costUsd)}</td>
                <td className="text-right text-slate-500">{g.avgMs ? `${(g.avgMs / 1000).toFixed(1)}s` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function AiSettings({ initial }: { initial: AiAdminData }) {
  const [data, setData] = useState(initial);
  const [routes, setRoutes] = useState<AiRoutes>(initial.routes);
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const dirty = JSON.stringify(routes) !== JSON.stringify(data.routes);

  const setStep = (task: AiTask, i: number, value: string) =>
    setRoutes((prev) => {
      const steps = [...prev[task]];
      if (!value) steps.splice(i, 1);
      else {
        const [provider, model] = value.split("|");
        steps[i] = { provider: provider as RouteStep["provider"], model };
      }
      return { ...prev, [task]: steps.filter(Boolean).slice(0, 3) };
    });

  const save = () =>
    startTransition(async () => {
      setMsg("");
      const r = await saveAiRoutesAction(routes);
      if (!r.ok) return setMsg(r.message);
      setRoutes(r.routes);
      setData((d) => ({ ...d, routes: r.routes }));
      setMsg("저장했습니다 — 1분 안에 모든 서버에 반영됩니다.");
    });

  const reload = (days: number) =>
    startTransition(async () => {
      const r = await getAiAdminData(days);
      if (r.ok) setData(r.data);
    });

  const u = data.usage;
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">🔑 키 상태</h2>
        <p className="mt-1 text-xs text-slate-500">서비스 키는 Vercel 환경변수에만 둡니다(대표 직접). 키가 없는 회사는 순서에 있어도 건너뜁니다.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(data.ready).map(([p, ok]) => (
            <span
              key={p}
              className={`rounded-full px-3 py-1 text-xs font-medium ${ok ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}
            >
              {PROVIDER_LABEL[p as RouteStep["provider"]]} · {ok ? "연결됨" : "키 없음"}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">작업별 모델 순서</h2>
            <p className="mt-1 text-xs text-slate-500">
              앞 모델이 실패하면 다음 모델로 넘어갑니다. 환자 정보 작업이라 &quot;환자 정보 가능&quot; 모델만 고를 수 있습니다.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setRoutes(QUALITY_ROUTES)} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100">
              추천: 품질 우선
            </button>
            <button type="button" onClick={() => setRoutes(DEFAULT_ROUTES)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              기존 동작
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {AI_TASKS.map((t) => (
            <div key={t.key} className="border-t border-slate-100 pt-3">
              <div className="text-sm font-semibold text-slate-800">{t.label}</div>
              <div className="text-xs text-slate-500">{t.what}</div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {[0, 1, 2].map((i) => {
                  const step = routes[t.key][i];
                  if (!step && i > routes[t.key].length) return null;
                  return (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-slate-300">→</span>}
                      <select
                        value={step ? stepKey(step) : ""}
                        onChange={(e) => setStep(t.key, i, e.target.value)}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      >
                        <option value="">{i === 0 ? "(선택)" : "(없음)"}</option>
                        {AI_MODELS.filter((m) => m.phi).map((m) => (
                          <option key={`${m.provider}|${m.id}`} value={`${m.provider}|${m.id}`}>
                            {m.label} · ${m.input}/${m.output}
                            {m.note ? ` · ${m.note}` : ""}
                          </option>
                        ))}
                      </select>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          {msg && <span className="text-xs text-slate-500">{msg}</span>}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            저장
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">단가 = 1M 토큰당 달러(입력/출력). 비용은 호출마다 기록한 토큰 × 단가로 추정합니다(1달러 ≈ {KRW_PER_USD.toLocaleString()}원).</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">사용량 · 추정 비용</h2>
          <div className="flex gap-1">
            {[1, 7, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => reload(d)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${u.days === d ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"}`}
              >
                {d === 1 ? "오늘" : `${d}일`}
              </button>
            ))}
          </div>
        </div>
        {!u.tableReady ? (
          <p className="mt-3 text-sm text-amber-700">사용량 기록 테이블이 아직 없습니다 — SQL(ai_usage)을 실행하면 이후 호출부터 쌓입니다.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-700">
              {u.total.calls}회{u.total.fails > 0 && <span className="text-red-500"> · 실패 {u.total.fails}</span>} · 추정 {won(u.total.costUsd)}
            </p>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <UsageTable title="작업별" rows={u.byTask} label={(k) => TASK_LABEL[k] ?? k} />
              <UsageTable title="모델별" rows={u.byModel} />
            </div>
            <h3 className="mb-1 mt-6 text-sm font-semibold text-slate-700">최근 호출</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs">
                <tbody>
                  {u.recent.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1 text-slate-500">{new Date(r.at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      <td>{TASK_LABEL[r.task] ?? r.task}</td>
                      <td className="text-slate-600">{r.model}</td>
                      <td className="text-right">{won(Number(r.cost_usd) || 0)}</td>
                      <td className="text-right text-slate-500">{(r.latency_ms / 1000).toFixed(1)}s</td>
                      <td className={r.ok ? "pl-2 text-emerald-600" : "pl-2 text-red-500"} title={r.error}>
                        {r.ok ? "성공" : `실패 · ${r.error.slice(0, 40)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
