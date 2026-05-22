import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPatientSession } from "@/lib/patient-session";
import { getPatientRecords } from "@/app/actions/patient-portal";
import { PatientRecordsList } from "@/components/patient/patient-records-list";
import { PatientPushBanner } from "@/components/patient/patient-push-banner";

export default async function PatientRecordsPage() {
  const cookieStore = await cookies();
  const session = await getPatientSession(cookieStore);

  if (!session) {
    redirect("/portal/login");
  }

  const result = await getPatientRecords();
  const records = result.ok ? result.records : [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <PatientPushBanner />
      {!result.ok && (
        <p className="mb-4 text-sm text-red-600">{result.message}</p>
      )}
      <PatientRecordsList records={records} />
    </div>
  );
}
