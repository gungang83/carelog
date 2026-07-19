"use client";

import { useState, useTransition } from "react";
import type { ConsultSettings } from "@/lib/consult-settings";
import { updateConsultSettings } from "@/app/actions/consult-settings";

// spec 027 — /settings '상담 안전망' 카드 (owner/admin). 방치 감시 기준 설정.
export function ConsultSafetySettings({ initial }: { initial: ConsultSettings }) {
  const [idle, setIdle] = useState(String(initial.idle_minutes));
  const [grace, setGrace] = useState(String(initial.grace_minutes));
  const [voice, setVoice] = useState(initial.voice_detect);
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setMsg("");
    startTransition(async () => {
      const r = await updateConsultSettings({
        idle_minutes: Number(idle) || 10,
        grace_minutes: Number(grace) || 5,
        voice_detect: voice,
      });
      if (r.ok) {
        setIdle(String(r.settings.idle_minutes));
        setGrace(String(r.settings.grace_minutes));
        setVoice(r.settings.voice_detect);
        setMsg("저장됐어요. 다음 녹음부터 적용됩니다.");
      } else {
        setMsg(r.message);
      }
      setTimeout(() => setMsg(""), 4000);
    });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          무활동
          <input
            value={idle}
            onChange={(e) => setIdle(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            className="w-14 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-sm outline-none focus:border-sky-500"
          />
          분 후 경고
        </label>
        <label className="flex items-center gap-2">
          경고 후
          <input
            value={grace}
            onChange={(e) => setGrace(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            className="w-14 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-sm outline-none focus:border-sky-500"
          />
          분 무응답 시 자동 종료·저장
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={voice}
            onChange={(e) => setVoice(e.target.checked)}
            className="size-4 rounded border-slate-300"
          />
          대화 소리를 활동으로 인정
        </label>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="ml-auto rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
        >
          {isPending ? "저장 중…" : "저장"}
        </button>
      </div>
      <p className="text-[11px] text-slate-400">
        녹음 중 화면 조작이나 대화 소리가 없으면 &apos;방치&apos;로 보고 경고 후 자동으로 종료·저장합니다.
        자동 저장된 상담 기록은 언제든 이어서 수정할 수 있어요.
      </p>
      {msg && <p className="text-xs text-sky-600">{msg}</p>}
    </div>
  );
}
