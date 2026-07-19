import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyInstitution, getMyInstitutionPlan } from "@/lib/auth/institution";
import { PlanSection } from "@/components/settings/plan-section";
import { getStaffList } from "@/app/actions/admin";
import { getMyPatientLinkStatus } from "@/app/actions/patient-portal";
import { getChairs } from "@/app/actions/chairs";
import { getClinicMembers } from "@/app/actions/clinic-members";
import { StaffList } from "@/components/settings/staff-list";
import { StaffInviteForm } from "@/components/settings/staff-invite-form";
import { InstitutionNameForm } from "@/components/settings/institution-name-form";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { PatientAccountLink } from "@/components/settings/patient-account-link";
import { ChairSettings } from "@/components/settings/chair-settings";
import { ClinicMemberSettings } from "@/components/settings/clinic-member-settings";
import { ConsultAssetsManager } from "@/components/settings/consult-assets-manager";
import { listConsultAssetsForManage } from "@/app/actions/consult-assets";
import { TreatmentItemsManager } from "@/components/settings/treatment-items-manager";
import { listTreatmentItemsForManage } from "@/app/actions/treatment-items";

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

  const [staffResult, patientLinkStatus, chairs, clinicMembers, plan, consultAssets] =
    await Promise.all([
      isOwnerOrAdmin ? getStaffList() : Promise.resolve(null),
      getMyPatientLinkStatus(),
      isOwnerOrAdmin ? getChairs() : Promise.resolve([]),
      isOwnerOrAdmin ? getClinicMembers() : Promise.resolve([]),
      getMyInstitutionPlan(),
      isOwnerOrAdmin ? listConsultAssetsForManage() : Promise.resolve([]),
    ]);
  const treatmentItems = isOwnerOrAdmin ? await listTreatmentItemsForManage() : [];
  const members = staffResult?.ok ? staffResult.members : [];

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">설정</h1>
        <p className="mt-1 text-sm text-slate-500">{institution.name}</p>
      </div>

      {isOwnerOrAdmin && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-800">일일 리포트</h2>
          <a
            href="/reports/daily/today"
            className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 transition hover:bg-sky-100"
          >
            <div>
              <p className="text-sm font-semibold text-sky-800">📊 우리 워크스페이스 일일 사용 리포트</p>
              <p className="mt-0.5 text-xs text-sky-600">화면 사용·AI 사용량을 직원·기능별로. 매일 아침 알림으로도 받아요.</p>
            </div>
            <span className="shrink-0 text-sky-600">→</span>
          </a>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-800">요금제</h2>
        <PlanSection currentPlan={plan} />
      </section>

      {role === "owner" && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-slate-800">기관 프로필</h2>
          <InstitutionNameForm currentName={institution.name} />
        </section>
      )}

      {isOwnerOrAdmin && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-slate-800">체어 관리</h2>
          <ChairSettings initialChairs={chairs} />
        </section>
      )}

      {isOwnerOrAdmin && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-slate-800">멤버 관리</h2>
          <ClinicMemberSettings initialMembers={clinicMembers} />
        </section>
      )}

      {isOwnerOrAdmin && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">상담 자료</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              자주 쓰는 설명 이미지를 등록해 두면 상담 편집기의 &apos;📚 자료&apos;에서 바로 삽입할 수 있어요.
            </p>
          </div>
          <ConsultAssetsManager initialAssets={consultAssets} />
        </section>
      )}

      {isOwnerOrAdmin && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">치료 항목 · 수가</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              상담 편집기의 &apos;₩ 견적&apos; 빌더에서 쓰는 프리셋입니다. 단가는 참고값이에요.
            </p>
          </div>
          <TreatmentItemsManager initialItems={treatmentItems} />
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
        <h2 className="text-base font-semibold text-slate-800">내 상담 기록</h2>
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
