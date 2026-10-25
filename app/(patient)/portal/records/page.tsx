import { redirect } from "next/navigation";
import { getPatientSession } from "@/lib/patient-session";
import { getPatientRecords } from "@/app/actions/patient-portal";
import { PatientRecordsList } from "@/components/patient/patient-records-list";
import { PatientPushBanner } from "@/components/patient/patient-push-banner";
import { getPatientShares } from "@/app/actions/patient-shares";
import Link from "next/link";

export default async function PatientRecordsPage() {
  const session = await getPatientSession();

  if (!session) {
    redirect("/portal/login");
  }

  // spec 038 ⓒ — 받은 상담 안내 + 연결된 상담 기록 전부
  const [result, sharesRes] = await Promise.all([getPatientRecords(), getPatientShares()]);
  const records = result.ok ? result.records : [];
  const shares = sharesRes.ok ? sharesRes.shares : [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <PatientPushBanner />
      {!result.ok && (
        <p className="mb-4 text-sm text-red-600">{result.message}</p>
      )}
      {shares.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">받은 상담 안내</h2>
          <ul className="flex flex-col gap-2">
            {shares.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/portal/s/${s.id}`}
                  className="flex items-center gap-3 rounded-xl border border-sky-100 bg-white px-4 py-3 shadow-sm hover:border-sky-300"
                >
                  <span className="text-lg">📩</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800">
                      {s.patientName}님 상담 안내
                      {!s.viewed && <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">새 안내</span>}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {s.institutionName} · {new Date(s.sentAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                    </span>
                  </span>
                  <span className="text-slate-300">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <h2 className="mb-2 text-sm font-semibold text-slate-700">상담 기록</h2>
      <PatientRecordsList records={records} />
    </div>
  );
}
