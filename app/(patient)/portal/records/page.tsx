import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPatientSession } from "@/lib/patient-session";
import { getPatientRecords, patientLogout } from "@/app/actions/patient-portal";
import { PatientRecordsList } from "@/components/patient/patient-records-list";

export default async function PatientRecordsPage() {
  const cookieStore = await cookies();
  const session = await getPatientSession(cookieStore);

  if (!session) {
    redirect("/portal/login");
  }

  const result = await getPatientRecords();
  const records = result.ok ? result.records : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-sky-600">
              케어로그
            </p>
            <h1 className="text-lg font-semibold text-slate-900">
              내 상담 내역
            </h1>
          </div>
          <form action={patientLogout}>
            <button
              type="submit"
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {!result.ok && (
          <p className="text-sm text-red-600 mb-4">{result.message}</p>
        )}
        <PatientRecordsList records={records} />
      </main>
    </div>
  );
}
