"use client";

import { useEffect, useState } from "react";
import { subscribeBoardLive, type BoardLivePayload } from "@/lib/realtime/board-live";

/**
 * 진행 중인 상담 실시간 배너 (C-05 1단계).
 * 같은 기관의 다른 기기에서 상담보드를 작성 중이면 "△△님이 □ 체어에서 작성 중"을 실시간 표시.
 * broadcast(self:false)라 자기 탭은 제외. 종료 신호를 못 받고 기기가 닫히는 경우를 대비해
 * 마지막 수신 후 12초가 지난 세션은 stale로 정리한다.
 */
const STALE_MS = 12_000;

type LiveSession = { payload: BoardLivePayload; lastSeen: number };

export function LiveSessionsBanner({ institutionId }: { institutionId: string }) {
  const [sessions, setSessions] = useState<Map<string, LiveSession>>(new Map());

  useEffect(() => {
    if (!institutionId) return;

    const unsub = subscribeBoardLive(institutionId, (p) => {
      setSessions((prev) => {
        const next = new Map(prev);
        if (p.ended) next.delete(p.sessionId);
        else next.set(p.sessionId, { payload: p, lastSeen: Date.now() });
        return next;
      });
    });

    const gc = setInterval(() => {
      setSessions((prev) => {
        const now = Date.now();
        let changed = false;
        const next = new Map(prev);
        for (const [id, v] of next) {
          if (now - v.lastSeen > STALE_MS) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 4000);

    return () => {
      unsub();
      clearInterval(gc);
    };
  }, [institutionId]);

  const list = [...sessions.values()];
  if (list.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3">
      <p className="flex items-center gap-2 text-xs font-semibold text-rose-700">
        <span className="inline-block size-2 animate-pulse rounded-full bg-rose-500" />
        진행 중인 상담 {list.length > 1 ? `${list.length}건` : ""}
      </p>
      <ul className="flex flex-col gap-1.5">
        {list.map(({ payload }) => (
          <li
            key={payload.sessionId}
            className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate text-slate-700 break-keep">
              <strong className="font-semibold text-slate-800">{payload.author || "직원"}</strong>
              님이 {payload.chairName ? `${payload.chairName}에서 ` : ""}상담 기록 작성 중
            </span>
            <span className="shrink-0 text-xs text-slate-400">
              {elapsedLabel(payload.startedAt)} · {payload.charCount}자
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function elapsedLabel(startedAt: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  if (sec < 60) return `${sec}초`;
  return `${Math.floor(sec / 60)}분`;
}
