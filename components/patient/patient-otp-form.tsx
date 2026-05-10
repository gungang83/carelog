"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyPatientOtp, requestPatientOtp } from "@/app/actions/patient-portal";

type Props = {
  phone: string;
  rrnHash: string;
  invitationToken?: string;
};

export function PatientOtpForm({ phone, rrnHash, invitationToken }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<
    "idle" | "verifying" | "resending" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("verifying");
    setMessage("");

    const formData = new FormData(e.currentTarget);
    formData.set("phone", phone);
    formData.set("rrn_hash", rrnHash);
    if (invitationToken) formData.set("invitation_token", invitationToken);

    const result = await verifyPatientOtp(formData);

    if (result.ok) {
      router.push("/portal/records");
    } else {
      setStatus("error");
      setMessage(result.message);
    }
  }

  async function handleResend() {
    setStatus("resending");
    setMessage("");

    // requestPatientOtp needs rrn_front/rrn_back but we only have rrnHash here.
    // We cannot resend without them — user must go back to the login page.
    setStatus("error");
    setMessage("인증번호를 다시 받으려면 이전 화면으로 돌아가 주세요.");
  }

  return (
    <form onSubmit={handleVerify} className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        <span className="font-medium">{phone}</span>으로 6자리 인증번호를
        발송했습니다. 5분 이내에 입력해 주세요.
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          인증번호
        </label>
        <input
          type="text"
          name="code"
          placeholder="6자리 숫자"
          maxLength={6}
          inputMode="numeric"
          pattern="\d{6}"
          required
          autoFocus
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
        />
      </div>

      {message && (
        <p
          className={`text-sm ${message.includes("재발송") ? "text-green-600" : "text-red-600"}`}
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "verifying" || status === "resending"}
        className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {status === "verifying" ? "확인 중..." : "확인"}
      </button>

      <button
        type="button"
        onClick={handleResend}
        disabled={status === "verifying" || status === "resending"}
        className="text-sm text-sky-600 hover:underline disabled:opacity-50"
      >
        인증번호 재발송
      </button>
    </form>
  );
}
