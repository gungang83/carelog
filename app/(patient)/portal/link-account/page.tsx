import Link from "next/link";

export default function PatientLinkAccountPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-sky-600 mb-1">
          케어로그
        </p>
        <h1 className="text-xl font-semibold text-slate-900 mb-3">
          계정 연결이 필요합니다
        </h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          케어로그에 가입하려면 치과에서 받은 SMS 링크로 먼저 본인 인증을
          완료해야 합니다.
          <br />
          치과에 초대 링크 재발송을 요청해 주세요.
        </p>
        <Link
          href="/portal/login"
          className="inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          로그인 페이지로
        </Link>
      </div>
    </div>
  );
}
