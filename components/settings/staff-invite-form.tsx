"use client";

import { useState } from "react";
import { inviteStaff } from "@/app/actions/institutions";

export function StaffInviteForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    const formData = new FormData(e.currentTarget);
    const result = await inviteStaff(formData);
    if (result.ok) {
      setStatus("success");
      setMessage("초대 이메일을 발송했습니다.");
      (e.target as HTMLFormElement).reset();
    } else {
      setStatus("error");
      setMessage(result.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          name="email"
          required
          placeholder="이메일 주소"
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-400/30 focus:border-sky-300 focus:ring-2"
        />
        <select
          name="role"
          defaultValue="staff"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-400/30 focus:border-sky-300 focus:ring-2"
        >
          <option value="staff">직원</option>
          <option value="admin">관리자</option>
        </select>
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-60"
        >
          {status === "loading" ? "전송 중…" : "초대"}
        </button>
      </div>
    </form>
  );
}
