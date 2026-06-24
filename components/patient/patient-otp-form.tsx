"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyPatientOtp } from "@/app/actions/patient-portal";

type Props = {
  phone: string;
  rrnHash: string;
  invitationToken?: string;
};

export function PatientOtpForm({ phone, rrnHash, invitationToken }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<
    "idle" | "verifying" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [isNewAccount, setIsNewAccount] = useState(false);

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
      setIsNewAccount(result.isNewAccount);
      setStatus("success");
    } else {
      setStatus("error");
      setMessage(result.message);
    }
  }

  function handleContinue() {
    if (isNewAccount && invitationToken) {
      router.push(`/portal/signup-cta?invitation=${invitationToken}`);
    } else {
      router.push("/portal/records");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-5 py-2 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-green-600">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900">인증 완료!</p>
          <p className="mt-1 text-sm text-slate-500">
            {isNewAccount
              ? "케어로그에 가입하면 언제든 상담 기록을 확인할 수 있어요."
              : "상담 내역을 확인할 수 있습니다."}
          </p>
        </div>
        <button
          onClick={handleContinue}
          className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
        >
          {isNewAccount ? "가입하고 계속하기 →" : "내 상담 기록 보기 →"}
        </button>
        {isNewAccount && (
          <button
            onClick={() => router.push("/portal/records")}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            나중에 가입하기
          </button>
        )}
      </div>
    );
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
        <p className="text-sm text-red-600">{message}</p>
      )}

      <button
        type="submit"
        disabled={status === "verifying"}
        className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {status === "verifying" ? "확인 중..." : "확인"}
      </button>

      <p className="text-center text-xs text-slate-400">
        인증번호가 오지 않으면 이전 화면으로 돌아가 다시 시도해 주세요.
      </p>
    </form>
  );
}
