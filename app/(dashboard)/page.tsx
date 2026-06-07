import { PatientHome } from "@/components/patient-home";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { PushNotificationBanner } from "@/components/push-notification-banner";
import { ConsultHero } from "@/components/chair/consult-hero";
import { UnlinkedRecordsSection } from "@/components/chair/unlinked-records-section";
import { getActivityLogs } from "@/app/actions/activity";
import { getAllUnlinkedRecords } from "@/app/actions/chairs";

export default async function Home() {
  const [activityResult, initialUnlinked] = await Promise.all([
    getActivityLogs(50),
    getAllUnlinkedRecords(),
  ]);
  const logs = activityResult.ok ? activityResult.logs : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      {/* 최상단 히어로 — 진료 기록 진입점 */}
      <ConsultHero />

      {/* 아래로 펼쳐지는 대시보드 요소들 */}
      <PushNotificationBanner />

      <UnlinkedRecordsSection initialRecords={initialUnlinked} />

      <PatientHome />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          최근 활동
        </h2>
        <ActivityFeed logs={logs} />
      </section>
    </div>
  );
}
