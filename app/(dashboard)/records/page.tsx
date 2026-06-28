import Link from "next/link";
import { searchConsultations } from "@/app/actions/consultations";
import { getChairs } from "@/app/actions/chairs";
import { RecordsBrowser } from "@/components/records/records-browser";

/**
 * 상담 기록 전체보기 (spec 011) — 검색·필터·정렬로 쌓인 상담을 빠르게 찾는다.
 * 홈 '기록·활동'의 '전체보기'에서 진입. dashboard layout(maxDuration·auth) 상속.
 */
export default async function RecordsPage() {
  const [res, chairs] = await Promise.all([
    searchConsultations({ limit: 30 }),
    getChairs(),
  ]);
  const rows = res.ok ? res.rows : [];
  const hasMore = res.ok ? res.hasMore : false;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className="text-sm text-slate-400 hover:text-slate-600"
          aria-label="홈으로"
        >
          ← 홈
        </Link>
        <h1 className="text-lg font-bold text-slate-800">상담 기록 전체보기</h1>
      </div>
      <RecordsBrowser
        initialRows={rows}
        initialHasMore={hasMore}
        chairs={chairs.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
