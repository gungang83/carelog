"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ANNOUNCEMENT_LEVELS } from "@/lib/announcements";
import {
  UPDATE_FEED,
  composeAnnouncementDraft,
  type UpdateFeedItem,
} from "@/lib/update-feed";
import {
  publishUpdateAnnouncement,
  dismissUpdateEntries,
  clearUpdateDecision,
} from "@/app/actions/update-feed";

// spec 023 업데이트 피드 — 대기 항목 선택 → 공지 문구 자동 조합(수정 가능) → 발행 / 보류.
export function UpdateFeedManager({ initialItems }: { initialItems: UpdateFeedItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<UpdateFeedItem[]>(initialItems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<{ title: string; body: string } | null>(null);
  const [level, setLevel] = useState<string>("update");
  const [pinned, setPinned] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const pendingItems = useMemo(() => items.filter((i) => !i.decision), [items]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setDraft(null);
  };

  const makeDraft = () => {
    setMsg("");
    // 피드 원본(시간순)에서 선택 항목만 뽑아 조합 — 공지 본문이 자연스러운 순서가 되게.
    const chosen = UPDATE_FEED.filter((e) => selected.has(e.id));
    if (chosen.length === 0) {
      setMsg("먼저 항목을 선택해 주세요.");
      return;
    }
    setDraft(composeAnnouncementDraft(chosen));
  };

  const publish = () => {
    if (!draft) return;
    setMsg("");
    startTransition(async () => {
      const r = await publishUpdateAnnouncement({
        entryIds: [...selected],
        title: draft.title,
        body: draft.body,
        level,
        pinned,
      });
      if (!r.ok) {
        setMsg(r.message);
        return;
      }
      setSelected(new Set());
      setDraft(null);
      setLevel("update");
      setPinned(false);
      router.refresh();
    });
  };

  const dismissSelected = () => {
    setMsg("");
    if (selected.size === 0) {
      setMsg("먼저 항목을 선택해 주세요.");
      return;
    }
    startTransition(async () => {
      const ids = [...selected];
      const r = await dismissUpdateEntries(ids);
      if (!r.ok) {
        setMsg(r.message);
        return;
      }
      setItems((l) =>
        l.map((x) =>
          ids.includes(x.id)
            ? {
                ...x,
                decision: {
                  entry_id: x.id,
                  status: "dismissed",
                  announcement_id: null,
                  decided_at: new Date().toISOString(),
                },
              }
            : x,
        ),
      );
      setSelected(new Set());
      setDraft(null);
      router.refresh();
    });
  };

  const clearDecision = (id: string) =>
    startTransition(async () => {
      const r = await clearUpdateDecision(id);
      if (!r.ok) {
        setMsg(r.message);
        return;
      }
      setItems((l) => l.map((x) => (x.id === id ? { ...x, decision: null } : x)));
      router.refresh();
    });

  return (
    <div className="space-y-6">
      {/* 선택 액션 바 */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="text-sm text-slate-600">
          대기 {pendingItems.length}건 · 선택 {selected.size}건
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={dismissSelected}
            disabled={pending || selected.size === 0}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            보류
          </button>
          <button
            type="button"
            onClick={makeDraft}
            disabled={pending || selected.size === 0}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
          >
            선택 항목으로 공지 문구 만들기
          </button>
        </div>
      </div>

      {/* 발행 폼 (문구 만들기 후 노출, 수정 가능) */}
      {draft && (
        <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/50 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">
            공지 초안 — 수정 후 발행하세요
          </h2>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            rows={8}
            className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-sky-500"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
            >
              {ANNOUNCEMENT_LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.emoji} {l.label}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="size-4 rounded border-slate-300"
              />
              📌 고정
            </label>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => setDraft(null)}
                disabled={pending}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={publish}
                disabled={pending}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
              >
                {pending ? "발행 중…" : "공지 발행"}
              </button>
            </div>
          </div>
        </div>
      )}
      {msg && <p className="text-xs text-red-500">{msg}</p>}

      {/* 피드 목록 (최신 우선) */}
      <ul className="space-y-2">
        {items.map((e) => {
          const decided = e.decision;
          return (
            <li
              key={e.id}
              className={`rounded-xl border bg-white p-3 shadow-sm ${
                decided ? "border-slate-100 opacity-70" : "border-slate-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggle(e.id)}
                  disabled={!!decided || pending}
                  className="mt-1 size-4 rounded border-slate-300 disabled:opacity-40"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>{e.date}</span>
                    {e.internal && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                        {e.internal}
                      </span>
                    )}
                    {decided ? (
                      decided.status === "published" ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                          공지 발행됨
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                          보류
                        </span>
                      )
                    ) : (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700">
                        대기
                      </span>
                    )}
                    {decided && (
                      <button
                        type="button"
                        onClick={() => clearDecision(e.id)}
                        disabled={pending}
                        className="rounded-lg border border-slate-200 px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                      >
                        대기로 되돌리기
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {e.emoji ?? "✨"} {e.title}
                  </p>
                  <ul className="mt-0.5 list-inside list-disc text-xs leading-5 text-slate-500">
                    {e.items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
