"use client";

// spec 038 — /settings '환자 문자' 카드(owner/admin): 병원 대표번호 + 보낼 때 넣기 기본값.
import { useState, useTransition } from "react";
import type { ConsultSettings } from "@/lib/consult-settings";
import { updateConsultSettings } from "@/app/actions/consult-settings";

export function PatientMessageSettings({ initial }: { initial: ConsultSettings }) {
  const [phone, setPhone] = useState(initial.contact_phone);
  const [include, setInclude] = useState(initial.include_contact);
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setMsg("");
    startTransition(async () => {
      const r = await updateConsultSettings({ contact_phone: phone, include_contact: include });
      if (r.ok) {
        setPhone(r.settings.contact_phone);
        setInclude(r.settings.include_contact);
        setMsg("저장됐어요.");
      } else setMsg(r.message);
      setTimeout(() => setMsg(""), 4000);
    });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
        병원 대표번호
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="02-000-0000"
          className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-sky-500"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={include} onChange={(e) => setInclude(e.target.checked)} />
        환자에게 보낼 때 &quot;문의: 대표번호&quot;를 넣기 <span className="text-xs text-slate-400">(기본 선택 — 보낼 때마다 바꿀 수 있어요)</span>
      </label>
      <p className="text-xs text-slate-400">
        문자·알림톡 발신은 케어로그 번호(채널)로 나가고, 본문에 병원 이름과 이 대표번호가 들어갑니다.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {isPending ? "저장 중…" : "저장"}
        </button>
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}
