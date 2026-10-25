import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getInvitation, inviteRedirectIfSignedIn } from "@/app/actions/patient-portal";
import { InviteAuth } from "@/components/patient/invite-auth";

type PageProps = {
  params: Promise<{ token: string }>;
};

// 문자 앱 링크 미리보기 — 병원 이름만(환자 이름 등 개인정보는 미리보기 서버로 보내지 않는다) · 검색 노출 금지
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const r = await getInvitation(token);
  const inst = r.ok ? r.invite.institutionName : "케어로그";
  return {
    title: `${inst} 상담 안내`,
    description: "받으신 상담 내용을 확인해 보세요 — 케어로그",
    robots: { index: false, follow: false },
    openGraph: { title: `${inst} 상담 안내`, description: "받으신 상담 내용을 확인해 보세요", siteName: "케어로그" },
  };
}

// spec 038 — 문자 링크: 이미 로그인돼 있으면 바로 안내(또는 기록)로, 아니면 등록된 번호로 인증번호 한 번.
//   주민번호·전화번호를 입력받지 않는다(ⓐ). 링크는 유효기간(30일) 안에 몇 번이든 열 수 있다(ⓓ).
export default async function InvitationPage({ params }: PageProps) {
  const { token } = await params;

  const next = await inviteRedirectIfSignedIn(token);
  if (next) redirect(next);

  const r = await getInvitation(token);
  if (!r.ok) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-3 text-xl font-semibold text-slate-900">
            {r.reason === "expired" ? "링크 유효기간이 지났습니다" : "확인할 수 없는 링크입니다"}
          </h1>
          <p className="text-sm text-slate-600">
            이전에 인증하셨다면 휴대폰 번호로 로그인해 상담 안내와 기록을 볼 수 있어요.
          </p>
          <Link
            href="/portal/login"
            className="mt-5 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            휴대폰 번호로 로그인
          </Link>
        </div>
      </div>
    );
  }

  const { invite, maskedPhone } = r;
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-sky-600">{invite.institutionName}</p>
        <h1 className="mb-1 text-xl font-semibold text-slate-900">
          {invite.shareId ? "상담 안내가 도착했어요" : "상담 내역 확인"}
        </h1>
        {invite.patientName && <p className="mb-6 text-sm text-slate-500">{invite.patientName}님</p>}
        <InviteAuth token={token} maskedPhone={maskedPhone} />
      </div>
    </div>
  );
}
