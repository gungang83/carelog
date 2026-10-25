import Link from "next/link";
import { redirect } from "next/navigation";
import { openPatientShare } from "@/app/actions/patient-shares";
import { getPatientAuthStatus } from "@/app/actions/patient-portal";
import { PortalNudge } from "@/components/patient/portal-nudge";
import { renderContentHtml } from "@/lib/content-html";

type PageProps = { params: Promise<{ id: string }> };

// spec 038 — 상담 안내 한 건(문자 링크 → 인증 후 도착하는 화면) + 포털 넛징
export default async function PatientSharePage({ params }: PageProps) {
  const { id } = await params;
  const r = await openPatientShare(id);
  if (!r.ok) {
    if ("login" in r && r.login) redirect("/portal/login");
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center">
        <p className="text-sm text-slate-600">{r.message}</p>
        <Link href="/portal/records" className="mt-4 inline-block text-sm text-sky-600 hover:underline">
          내 상담 안내·기록 보기
        </Link>
      </div>
    );
  }
  const { share } = r;
  const auth = await getPatientAuthStatus();
  const date = new Date(share.sentAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">{share.institutionName}</span>
          <span className="text-xs text-slate-400">{date}</span>
        </div>
        <h1 className="mb-4 text-lg font-bold text-slate-900">{share.patientName}님 상담 안내</h1>
        <div
          className="text-sm leading-7 text-slate-800 [&_img]:mt-3 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: renderContentHtml(share.content) }}
        />
        {share.prescriptions.length > 0 && (
          <div className="mt-4 rounded-xl bg-sky-50 p-4">
            <p className="mb-1 text-xs font-semibold text-sky-700">추천 관리 제품</p>
            <ul className="list-disc pl-5 text-sm text-slate-700">
              {share.prescriptions.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </article>
      <PortalNudge isGoogleLinked={auth.ok ? auth.isGoogleLinked : false} />
    </div>
  );
}
