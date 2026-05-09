"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signUp } from "@/app/actions/auth";

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await signUp(formData);
      if (!result.ok) {
        setError(result.message);
      } else if (result.needsConfirmation) {
        setConfirmed(true);
      }
      // 이메일 확인 불필요한 경우 signUp 내부에서 redirect("/") 호출
    });
  }

  if (confirmed) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-6">
          <p className="text-sm font-semibold text-sky-800">
            가입 이메일을 확인해 주세요
          </p>
          <p className="mt-1 text-sm text-slate-600">
            받은편지함에서 인증 링크를 클릭하면 로그인할 수 있습니다.
          </p>
        </div>
        <Link
          href="/login"
          className="text-sm font-semibold text-sky-600 hover:text-sky-700"
        >
          로그인 페이지로
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="institution_name"
          className="text-sm font-medium text-slate-600"
        >
          기관명
        </label>
        <input
          id="institution_name"
          name="institution_name"
          type="text"
          required
          placeholder="예) 건강치과의원"
          className="min-h-11 rounded-xl border border-sky-200 bg-sky-50/50 px-4 text-slate-900 outline-none ring-sky-400/40 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-sm font-medium text-slate-600"
        >
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="doctor@clinic.com"
          className="min-h-11 rounded-xl border border-sky-200 bg-sky-50/50 px-4 text-slate-900 outline-none ring-sky-400/40 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-sm font-medium text-slate-600"
        >
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          placeholder="6자 이상"
          className="min-h-11 rounded-xl border border-sky-200 bg-sky-50/50 px-4 text-slate-900 outline-none ring-sky-400/40 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-700 disabled:opacity-60"
      >
        {isPending ? "등록 중..." : "기관 등록 및 가입"}
      </button>

      <p className="text-center text-sm text-slate-500">
        이미 계정이 있으신가요?{" "}
        <Link
          href="/login"
          className="font-semibold text-sky-600 hover:text-sky-700"
        >
          로그인
        </Link>
      </p>
    </form>
  );
}
