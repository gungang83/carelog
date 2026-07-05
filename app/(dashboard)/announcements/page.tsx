import Link from "next/link";
import { getActiveAnnouncements } from "@/app/actions/announcements";
import { levelMeta } from "@/lib/announcements";

// spec 022 공지·업데이트 전체보기 — 티커에서 '전체보기' 진입. 활성 공지를 고정 우선·최신순으로.
export default async function AnnouncementsPage() {
  const items = await getActiveAnnouncements(100);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold text-slate-900">공지 · 업데이트</h1>
        <Link href="/" className="ml-auto text-xs font-medium text-sky-600 hover:text-sky-700">
          홈으로
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-10 text-center text-sm text-slate-400">
          등록된 공지가 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => {
            const m = levelMeta(a.level);
            return (
              <li
                key={a.id}
                className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ${
                  a.pinned ? "border-l-4 border-l-amber-400" : ""
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                    {m.emoji} {m.label}
                  </span>
                  {a.pinned && <span className="text-amber-500">📌 고정</span>}
                  <span className="ml-auto">{formatDate(a.created_at)}</span>
                </div>
                <h2 className="text-sm font-semibold text-slate-800">{a.title}</h2>
                {a.body && (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{a.body}</p>
                )}
                <div className="mt-2 flex items-center gap-3 text-xs">
                  {a.link && (
                    <Link href={a.link} className="font-medium text-sky-600 hover:text-sky-700">
                      자세히 보기 →
                    </Link>
                  )}
                  {a.created_by && <span className="text-slate-400">— {a.created_by}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(
    d.getDate(),
  ).padStart(2, "0")}.`;
}
