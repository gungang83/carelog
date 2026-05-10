import { PatientOtpForm } from "@/components/patient/patient-otp-form";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{
    phone?: string;
    rrn_hash?: string;
    token?: string;
  }>;
};

export default async function PatientVerifyPage({ searchParams }: PageProps) {
  const { phone, rrn_hash, token } = await searchParams;

  if (!phone || !rrn_hash) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm text-center">
          <p className="text-slate-600 mb-4">잘못된 접근입니다.</p>
          <Link href="/portal/login" className="text-sm text-sky-600 hover:underline">
            로그인 페이지로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-sky-600 mb-1">
          케어로그
        </p>
        <h1 className="text-xl font-semibold text-slate-900 mb-6">
          인증번호 입력
        </h1>

        <PatientOtpForm
          phone={phone}
          rrnHash={rrn_hash}
          invitationToken={token}
        />
      </div>
    </div>
  );
}
