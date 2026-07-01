import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser, getMyInstitutionId } from "@/lib/auth/institution";
import { buildDailyReport, getStoredReport, kstToday } from "@/lib/usage/daily-report";
import { DailyReportView } from "@/components/admin/daily-report-view";

// spec 019 — 운영자(기관 관리자)용 일일 사용 리포트. 자기 워크스페이스만.
//   슈퍼어드민용 /admin/usage/report/[date]와 별개(그건 전체 워크스페이스).
export const dynamic = "force-dynamic";

export default async function OperatorDailyReportPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const institutionId = await getMyInstitutionId();
  if (!institutionId) redirect("/");

  // 운영자(owner/admin)만 — 워크스페이스 전체 사용 지표는 관리자 권한 필요
  const supabase = await createServerSupabaseClient();
  const { data: member } = await supabase
    .from("institution_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  const role = (member?.role as string) ?? "staff";
  if (role !== "owner" && role !== "admin") redirect("/");

  const { date: raw } = await params;
  const date = raw === "today" ? kstToday() : raw;

  let stored = true;
  let report = await getStoredReport(date, institutionId);
  if (!report) {
    stored = false;
    report = await buildDailyReport({ date, scope: institutionId });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <DailyReportView
        report={report}
        stored={stored}
        scopeLabel="우리 워크스페이스"
        basePath="/reports/daily"
        dashboardHref={null}
      />
    </div>
  );
}
