import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { getAllInstitutions } from "@/app/actions/admin";
import { InstitutionList } from "@/components/admin/institution-list";

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user.email)) redirect("/");

  const result = await getAllInstitutions();
  const institutions = result.ok ? result.institutions : [];

  const totalMembers = institutions.reduce((s, i) => s + i.member_count, 0);
  const activeMembers = institutions.reduce((s, i) => s + i.active_member_count, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">슈퍼어드민</h1>
          <p className="mt-1 text-sm text-slate-500">
            모든 기관·직원·실험실을 통합 관리합니다. (최고 관리자 전용)
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/admin/announcements"
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
          >
            공지 발행 →
          </Link>
          <Link
            href="/admin/usage"
            className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
          >
            사용량 · 크레딧 →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-2xl font-bold text-slate-900">{institutions.length}</div>
          <div className="mt-1 text-xs text-slate-500">전체 기관</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-2xl font-bold text-slate-900">{totalMembers}</div>
          <div className="mt-1 text-xs text-slate-500">전체 직원</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-2xl font-bold text-sky-600">{activeMembers}</div>
          <div className="mt-1 text-xs text-slate-500">활성 직원</div>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-800">기관 목록</h2>
        {institutions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400 shadow-sm">
            등록된 기관이 없습니다.
          </div>
        ) : (
          <InstitutionList institutions={institutions} />
        )}
      </section>
    </div>
  );
}
