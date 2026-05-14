"use client";

import { useState } from "react";
import { updateInstitutionName } from "@/app/actions/admin";

interface InstitutionNameFormProps {
  currentName: string;
}

export function InstitutionNameForm({ currentName }: InstitutionNameFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const result = await updateInstitutionName(name);
    if (result.ok) {
      setStatus("success");
      setMessage("기관명이 업데이트되었습니다.");
    } else {
      setStatus("error");
      setMessage(result.message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      {message && (
        <div
          className={`mb-3 rounded-xl border px-4 py-3 text-sm ${
            status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        기관명
      </label>
      <div className="flex gap-3">
        <input
          type="text"
          name="name"
          required
          defaultValue={currentName}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-400/30 focus:border-sky-300 focus:ring-2"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-60"
        >
          {status === "loading" ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}
