import { PatientHome } from "@/components/patient-home";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { PushNotificationBanner } from "@/components/push-notification-banner";
import { QuickRecordTrigger } from "@/components/chair/quick-record-trigger";
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6">
      <header className="text-center sm:text-left">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-sky-600">
          Dental chart
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Carelog
        </h1>
        <p className="mt-2 max-w-xl text-slate-600">
          병원에서 나눈 진료 대화를 기록하면, 환자가 직접 받아 보관해요.
        </p>
      </header>

      <PushNotificationBanner />

      <QuickRecordTrigger />

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
