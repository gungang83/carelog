"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { levelMeta, type Announcement } from "@/lib/announcements";

// spec 022 공지 티커 — 헤더 아래 한 줄이 은은히 흐른다. '전체보기'로 목록으로.
//   너무 눈에 띄지 않게(작은 회색 글씨), 새 공지가 있으면 아주 작은 점만 표시.
//   놓치지 않도록 hover/focus 시 흐름이 멈춘다(globals.css). 공지 없으면 렌더 안 함.

const SEEN_KEY = "carelog.announce.seen"; // 마지막으로 '전체보기'로 확인한 시각(ms)

export function AnnouncementTicker({ items }: { items: Announcement[] }) {
  const [hasNew, setHasNew] = useState(false);

  // 가장 최근 공지 시각(ms) — localStorage의 last-seen과 비교해 '새 공지' 점 표시.
  const latest = useMemo(
    () => items.reduce((m, a) => Math.max(m, new Date(a.created_at).getTime()), 0),
    [items],
  );

  useEffect(() => {
    if (!latest) return;
    const seen = Number(localStorage.getItem(SEEN_KEY) || "0");
    setHasNew(latest > seen);
  }, [latest]);

  const markSeen = () => {
    if (latest) localStorage.setItem(SEEN_KEY, String(latest));
    setHasNew(false);
  };

  if (items.length === 0) return null;

  // 흐르는 텍스트 한 벌 — 제목들을 구분점으로 이어붙인다. 트랙을 2벌 렌더해 seamless 루프.
  const track = (
    <div className="flex shrink-0 items-center gap-6 pr-6" aria-hidden={false}>
      {items.map((a) => {
        const m = levelMeta(a.level);
        const content = (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[11px]">{m.emoji}</span>
            {a.pinned && <span className="text-amber-500">📌</span>}
            <span>{a.title}</span>
          </span>
        );
        return a.link ? (
          <Link
            key={a.id}
            href={a.link}
            className="text-slate-500 transition-colors hover:text-sky-600"
          >
            {content}
          </Link>
        ) : (
          <span key={a.id} className="text-slate-500">
            {content}
          </span>
        );
      })}
    </div>
  );

  // 콘텐츠 길이에 비례해 속도 조정(글자수 기반, 최소 18s). 너무 빠르지 않게.
  const totalChars = items.reduce((n, a) => n + a.title.length + 4, 0);
  const durationSec = Math.max(18, Math.round(totalChars * 0.5));

  return (
    <div className="carelog-ticker flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-1.5 text-xs">
      <span className="hidden shrink-0 items-center gap-1 font-medium text-slate-400 sm:inline-flex">
        <BullhornIcon className="size-3" />
        소식
      </span>
      {/* 흐르는 영역 */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div
          className="carelog-marquee flex w-max"
          style={{ animationDuration: `${durationSec}s` }}
        >
          {track}
          {track}
        </div>
      </div>
      {/* 전체보기 */}
      <Link
        href="/announcements"
        onClick={markSeen}
        className="relative shrink-0 rounded-md px-1.5 py-0.5 font-medium text-slate-400 transition-colors hover:text-sky-600"
      >
        전체보기
        {hasNew && (
          <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-sky-500" aria-label="새 공지" />
        )}
      </Link>
    </div>
  );
}

function BullhornIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M16 3a1 1 0 0 0-1.6-.8L7.7 7H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h.3l1 4.2a1 1 0 0 0 1 .8h1a1 1 0 0 0 1-1.2L8.7 13h-.9l6.6 4.8A1 1 0 0 0 16 17V3Z" />
    </svg>
  );
}
