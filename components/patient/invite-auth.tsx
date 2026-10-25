"use client";

// spec 038 — 문자 링크 인증: 병원에 등록된 번호(가림 표시)로 인증번호 받기 → 6자리 입력 → 바로 안내/기록.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestInviteOtp, verifyInviteOtp } from "@/app/actions/patient-portal";

export function InviteAuth({ token, maskedPhone }: { token: string; maskedPhone: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<"ask" | "code">("ask");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!maskedPhone) {
    return <p className="text-sm text-rose-600">병원에 등록된 휴대폰 번호가 없어 확인할 수 없습니다. 병원에 문의해 주세요.</p>;
  }

  const send = async () => {
    setBusy(true);
    setMsg("");
    const r = await requestInviteOtp(token);
    setBusy(false);
    if (r.ok) setStep("code");
    else setMsg(r.message);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const r = await verifyInviteOtp(token, code);
    if (r.ok) {
      router.replace(r.next);
      return;
    }
    setBusy(false);
    setMsg(r.message);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        본인 확인을 위해 <span className="font-semibold text-slate-800">{maskedPhone}</span>로 인증번호를 보내 드려요.
      </p>
      {step === "ask" ? (
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy}
          className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {busy ? "보내는 중…" : "인증번호 받기"}
        </button>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="인증번호 6자리"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-center text-lg tracking-[0.3em] outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            autoFocus
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {busy ? "확인 중…" : "확인"}
          </button>
          <button type="button" onClick={() => void send()} disabled={busy} className="text-xs text-slate-400 hover:text-slate-600">
            인증번호 다시 받기
          </button>
        </form>
      )}
      {msg && <p className="text-sm text-rose-600">{msg}</p>}
      <p className="text-[11px] leading-relaxed text-slate-400">
        주민등록번호는 묻지 않아요. 번호가 바뀌었다면 병원에 알려 주세요.
      </p>
    </div>
  );
}
