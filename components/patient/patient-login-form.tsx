"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestPatientOtp } from "@/app/actions/patient-portal";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Props = {
  invitationToken?: string;
};

export function PatientLoginForm({ invitationToken }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/patient-callback` },
    });
  }

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

      {!invitationToken && (
        <>
          <div className="relative flex items-center">
            <div className="flex-1 border-t border-slate-200" />
            <span className="mx-3 text-xs text-slate-400">또는</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {googleLoading ? "연결 중..." : "Google 계정으로 로그인"}
          </button>
        </>
      )}
    </form>
  );
}
