import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { UsageDashboard } from "@/components/admin/usage-dashboard";

// spec 013 — 슈퍼어드민 사용량·크레딧 대시보드(EO /superadmin/menu-usage 벤치마크).
export default async function AdminUsagePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user.email)) redirect("/");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">사용량 · 크레딧</h1>
          <p className="mt-1 text-sm text-slate-500">
            메뉴 사용량과 AI 크레딧 사용을 기관·직원·기능별로 확인합니다. (최고 관리자 전용)
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          ← 슈퍼어드민
        </Link>
      </div>
      <UsageDashboard />
    </div>
  );
}
