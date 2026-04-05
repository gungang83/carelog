import Link from "next/link";
import { getPatientById } from "@/app/actions/patients";
import { getConsultationsByPatientId } from "@/app/actions/consultations";
import { ConsultationForm } from "@/components/consultation-form";

type PageProps = { params: Promise<{ patientId: string }> };

export default async function PatientConsultationPage({ params }: PageProps) {
  const { patientId } = await params;

  // eslint-disable-next-line no-console
  console.log("[patient page] 전달받은 ID:", patientId);

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
          {patient.phone ? ` · ${patient.phone}` : " · 연락처 없음"}
        </p>
      </header>

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

        {consultations.length === 0 ? (
          <p className="mt-6 text-sm text-slate-600">
            아직 저장된 상담 기록이 없습니다.
          </p>
        ) : (
          <ol className="mt-6 space-y-4">
            {consultations.map((c) => {
              const created = new Date(c.created_at);
              const createdLabel = Number.isNaN(created.getTime())
                ? c.created_at
                : created.toLocaleString("ko-KR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

              const urls = c.image_urls ?? [];
              const prescriptions = c.prescriptions ?? [];

              const getIconLabel = (name: string) => {
                const map: Record<string, string> = {
                  "미세모 칫솔": "칫솔",
                  "고불소 치약": "치약",
                  "치간 칫솔": "치간",
                  "무알콜 가글": "가글",
                };
                const label = map[name] ?? name;
                return label.length > 3 ? label.slice(0, 3) : label;
              };
              return (
                <li
                  key={c.id}
                  className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-1">
                    <div className="text-xs font-semibold text-slate-500">
                      {createdLabel}
                    </div>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                    {c.content}
                  </p>

                  {urls.length ? (
                    <div className="mt-4">
                      <div className="text-xs font-semibold text-slate-600">
                        이미지 ({urls.length})
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {urls.map((url, idx) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={`${c.id}-${idx}`}
                            src={url}
                            alt={`consultation-${c.id}-img-${idx}`}
                            className="h-28 w-full rounded-xl border border-sky-100 object-cover shadow-sm"
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {prescriptions.length ? (
                    <div className="mt-4">
                      <div className="text-xs font-semibold text-slate-600">
                        처방된 제품
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {prescriptions.map((name) => (
                          <div
                            key={`${c.id}-${name}`}
                            className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-2"
                          >
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-sky-700 shadow-sm">
                              {getIconLabel(name)}
                            </span>
                            <span className="text-xs font-semibold text-slate-800">
                              {name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 text-xs text-slate-500">
                    환자 뷰어 링크:{" "}
                    <span className="font-mono text-slate-600">
                      /view/{c.id}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
