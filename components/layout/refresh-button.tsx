"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title="새로고침"
      onClick={() => startTransition(() => { router.refresh(); })}
      disabled={pending}
      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
    >
      <svg
        className={`size-4 ${pending ? "animate-spin" : ""}`}
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H5.498a.75.75 0 0 0-.75.75v3.498a.75.75 0 0 0 1.5 0v-1.688l.235.234a7 7 0 0 0 11.715-3.138.75.75 0 0 0-1.426-.47Zm-3.94-9.414a7 7 0 0 0-11.715 3.138.75.75 0 0 0 1.426.47 5.5 5.5 0 0 1 9.201-2.466l.312.311H8.163a.75.75 0 0 0 0 1.5h3.498a.75.75 0 0 0 .75-.75V.75a.75.75 0 0 0-1.5 0v1.688l-.235-.234Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}
