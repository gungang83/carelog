import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyInstitution } from "@/lib/auth/institution";
import { getStaffList } from "@/app/actions/admin";
import { getMyPatientLinkStatus } from "@/app/actions/patient-portal";
import { StaffList } from "@/components/settings/staff-list";
import { StaffInviteForm } from "@/components/settings/staff-invite-form";
import { InstitutionNameForm } from "@/components/settings/institution-name-form";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { PatientAccountLink } from "@/components/settings/patient-account-link";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const institutionData = await getMyInstitution();
  if (!institutionData) redirect("/onboarding");

  const { institution, role } = institutionData;

  const isOwnerOrAdmin = role === "owner" || role === "admin";

  const [staffResult, patientLinkStatus] = await Promise.all([
    isOwnerOrAdmin ? getStaffList() : Promise.resolve(null),
    getMyPatientLinkStatus(),
  ]);
  const members = staffResult?.ok ? staffResult.members : [];

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">설정</h1>
        <p className="mt-1 text-sm text-slate-500">{institution.name}</p>
      </div>

      {role === "owner" && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-slate-800">기관 프로필</h2>
          <InstitutionNameForm currentName={institution.name} />
        </section>
      )}

      {isOwnerOrAdmin && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">직원 관리</h2>
            <span className="text-xs text-slate-400">{members.length}명</span>
          </div>
          <StaffList
            members={members}
            currentUserId={user.id}
            currentRole={role}
          />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">직원 초대</h3>
            <StaffInviteForm />
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-800">내 진료 기록</h2>
        <PatientAccountLink
          initialLinked={patientLinkStatus.ok && patientLinkStatus.linked}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-800">알림 관리</h2>
        <NotificationSettings />
      </section>

      {!isOwnerOrAdmin && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            현재 역할: <span className="font-semibold text-slate-800">직원</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            직원 관리는 기관 대표 또는 관리자만 가능합니다.
          </p>
        </section>
      )}
    </div>
  );
}
