import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { listGlobalAssets } from "@/app/actions/consult-assets";
import { GlobalAssetsManager } from "@/components/admin/global-assets-manager";

// spec 029 ① — Carelog 공통 상담자료 발행 (슈퍼어드민 전용, 분과 타겟).
export default async function AdminAssetsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user.email)) redirect("/");

  const assets = await listGlobalAssets();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">공통 상담자료</h1>
          <p className="mt-1 text-sm text-slate-500">
            모든 워크스페이스에 제공되는 Carelog Library입니다. 분과 타겟에 맞는 기관에만 노출됩니다. (최고 관리자 전용)
          </p>
        </div>
        <Link href="/admin" className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
          ← 슈퍼어드민
        </Link>
      </div>
      <GlobalAssetsManager initialAssets={assets} />
    </div>
  );
}
