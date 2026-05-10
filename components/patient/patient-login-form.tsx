"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestPatientOtp } from "@/app/actions/patient-portal";

type Props = {
  invitationToken?: string;
};

export function PatientLoginForm({ invitationToken }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    if (invitationToken) {
      formData.set("invitation_token", invitationToken);
    }

    const result = await requestPatientOtp(formData);

    if (result.ok) {
      const phone = String(formData.get("phone") ?? "").replace(/\D/g, "");
      const params = new URLSearchParams({
        phone,
        rrn_hash: result.rrnHash,
      });
      if (invitationToken) params.set("token", invitationToken);
      router.push(`/portal/verify?${params.toString()}`);
    } else {
      setStatus("error");
      setErrorMsg(result.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          주민등록번호
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            name="rrn_front"
            placeholder="앞 6자리"
            maxLength={6}
            inputMode="numeric"
            pattern="\d{6}"
            required
            className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
          />
          <span className="text-slate-400">—</span>
          <input
            type="password"
            name="rrn_back"
            placeholder="뒤 7자리"
            maxLength={7}
            inputMode="numeric"
            pattern="\d{7}"
            required
            className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          전화번호
        </label>
        <input
          type="tel"
          name="phone"
          placeholder="010-0000-0000"
          required
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
        />
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {status === "sending" ? "확인 중..." : "인증번호 받기"}
      </button>
    </form>
  );
}
