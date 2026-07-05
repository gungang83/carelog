// 상담 전사 서버액션은 홈(이 라우트)에서 호출된다 → 함수 타임아웃을 라우트에도
// 명시(layout과 동일)해 긴 상담 전사가 기본 타임아웃에 끊기지 않게 한다.
export const maxDuration = 300;

import { PatientHome } from "@/components/patient-home";
import { PushNotificationBanner } from "@/components/push-notification-banner";
import { ConsultHero } from "@/components/chair/consult-hero";
import { HomeFeed } from "@/components/home/home-feed";
import { PatientShield } from "@/components/home/patient-shield";
import { WorkspaceHelpBanner } from "@/components/help/workspace-help-banner";
import { LiveSessionsBanner } from "@/components/notifications/live-sessions-banner";
import { AnnouncementTicker } from "@/components/announcements/announcement-ticker";
import { searchConsultations } from "@/app/actions/consultations";
import { getAllUnlinkedRecords } from "@/app/actions/chairs";
import { getActiveAnnouncements } from "@/app/actions/announcements";
import { getMyInstitutions, getMyInstitutionId } from "@/lib/auth/institution";

export default async function Home() {
  const [linkedResult, initialUnlinked, institutions, institutionId, announcements] =
    await Promise.all([
      searchConsultations({ status: "linked", limit: 50 }),
      getAllUnlinkedRecords(),
      getMyInstitutions(),
      getMyInstitutionId(),
      getActiveAnnouncements(),
    ]);
  const linked = linkedResult.ok ? linkedResult.rows : [];

  return (
    <>
      {/* 헤더 바로 아래 — 중앙 발행 공지·업데이트 티커(spec 022, 은은하게 한 줄) */}
      <AnnouncementTicker items={announcements} />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
        {/* 최상단 히어로 — 상담 기록 진입점 */}
        <ConsultHero />

      {/* 아래로 펼쳐지는 대시보드 요소들 */}
      <PushNotificationBanner />

      {/* 다른 기기에서 상담 작성 중이면 실시간 표시 (C-05 1단계, PII 없는 메타) */}
      <LiveSessionsBanner institutionId={institutionId ?? ""} />

      {/* 여러 워크스페이스 소속 시 안내(닫기 가능) */}
      <WorkspaceHelpBanner institutionCount={institutions.length} />

      {/* 환자 대면 보호막 — 환자가 화면을 함께 볼 때 민감한 목록을 기본 가림(C-02) */}
      <PatientShield>
        {/* 미연결 + 연결완료 상담 카드 통합 피드 (토글로 함께/하나씩) */}
        <HomeFeed initialRecords={initialUnlinked} linked={linked} />

        <PatientHome />
      </PatientShield>
      </div>
    </>
  );
}
