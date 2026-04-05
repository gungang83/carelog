import Link from "next/link";
import { getConsultationById } from "@/app/actions/consultations";

type PageProps = { params: { consultationId: string } };

export default async function ConsultationViewPage({
  params,
}: PageProps) {
  const { consultationId } = params;
  const res = await getConsultationById(consultationId);

  if (!res.ok) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16">
        <div className="rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-red-600">{res.message}</p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-semibold text-sky-700 underline"
          >
            메인으로
          </Link>
        </div>
      </div>
    );
  }

  const c = res.consultation;
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      {/* 임시 로고 */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-lg font-bold text-sky-700">
            C
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Carelog
            </div>
            <div className="text-xs text-slate-500">상담 리포트</div>
          </div>
        </div>
        <Link
          href="/"
          className="rounded-xl border border-sky-100 bg-white px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm hover:bg-sky-50"
        >
          앱으로 돌아가기
        </Link>
      </header>

      <article className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              상담 내용
            </h1>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              작성일: {createdLabel}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            ID:{" "}
            <span className="font-mono text-slate-600">{c.id}</span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/30 p-4">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
            {c.content}
          </p>
        </div>

        {urls.length ? (
          <div className="mt-6">
            <div className="text-xs font-semibold text-slate-600">
              첨부 이미지 ({urls.length})
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {urls.map((url, idx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${c.id}-${idx}`}
                  src={url}
                  alt={`consultation-view-${idx}`}
                  className="h-24 w-full rounded-xl border border-sky-100 object-cover shadow-sm"
                />
              ))}
            </div>
          </div>
        ) : null}

        {prescriptions.length ? (
          <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                  오늘의 추천 관리 용품
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  처방된 제품
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-500">
                {prescriptions.length}개
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {prescriptions.map((name) => (
                <div
                  key={`${c.id}-${name}`}
                  className="inline-flex items-center gap-3 rounded-xl border border-sky-100 bg-white px-4 py-3 shadow-sm"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                    {getIconLabel(name)}
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-7 rounded-2xl bg-white p-4 text-xs text-slate-500">
          본 화면은 병원에서 전송한 상담 리포트입니다. 필요 시 병원에 문의해 주세요.
        </div>
      </article>
    </div>
  );
}

