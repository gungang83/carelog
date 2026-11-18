"use client";

// 슈퍼어드민 — 말로 기록 보정: 전사 모델 · 용어 힌트 · 보정 낱말("틀린 말 → 바른 말") + 최근 들은 말.
import { useState, useTransition } from "react";
import { saveVoiceConfig, type VoiceAdminData } from "@/app/actions/voice-admin";

const MODELS = ["gpt-4o-transcribe", "gpt-4o-mini-transcribe"];

export function VoiceSettings({ data }: { data: VoiceAdminData }) {
  const [hint, setHint] = useState(data.config.hint);
  const [corr, setCorr] = useState(data.config.corrections);
  const [model, setModel] = useState(data.config.model);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!data.tableReady) return <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">platform_settings 표가 없어요(SQL 20261116000002 실행 필요).</p>;

  const save = () =>
    startTransition(async () => {
      const r = await saveVoiceConfig({ hint, corrections: corr, model });
      setMsg(r.ok ? { ok: true, text: "저장했어요 — 다음에 [🎙 말로 기록]을 켤 때부터(1분 안) 적용돼요." } : { ok: false, text: r.message });
    });
  const addFix = (heard: string) => setCorr((c) => `${c.trim() ? `${c.trim()}\n` : ""}${heard} → `);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-semibold text-slate-800">
          전사 모델
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {MODELS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModel(m)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${model === m ? "border-sky-500 bg-sky-50 text-sky-800" : "border-slate-200 text-slate-600"}`}
              >
                {m}
              </button>
            ))}
            <input value={model} onChange={(e) => setModel(e.target.value)} className="w-56 rounded-lg border border-slate-300 px-2 py-1 text-xs font-normal outline-none focus:border-sky-500" />
          </div>
        </label>
        <label className="block text-sm font-semibold text-slate-800">
          용어 힌트 <span className="text-xs font-normal text-slate-400">— 모델에게 미리 알려 줄 낱말(쉼표로). 문장·숫자는 넣지 마세요(조용할 때 그대로 되돌아올 수 있어요).</span>
          <textarea value={hint} onChange={(e) => setHint(e.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-normal outline-none focus:border-sky-500" />
          <button type="button" onClick={() => setHint(data.defaults.hint)} className="mt-1 text-xs font-normal text-slate-500 underline">
            기본값으로
          </button>
        </label>
        <label className="block text-sm font-semibold text-slate-800">
          보정 낱말 <span className="text-xs font-normal text-slate-400">— 한 줄에 하나, “잘못 들은 말 → 바른 말”. 해석 전에 바꿔 끼웁니다.</span>
          <textarea
            value={corr}
            onChange={(e) => setCorr(e.target.value)}
            rows={6}
            placeholder={"열세번 → 13번\n메디얼 → mesial\n버클 → buccal"}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono text-sm font-normal outline-none focus:border-sky-500"
          />
          <span className="text-xs font-normal text-slate-400">메지알·디스털·버컬·팔라탈·링구얼 같은 흔한 소리 적기는 이미 기본으로 알아듣습니다.</span>
        </label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={isPending} className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
            {isPending ? "저장 중…" : "저장"}
          </button>
          {msg && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">최근 들은 말 <span className="text-xs font-normal text-slate-400">— 저장된 잇몸 기록 회차에서. 잘못 들은 말을 눌러 보정 낱말에 추가</span></p>
        {data.recent.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">아직 저장된 말이 없어요(잇몸 기록을 저장·담기하면 쌓입니다).</p>
        ) : (
          <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto text-sm">
            {data.recent.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs text-slate-400">{new Date(r.at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                <button type="button" onClick={() => addFix(r.text)} className="text-left text-slate-700 hover:text-sky-700" title="보정 낱말에 추가">
                  “{r.text}”
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
