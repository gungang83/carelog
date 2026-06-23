"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISS_KEY = "carelog_ws_help_dismissed_v1";

/**
 * 진입점 상황 배너 — 사용자가 워크스페이스(병원) 2곳 이상에 속해 있을 때만 노출.
 * EO 연동·중복 워크스페이스 안내가 가장 필요한 상황이라, 전환 방법 + 도움말 링크를 띄운다.
 * 닫으면 localStorage에 기억해 다시 띄우지 않는다(잔소리 방지).
 */
export function WorkspaceHelpBanner({ institutionCount }: { institutionCount: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (institutionCount > 1 && localStorage.getItem(DISMISS_KEY) !== "1") {
      setShow(true);
    }
  }, [institutionCount]);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
      <span className="mt-0.5 text-lg" aria-hidden="true">
        🏥
      </span>
      <div className="min-w-0 flex-1 text-sm text-slate-700 break-keep">
        <p className="font-semibold text-slate-800">여러 워크스페이스에 속해 있어요</p>
        <p className="mt-0.5 text-slate-600">
          상단의 병원 이름을 눌러 전환할 수 있어요. EO 연동·중복 워크스페이스 정리 방법은{" "}
          <Link href="/help" className="font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-800">
            도움말
          </Link>
          에서 확인하세요.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="안내 닫기"
        className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-600"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  );
}
