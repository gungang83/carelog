import { redirect } from "next/navigation";
import { getLabOrderContext, getMyLabOrders } from "@/app/actions/lab-orders";
import { LabOrdersView } from "@/components/lab/lab-orders-view";

// spec 035 — 기공지 (종이 기공지 대체 · EO로 전송) · 🧪 테스트중
export default async function LabOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const [ctxResult, listResult, params] = await Promise.all([
    getLabOrderContext(),
    getMyLabOrders(),
    searchParams,
  ]);
  if (!ctxResult.ok) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">기공지</h1>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            🧪 테스트중
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          종이 기공지 대신 여기서 작성합니다 — 치식·보철·지시·사진·동영상·손그림까지 담아
          [기공소로 보내기]를 누르면 EO를 통해 기공소에 전달됩니다.
        </p>
      </div>

      <LabOrdersView
        ctx={ctxResult.ctx}
        rows={listResult.ok ? listResult.rows : []}
        openNew={params.new === "1"}
      />
    </div>
  );
}
