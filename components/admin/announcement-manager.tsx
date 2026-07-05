"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ANNOUNCEMENT_LEVELS,
  levelMeta,
  type Announcement,
} from "@/lib/announcements";
import {
  createAnnouncement,
  setAnnouncementActive,
  setAnnouncementPinned,
  deleteAnnouncement,
} from "@/app/actions/announcements";

// spec 022 공지 발행/관리 — 발행 폼 + 목록(활성 토글·고정·삭제). 슈퍼어드민 전용 페이지에서 사용.
export function AnnouncementManager({ initialItems }: { initialItems: Announcement[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Announcement[]>(initialItems);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [level, setLevel] = useState<string>("update");
  const [pinned, setPinned] = useState(false);
  const [endsAt, setEndsAt] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const refresh = () => router.refresh();

  const submit = () => {
    setMsg("");
    if (!title.trim()) {
      setMsg("제목을 입력해 주세요.");
      return;
    }
    startTransition(async () => {
      const r = await createAnnouncement({
        title,
        body,
        link,
        level,
        pinned,
        // datetime-local(로컬 시각) → ISO. 비우면 무기한.
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      });
      if (!r.ok) {
        setMsg(r.message);
        return;
      }
      setTitle("");
      setBody("");
      setLink("");
      setLevel("update");
      setPinned(false);
      setEndsAt("");
      refresh();
    });
  };

  const toggleActive = (a: Announcement) =>
    startTransition(async () => {
      setItems((l) => l.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x)));
      await setAnnouncementActive(a.id, !a.active);
      refresh();
    });

  const togglePinned = (a: Announcement) =>
    startTransition(async () => {
      setItems((l) => l.map((x) => (x.id === a.id ? { ...x, pinned: !x.pinned } : x)));
      await setAnnouncementPinned(a.id, !a.pinned);
      refresh();
    });

  const remove = (a: Announcement) =>
    startTransition(async () => {
      if (!window.confirm("이 공지를 삭제할까요? 되돌릴 수 없어요.")) return;
      setItems((l) => l.filter((x) => x.id !== a.id));
      await deleteAnnouncement(a.id);
      refresh();
    });

  return (
    <div className="space-y-6">
      {/* 발행 폼 */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">새 공지 발행</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="한 줄 문구 (티커에 흐를 제목)"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="상세 내용(선택) — 전체보기에서 노출"
          rows={3}
          className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
          >
            {ANNOUNCEMENT_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.emoji} {l.label}
              </option>
            ))}
          </select>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="링크(선택) 예: /help"
            className="min-w-[10rem] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
          />
          <label className="inline-flex items-center gap-1.5 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="size-4 rounded border-slate-300"
            />
            📌 고정
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-500">노출 종료(선택)</label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="ml-auto rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
          >
            {pending ? "발행 중…" : "발행"}
          </button>
        </div>
        {msg && <p className="text-xs text-red-500">{msg}</p>}
      </div>

      {/* 목록 */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">발행된 공지 ({items.length})</h2>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400">
            아직 발행한 공지가 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((a) => {
              const m = levelMeta(a.level);
              return (
                <li
                  key={a.id}
                  className={`rounded-xl border bg-white p-3 shadow-sm ${
                    a.active ? "border-slate-200" : "border-slate-100 opacity-60"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                      {m.emoji} {m.label}
                    </span>
                    {a.pinned && <span className="text-amber-500">📌</span>}
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        a.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {a.active ? "노출 중" : "숨김"}
                    </span>
                    <span className="ml-auto">{formatDate(a.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-800">{a.title}</p>
                  {a.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.body}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleActive(a)}
                      disabled={pending}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {a.active ? "숨기기" : "노출"}
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePinned(a)}
                      disabled={pending}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {a.pinned ? "고정 해제" : "고정"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(a)}
                      disabled={pending}
                      className="rounded-lg border border-red-100 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(
    d.getDate(),
  ).padStart(2, "0")}.`;
}
