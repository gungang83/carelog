"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// spec 015 — 리포트 날짜 내비. 전일/익일 + 날짜 직접 선택(검색).
function shift(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  d.setTime(d.getTime() + n * 86400000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export function ReportDateNav({ date }: { date: string }) {
  const router = useRouter();
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 text-sm">
      <Link href={`/admin/usage/report/${shift(date, -1)}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 hover:bg-slate-50">← 전일</Link>
      <input
        type="date"
        value={date}
        onChange={(e) => { if (e.target.value) router.push(`/admin/usage/report/${e.target.value}`); }}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700"
      />
      <Link href={`/admin/usage/report/${shift(date, 1)}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 hover:bg-slate-50">익일 →</Link>
      <Link href="/admin/usage" className="ml-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 font-medium text-sky-700 hover:bg-sky-100">대시보드</Link>
    </div>
  );
}
