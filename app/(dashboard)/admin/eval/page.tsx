import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isSuperAdmin } from "@/lib/admin";
import { getAllInstitutions } from "@/app/actions/admin";
import { EvalManager } from "@/components/admin/eval-manager";

// spec 034 — 상담 품질 평가 · 🧪 테스트중
// 접근: 슈퍼어드민(전 기관) 또는 eval_grants에 등록된 이메일(부여된 기관만 —
// 상담자 당사자·기획공장 평가자). 권한 없는 사용자는 홈으로.
export default async function AdminEvalPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const superAdmin = isSuperAdmin(user.email);
  let institutions: { id: string; name: string; canEvaluate: boolean }[] = [];

  if (superAdmin) {
    const result = await getAllInstitutions();
    institutions = result.ok
      ? result.institutions.map((i) => ({ id: i.id, name: i.name, canEvaluate: true }))
      : [];
  } else {
    const admin = createAdminSupabaseClient();
    const { data: grants } = await admin
      .from("eval_grants")
      .select("institution_id, can_view, can_evaluate")
      .eq("grantee_email", (user.email ?? "").toLowerCase())
      .eq("can_view", true);
    if (!grants || grants.length === 0) redirect("/");

    const ids = grants.map((g) => g.institution_id as string);
    const { data: insts } = await admin.from("institutions").select("id, name").in("id", ids);
    const nameMap = new Map((insts ?? []).map((i) => [i.id as string, i.name as string]));
    institutions = grants.map((g) => ({
      id: g.institution_id as string,
      name: nameMap.get(g.institution_id as string) ?? "(기관)",
      canEvaluate: g.can_evaluate === true,
    }));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        {superAdmin && (
          <Link href="/admin" className="text-sm text-slate-400 transition hover:text-slate-600">
            ← 슈퍼어드민
          </Link>
        )}
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">상담 품질 평가</h1>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            🧪 테스트중
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {superAdmin
            ? "상담 기록을 체크리스트와 대조해 AI가 항목별로 판정합니다. 어조·경청 등 음성 항목은 녹음을 듣고 수동으로 입력합니다. 점수는 실험값이며 기획공장과 시뮬레이션하며 정교화합니다. 코칭 보조 도구이지 인사평가 근거가 아닙니다."
            : "부여된 워크스페이스의 상담 평가에 참여합니다. AI 판정 결과를 검토하고, 어조·경청 등 음성 항목을 수동으로 입력해 주세요. 점수는 실험값이며 시뮬레이션하며 함께 정교화합니다. 코칭 보조 도구이지 인사평가 근거가 아닙니다."}
        </p>
      </div>

      <EvalManager institutions={institutions} superAdmin={superAdmin} />
    </div>
  );
}
