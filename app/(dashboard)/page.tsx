import { PatientHome } from "@/components/patient-home";
import { PushNotificationBanner } from "@/components/push-notification-banner";
import { ConsultHero } from "@/components/chair/consult-hero";
import { HomeFeed } from "@/components/home/home-feed";
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

      {/* 미연결 기록 + 최근 활동 통합 피드 (토글로 함께/하나씩) */}
      <HomeFeed initialRecords={initialUnlinked} logs={logs} />

      <PatientHome />
    </div>
  );
}
