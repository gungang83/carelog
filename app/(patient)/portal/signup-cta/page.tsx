import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPatientSession } from "@/lib/patient-session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { PatientSignupCta } from "@/components/patient/patient-signup-cta";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{ invitation?: string }>;
};

export default async function PatientSignupCtaPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await getPatientSession(cookieStore);

  if (!session) {
    redirect("/portal/login");
  }

  const { invitation } = await searchParams;

  // 초대 토큰으로 최근 상담 내역 조회
  let consultationPreview: { content: string; institutionName: string } | null = null;

  if (invitation) {
    const admin = createAdminSupabaseClient();
    const { data: inv } = await admin
      .from("patient_invitations")
      .select("patient_id, institution_id, institutions(name)")
      .eq("token", invitation)
      .maybeSingle();

    if (inv) {
      const institutionName =
        (inv.institutions as unknown as { name: string } | null)?.name ?? "케어로그";

      const { data: latest } = await admin
        .from("consultation")
        .select("content, created_at")
        .eq("patient_id", inv.patient_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest) {
        const plainText = (latest.content as string).replace(/<[^>]*>/g, "");
        consultationPreview = {
          content: plainText.slice(0, 200),
          institutionName,
        };
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-sky-600 mb-1">
          케어로그
        </p>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">
          상담 내역 확인 완료
        </h1>

        {consultationPreview && (
          <div className="mb-6 rounded-lg bg-slate-50 border border-slate-100 p-4">
            <p className="text-xs font-medium text-slate-500 mb-1">
              {consultationPreview.institutionName} · 오늘의 상담
            </p>
            <p className="text-sm text-slate-700 leading-relaxed line-clamp-4">
              {consultationPreview.content}
            </p>
          </div>
        )}

        <div className="mb-6">
          <p className="text-sm font-semibold text-slate-900 mb-1">
            케어로그에 가입하시면
          </p>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• 모든 과거 진료 기록을 언제든 확인</li>
            <li>• 새 진료 기록 알림 수신</li>
            <li>• 여러 치과 기록 한 번에 관리</li>
          </ul>
        </div>

        <PatientSignupCta patientAccountId={session.patientAccountId} />

        <div className="mt-4 text-center">
          <Link
            href="/portal/records"
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            나중에 가입하기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
