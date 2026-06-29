import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { buildDailyReport, getStoredReport, kstToday } from "@/lib/usage/daily-report";
import { DailyReportView } from "@/components/admin/daily-report-view";

// spec 014 — 일일 사용 리포트 상세(슈퍼어드민). 발행본(usage_reports) 우선, 없으면 즉석 집계.
//   date = 'today' 또는 'YYYY-MM-DD'(KST). 알림 링크가 이 페이지를 가리킨다.
export const dynamic = "force-dynamic";

export default async function DailyReportPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user.email)) redirect("/");

  const { date: raw } = await params;
  const date = raw === "today" ? kstToday() : raw;

  // 발행본 우선(immutable), 없으면 즉석 집계(과거 임의일·당일 미발행분 열람)
  let stored = true;
  let report = await getStoredReport(date, "all");
  if (!report) {
    stored = false;
    report = await buildDailyReport({ date, scope: "all" });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <DailyReportView report={report} stored={stored} />
    </div>
  );
}
