import Link from "next/link";
import { getPatientById } from "@/app/actions/patients";
import { getConsultationsByPatientId } from "@/app/actions/consultations";
import { ConsultationForm } from "@/components/consultation-form";
import { ConsultationHistory } from "@/components/consultation-history";
import { PatientEditForm } from "@/components/patient-edit-form";
import { formatPhoneForList } from "@/lib/patient-search";
import { formatResidentNoForList } from "@/lib/rrn-core";

type PageProps = { params: Promise<{ patientId: string }> };

export default async function PatientConsultationPage({ params }: PageProps) {
  const { patientId } = await params;

  if (!patientId || patientId.trim() === "" || patientId === "undefined") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-red-600">
          환자 ID가 올바르지 않습니다: {String(patientId)}
        </p>
        <Link href="/" className="mt-4 inline-block text-sky-700 underline">
          처음으로
        </Link>
      </div>
    );
  }

  let patientIdBigint: bigint;
  try {
    patientIdBigint = BigInt(patientId);
  } catch {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-red-600">
          환자 ID 숫자 변환 실패: {String(patientId)}
        </p>
        <Link href="/" className="mt-4 inline-block text-sky-700 underline">
          처음으로
        </Link>
      </div>
    );
  }

  const res = await getPatientById(String(patientIdBigint));

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-red-600">{res.message}</p>
        <Link href="/" className="mt-4 inline-block text-sky-700 underline">
          처음으로
        </Link>
      </div>
    );
  }

  const { patient } = res;
  const consultRes = await getConsultationsByPatientId(patient.id);

  const consultations = consultRes.ok ? consultRes.consultations : [];
  const phoneMasked = formatPhoneForList(patient.phone);
  const rrnMasked = formatResidentNoForList(patient.resident_no);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 pb-16">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-sm font-medium text-sky-700 underline-offset-4 hover:underline"
        >
          ← 환자 검색
        </Link>
      </div>

      <header className="rounded-2xl border border-sky-100 bg-white px-6 py-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-sky-600">
          상담 기록
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {patient.name}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {patient.chart_no ? `차트번호 ${patient.chart_no}` : "차트번호 없음"}
          {phoneMasked ? ` · ${phoneMasked}` : " · 연락처 없음"}
          {rrnMasked ? ` · 주민번호: ${rrnMasked}` : ""}
        </p>
      </header>

      <PatientEditForm patient={patient} />

      <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm shadow-sky-100/60">
        <ConsultationForm
          patientId={patient.id}
          patientName={patient.name}
        />
      </section>

      <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm shadow-sky-100/60">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-sky-600">
              과거 상담 내역
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              타임라인
            </h2>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            {consultations.length ? `${consultations.length}건` : "없음"}
          </div>
        </div>

        <ConsultationHistory consultations={consultations} />
      </section>
    </div>
  );
}
