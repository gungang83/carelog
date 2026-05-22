import Link from "next/link";

export default function PatientLinkAccountPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-8 shadow-sm text-center">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-sky-600">
          케어로그
        </p>
        <h1 className="mb-3 text-xl font-semibold text-slate-900">계정 연결이 필요합니다</h1>
        <p className="mb-6 text-sm leading-relaxed text-slate-600">
          케어로그에 가입하려면 치과에서 받은 SMS 링크로 먼저 본인 인증을 완료해야 합니다.
          <br />
          치과에 초대 링크 재발송을 요청해 주세요.
        </p>
        <Link
          href="/portal/login"
          className="inline-block rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
        >
          로그인 페이지로
        </Link>
      </div>
    </div>
  );
}
