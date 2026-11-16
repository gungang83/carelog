"use client";

// /settings '환자 문자 · 알림톡' — 보내는 번호(발신번호) 고르기.
//   기본 = 케어로그 기본 번호. 우리 병원 번호를 쓰려면 번호 입력 → 테스트 문자 받기 → 나가면 저장(솔라피 등록 번호만 나간다).
import { useState, useTransition } from "react";
import { clearSmsSender, verifySmsSender, type SmsSenderState } from "@/app/actions/sms-sender";

const fmt = (d: string) => d.replace(/^(02|0\d{2})(\d{3,4})(\d{4})$/, "$1-$2-$3");

export function SmsSenderSettings({ initial }: { initial: SmsSenderState }) {
  const [state, setState] = useState(initial);
  const [mode, setMode] = useState<"default" | "own">(initial.verifiedAt ? "own" : "default");
  const [phone, setPhone] = useState(initial.phone);
  const [testTo, setTestTo] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err" | "help"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!state.columnsReady) {
    return (
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
        보내는 번호 고르기는 준비 중이에요(운영팀 DB 반영 후 열립니다). 지금은 케어로그 기본 번호로 나갑니다.
      </p>
    );
  }

  const verify = () => {
    setMsg(null);
    startTransition(async () => {
      const r = await verifySmsSender({ phone, testTo });
      if (r.ok) {
        setState(r.state);
        setMsg({ tone: "ok", text: "테스트 문자가 나갔어요. 이제 환자 문자가 이 번호로 나갑니다." });
      } else if (r.unregistered) {
        setMsg({
          tone: "help",
          text: `이 번호는 아직 문자 발신번호로 등록되지 않았어요(법에 따라 미리 등록한 번호만 보낼 수 있어요). 케어로그 운영팀에 등록을 요청해 주세요 — 병원 명의 번호는 통신서비스 이용증명원이 필요합니다. (${r.message})`,
        });
      } else setMsg({ tone: "err", text: r.message });
    });
  };

  const useDefault = () => {
    setMode("default");
    if (!state.verifiedAt) return;
    startTransition(async () => {
      const r = await clearSmsSender();
      if (r.ok) {
        setState({ ...state, phone: "", verifiedAt: null });
        setPhone("");
        setMsg({ tone: "ok", text: "케어로그 기본 번호로 바꿨어요." });
      } else setMsg({ tone: "err", text: r.message });
    });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">보내는 번호(발신번호)</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={useDefault}
          disabled={isPending}
          className={`rounded-xl border px-3 py-2 text-left text-sm transition ${mode === "default" ? "border-sky-500 bg-sky-50 text-sky-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          <span className="font-semibold">케어로그 기본 번호</span>
          <span className="block text-xs opacity-70">따로 준비할 것 없음</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("own")}
          className={`rounded-xl border px-3 py-2 text-left text-sm transition ${mode === "own" ? "border-sky-500 bg-sky-50 text-sky-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          <span className="font-semibold">우리 병원 번호</span>
          <span className="block text-xs opacity-70">
            {state.verifiedAt ? `${fmt(state.phone)} · 사용 중` : "등록된 번호만 가능"}
          </span>
        </button>
      </div>

      {mode === "own" && (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            병원 번호
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="02-000-0000"
              className="w-40 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-sky-500"
            />
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            테스트 받을 내 휴대폰
            <input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              inputMode="tel"
              placeholder="010-0000-0000"
              className="w-40 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-sky-500"
            />
          </label>
          <button
            type="button"
            onClick={verify}
            disabled={isPending || !phone.trim() || !testTo.trim()}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {isPending ? "보내는 중…" : "테스트 문자 받고 이 번호 쓰기"}
          </button>
          <p className="text-xs text-slate-400">
            테스트 문자가 실제로 나가야 저장돼요. 문자 발신번호는 미리 등록한 번호만 쓸 수 있습니다(발신번호 사전등록제).
          </p>
        </div>
      )}

      {msg && (
        <p
          className={`rounded-lg px-3 py-2 text-xs break-keep ${
            msg.tone === "ok" ? "bg-emerald-50 text-emerald-700" : msg.tone === "help" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-600"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
