"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { subscribeNotifications } from "@/lib/realtime/institution-events";
import type { NotificationItem } from "@/lib/types/database";

/**
 * 알림함 (spec 012) — 헤더 종 + 드롭다운 + 읽음관리. EO NotificationBell UX 포팅(Carelog 팔레트).
 * 적재된 알림을 최신순으로 보여주고, Supabase Realtime(+30초 폴백)으로 새 알림을 즉시 반영한다.
 */
const TYPE_ICON: Record<string, string> = {
  consultation_saved: "📝",
  consultation_linked: "🔗",
  announcement: "📣",
  system: "📢",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 2) return "어제";
  return new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

export function NotificationBell({ institutionId }: { institutionId: string }) {
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function fetchNotifs() {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setNotifs(d.notifications ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    fetchNotifs();
    const timer = setInterval(fetchNotifs, 30_000); // realtime 끊김 대비 폴백
    let unsubscribe: (() => void) | undefined;
    if (institutionId) {
      unsubscribe = subscribeNotifications({
        institutionId,
        onEvent: () => fetchNotifs(),
      });
    }
    return () => {
      clearInterval(timer);
      unsubscribe?.();
    };
  }, [institutionId]);

  // 외부 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unread = notifs.filter((n) => !n.isRead).length;

  // PWA 홈 아이콘 배지
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;
    if (unread > 0) nav.setAppBadge(unread).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [unread]);

  async function markRead(id: string) {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await fetch(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {});
  }

  async function markUnread(id: string) {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)));
    await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read: false }),
    }).catch(() => {});
  }

  async function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await fetch("/api/notifications/read-all", { method: "POST" }).catch(() => {});
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        aria-label="알림"
      >
        <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-2 top-[64px] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-1 sm:w-80">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">알림</h3>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-sky-600 transition-colors hover:text-sky-700"
                >
                  전체 읽음
                </button>
              )}
              {notifs.length > 0 && (
                <span className="text-xs text-slate-400">{notifs.length}개</span>
              )}
            </div>
          </div>
          <div className="max-h-[420px] divide-y divide-slate-50 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">알림이 없습니다</div>
            ) : (
              notifs.map((n) => (
                <div key={n.id} className={`flex items-center ${!n.isRead ? "bg-sky-50/50" : ""}`}>
                  <Link
                    href={n.link || "/"}
                    onClick={() => {
                      markRead(n.id);
                      setOpen(false);
                    }}
                    className="flex flex-1 gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50"
                  >
                    <span className="mt-0.5 flex-shrink-0 text-lg">
                      {TYPE_ICON[n.type] ?? "📢"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`line-clamp-2 break-words text-sm ${
                          !n.isRead ? "font-semibold text-slate-900" : "font-medium text-slate-500"
                        }`}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-3 break-words text-xs text-slate-500">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">{relativeTime(n.timestamp)}</p>
                    </div>
                  </Link>
                  <div className="flex-shrink-0 pr-4">
                    {n.isRead ? (
                      <button
                        type="button"
                        onClick={() => markUnread(n.id)}
                        title="읽음 취소"
                        className="text-sm text-emerald-500 transition-colors hover:text-slate-400"
                      >
                        ✓
                      </button>
                    ) : (
                      <span className="block size-2 rounded-full bg-sky-500" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
