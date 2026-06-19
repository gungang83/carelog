"use client";

import { useState } from "react";
import { htmlToPlainText } from "@/lib/html-to-text";

/**
 * 상담 내용(HTML)을 평문으로 클립보드에 복사하는 버튼.
 * 덴트웹 등 외부 EMR 텍스트 칸에 바로 붙여넣기 위함.
 */
export function CopyAllButton({
  html,
  label = "전체 복사",
  className,
}: {
  html: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");

  const handleCopy = async () => {
    const text = htmlToPlainText(html);
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
      setTimeout(() => setState("idle"), 1500);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        className ??
        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white transition hover:bg-slate-900"
      }
    >
      <CopyIcon className="size-4" />
      {state === "done" ? "복사됨 ✓" : state === "error" ? "복사 실패" : label}
    </button>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7Zm0 1.5h6a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5Z" />
      <path d="M4 6.5A1.5 1.5 0 0 0 3 8v8a2 2 0 0 0 2 2h6a1.5 1.5 0 0 0 1.415-1H5a1 1 0 0 1-1-1V6.5Z" />
    </svg>
  );
}
