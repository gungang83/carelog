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
import { ConsultSafetySettings } from "@/components/settings/consult-safety-settings";
import { getConsultSettings } from "@/app/actions/consult-settings";
import {
  CollapsibleSection,
  SettingsGroupHeader,
} from "@/components/settings/collapsible-section";

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
  const consultSettings = await getConsultSettings();
  const members = staffResult?.ok ? staffResult.members : [];

  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 py-10 sm:px-6">
      <div className="pb-2">
        <h1 className="text-2xl font-bold text-slate-900">설정</h1>
        <p className="mt-1 text-sm text-slate-500">{institution.name}</p>
      </div>

      {/* 세션 66 — EO spec-054 설정 IA 벤치마킹: 성격 기준 그룹 + 접이식 섹션(제목·부제 스캔) */}

      <SettingsGroupHeader emoji="🙋" title="내 설정" desc="내 알림과 내 상담 기록" />

      <CollapsibleSection emoji="🔔" title="알림" subtitle="웹 푸시 · 알림 수신 설정">
        <NotificationSettings />
      </CollapsibleSection>

      <CollapsibleSection
        emoji="📂"
        title="내 상담 기록"
        subtitle="내 환자 계정과 연결해 상담 기록 직접 받아보기"
      >
        <PatientAccountLink initialLinked={patientLinkStatus.ok && patientLinkStatus.linked} />
      </CollapsibleSection>

      {isOwnerOrAdmin && (
        <>
          <SettingsGroupHeader
            emoji="🩺"
            title="상담 운영"
            desc="체어 · 참여자 · 상담 자료 · 견적 · 안전망"
          />

          <CollapsibleSection emoji="🪑" title="체어 관리" subtitle="체어 추가 · 이름 변경 · 사용 여부">
            <ChairSettings initialChairs={chairs} />
          </CollapsibleSection>

          <CollapsibleSection
            emoji="🧑‍⚕️"
            title="멤버(참여자) 관리"
            subtitle="상담 참여자 선택에 쓰는 우리 기관 명단"
          >
            <ClinicMemberSettings initialMembers={clinicMembers} />
          </CollapsibleSection>

          <CollapsibleSection
            emoji="📚"
            title="상담 자료"
            subtitle="상담 편집기 '📚 자료' 라이브러리 — 설명 이미지 · 동의서 · 영상 링크"
          >
            <ConsultAssetsManager initialAssets={consultAssets} />
          </CollapsibleSection>

          <CollapsibleSection
            emoji="₩"
            title="치료 항목 · 수가"
            subtitle="'₩ 견적' 빌더 프리셋 — 단가는 참고값, 견적마다 수정 가능"
          >
            <TreatmentItemsManager initialItems={treatmentItems} />
          </CollapsibleSection>

          <CollapsibleSection
            emoji="🛟"
            title="상담 안전망"
            subtitle="녹음 방치 감지 경고 · 자동 저장 기준"
          >
            <ConsultSafetySettings initial={consultSettings} />
          </CollapsibleSection>

          <SettingsGroupHeader emoji="👥" title="직원 · 권한" desc="계정 권한 · 활성화 · 초대" />

          <CollapsibleSection
            emoji="👤"
            title="직원 관리"
            subtitle={`계정 ${members.length}명 — 권한 변경 · 활성화 · 초대`}
          >
            <StaffList members={members} currentUserId={user.id} currentRole={role} />
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">직원 초대</h3>
              <StaffInviteForm />
            </div>
          </CollapsibleSection>
        </>
      )}

      <SettingsGroupHeader emoji="🏥" title="기관 · 요금" desc="기관 정보 · 플랜 · 사용 리포트" />

      {role === "owner" && (
        <CollapsibleSection emoji="🏷" title="기관 프로필" subtitle="기관 이름 변경 (대표 전용)">
          <InstitutionNameForm currentName={institution.name} />
        </CollapsibleSection>
      )}

      <CollapsibleSection emoji="💳" title="요금제" subtitle={`현재 플랜 확인`}>
        <PlanSection currentPlan={plan} />
      </CollapsibleSection>

      {isOwnerOrAdmin && (
        <a
          href="/reports/daily/today"
          className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3.5 transition hover:bg-sky-100"
        >
          <div className="flex items-center gap-3">
            <span className="text-base">📊</span>
            <div>
              <p className="text-sm font-semibold text-sky-800">일일 사용 리포트</p>
              <p className="mt-0.5 text-xs text-sky-600">
                화면 사용·AI 사용량을 직원·기능별로 — 매일 아침 알림으로도 받아요
              </p>
            </div>
          </div>
          <span className="shrink-0 text-sky-600">→</span>
        </a>
      )}

      {!isOwnerOrAdmin && (
        <p className="px-1 pt-3 text-xs text-slate-400">
          현재 역할: 직원 — 상담 운영·직원 관리 설정은 기관 대표 또는 관리자에게 보입니다.
        </p>
      )}
    </div>
  );
}
