import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { getAiAdminData } from "@/app/actions/ai-admin";
import { AiSettings } from "@/components/admin/ai-settings";

// spec 041 — AI 엔진 고르기(슈퍼어드민 전용): 작업별 모델 순서 · 사용량.
export default async function AdminAiPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user.email)) redirect("/");

  const r = await getAiAdminData(7);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI 엔진</h1>
          <p className="mt-1 text-sm text-slate-500">작업마다 어느 모델을 먼저 쓸지, 실패하면 무엇으로 넘어갈지 정합니다. (최고 관리자 전용)</p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          ← 슈퍼어드민
        </Link>
      </div>
      {r.ok ? <AiSettings initial={r.data} /> : <p className="text-sm text-red-600">{r.message}</p>}
    </div>
  );
}
