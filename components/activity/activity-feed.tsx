"use client";

import { useState } from "react";
import Link from "next/link";
import type { ActivityLogEntry } from "@/app/actions/activity";

const EVENT_LABEL: Record<string, string> = {
  "consultation.created": "상담 기록",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;

  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;

  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

interface ActivityFeedProps {
  logs: ActivityLogEntry[];
}

const INITIAL_COUNT = 5;

export function ActivityFeed({ logs }: ActivityFeedProps) {
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? logs : logs.slice(0, INITIAL_COUNT);
  const hasMore = logs.length > INITIAL_COUNT;

  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-6 text-center text-sm text-slate-400">
        아직 기록된 활동이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {visible.map((log) => (
          <li key={log.id}>
            {log.consultation_id && log.patient_id ? (
              <Link
                href={`/patients/${log.patient_id}#consultation-${log.consultation_id}`}
                className="group flex items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 transition hover:border-sky-100 hover:bg-sky-50"
              >
                <LogIcon />
                <LogContent log={log} />
              </Link>
            ) : (
              <div className="flex items-start gap-3 rounded-xl px-3 py-2.5">
                <LogIcon />
                <LogContent log={log} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
        >
          {expanded ? "접기" : `전체 ${logs.length}개 보기`}
        </button>
      )}
    </div>
  );
}

function LogIcon() {
  return (
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
      <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 4h12M2 8h8M2 12h5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function LogContent({ log }: { log: ActivityLogEntry }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-slate-800">
          {log.patient_name ?? "알 수 없는 환자"}
        </span>
        <span className="shrink-0 text-xs text-slate-400">{formatDate(log.created_at)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {EVENT_LABEL[log.event_type] ?? log.event_type}
        </span>
        {log.content_preview && (
          <p className="truncate text-xs text-slate-500">{log.content_preview}</p>
        )}
      </div>
    </div>
  );
}
