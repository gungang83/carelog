import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { getUpdateFeed } from "@/app/actions/update-feed";
import { UpdateFeedManager } from "@/components/admin/update-feed-manager";

// spec 023 — 업데이트 피드 (슈퍼어드민 전용). 세션마다 쌓인 업데이트 내역을 보고
// 취사선택해 공지로 발행하거나 보류한다.
export default async function AdminUpdatesPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user.email)) redirect("/");

  const items = await getUpdateFeed();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">업데이트 피드</h1>
          <p className="mt-1 text-sm text-slate-500">
            배포된 업데이트 내역이 쌓입니다. 골라서 공지로 발행하거나 보류하세요. (최고 관리자 전용)
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          ← 슈퍼어드민
        </Link>
      </div>

      <UpdateFeedManager initialItems={items} />
    </div>
  );
}
