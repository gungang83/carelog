import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { PatientLoginForm } from "@/components/patient/patient-login-form";
import Link from "next/link";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitationPage({ params }: PageProps) {
  const { token } = await params;

  const admin = createAdminSupabaseClient();
  const { data: invitation, error } = await admin
    .from("patient_invitations")
    .select(
      "token, expires_at, accepted_at, institution_id, patient_id, institutions(name), patient(name)",
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !invitation) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-8 shadow-sm text-center">
          <p className="text-slate-600">유효하지 않은 초대 링크입니다.</p>
          <Link href="/portal/login" className="mt-4 inline-block text-sm text-sky-600 hover:underline">
            로그인 페이지로
          </Link>
        </div>
      </div>
    );
  }

  const isExpired = new Date(invitation.expires_at) < new Date();
  const isAccepted = !!invitation.accepted_at;

  if (isExpired || isAccepted) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-8 shadow-sm text-center">
          <h1 className="mb-3 text-xl font-semibold text-slate-900">링크가 만료되었습니다</h1>
          <p className="text-sm text-slate-600">
            {isAccepted
              ? "이미 사용된 초대 링크입니다."
              : "초대 링크가 만료되었습니다. 치과에 재전송을 요청하세요."}
          </p>
          <Link href="/portal/login" className="mt-4 inline-block text-sm text-sky-600 hover:underline">
            로그인 페이지로
          </Link>
        </div>
      </div>
    );
  }

  const institutionName =
    (invitation.institutions as unknown as { name: string } | null)?.name ?? "케어로그";
  const patientName =
    (invitation.patient as unknown as { name: string } | null)?.name ?? "";

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-sky-600">
          {institutionName}
        </p>
        <h1 className="mb-1 text-xl font-semibold text-slate-900">케어로그 가입</h1>
        {patientName && (
          <p className="mb-6 text-sm text-slate-500">{patientName}님의 상담 내역을 확인하세요</p>
        )}
        <p className="mb-6 text-sm text-slate-600">
          주민등록번호와 전화번호를 입력하면 인증번호를 발송해 드립니다.
        </p>
        <PatientLoginForm invitationToken={token} />
      </div>
    </div>
  );
}
