"use client";

import { useState, useTransition } from "react";
import { setupInstitution } from "@/app/actions/auth";

export function OnboardingForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await setupInstitution(formData);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="institution_name"
          className="text-sm font-medium text-slate-600"
        >
          기관명 (치과명)
        </label>
        <input
          id="institution_name"
          name="institution_name"
          type="text"
          autoComplete="organization"
          required
          placeholder="예: 예미안치과"
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
        {isPending ? "등록 중..." : "케어로그 시작하기"}
      </button>
    </form>
  );
}
