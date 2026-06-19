"use client";

import { useState, useTransition } from "react";
import { getConsultationAudioUrl } from "@/app/actions/audio";

/**
 * 상담 음성 원본 재청취 버튼(spec 009). 클릭 시 서명 URL을 받아 재생.
 * 권한·등급·만료는 서버가 판정하고, 못 듣는 사유는 안내한다.
 */
export function AudioReplayButton({
  consultationId,
  className,
}: {
  consultationId: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const handleClick = () => {
    setMsg("");
    start(async () => {
      const r = await getConsultationAudioUrl(consultationId);
      if (r.ok) setUrl(r.url);
      else setMsg(r.message);
    });
  };

  if (url) {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <audio src={url} controls autoPlay className="h-9 w-full max-w-xs" />;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={
          className ??
          "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        }
      >
        🔊 {pending ? "불러오는 중…" : "음성 듣기"}
      </button>
      {msg && <span className="text-xs text-slate-400">{msg}</span>}
    </span>
  );
}
