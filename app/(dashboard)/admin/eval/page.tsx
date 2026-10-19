import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { getAllInstitutions } from "@/app/actions/admin";
import { EvalManager } from "@/components/admin/eval-manager";

// spec 034 — 상담 품질 평가 · 🧪 테스트중 (v1 슈퍼어드민 전용)
export default async function AdminEvalPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user.email)) redirect("/");

  const result = await getAllInstitutions();
  const institutions = result.ok
    ? result.institutions.map((i) => ({ id: i.id, name: i.name }))
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <Link href="/admin" className="text-sm text-slate-400 transition hover:text-slate-600">
          ← 슈퍼어드민
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">상담 품질 평가</h1>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            🧪 테스트중
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          상담 기록을 체크리스트와 대조해 AI가 항목별로 판정합니다. 어조·경청 등 음성 항목은
          녹음을 듣고 수동으로 입력합니다. 점수는 실험값이며 기획공장과 시뮬레이션하며 정교화합니다.
          코칭 보조 도구이지 인사평가 근거가 아닙니다.
        </p>
      </div>

      <EvalManager institutions={institutions} />
    </div>
  );
}
