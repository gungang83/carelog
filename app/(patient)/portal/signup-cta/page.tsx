import { redirect } from "next/navigation";
import { getPatientSession } from "@/lib/patient-session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { PatientSignupCta } from "@/components/patient/patient-signup-cta";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{ invitation?: string }>;
};

export default async function PatientSignupCtaPage({ searchParams }: PageProps) {
  const session = await getPatientSession();

  if (!session) {
    redirect("/portal/login");
  }

  const { invitation } = await searchParams;

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
        consultationPreview = {
          content: (latest.content as string).replace(/<[^>]*>/g, "").slice(0, 200),
          institutionName,
        };
      }
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-sky-600">
          케어로그
        </p>
        <h1 className="mb-2 text-xl font-semibold text-slate-900">상담 내역 확인 완료</h1>

        {consultationPreview && (
          <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="mb-1 text-xs font-medium text-slate-500">
              {consultationPreview.institutionName} · 오늘의 상담
            </p>
            <p className="line-clamp-4 text-sm leading-relaxed text-slate-700">
              {consultationPreview.content}
            </p>
          </div>
        )}

        <div className="mb-6">
          <p className="mb-2 text-sm font-semibold text-slate-900">케어로그에 가입하시면</p>
          <ul className="space-y-1 text-sm text-slate-600">
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
