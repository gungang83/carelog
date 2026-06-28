// 긴 상담 전사(Whisper+요약)는 batch라 길이에 비례해 시간이 든다. 18분 녹음 ≈
// 전사 30~110s + 요약 → 기본 타임아웃(~10s)이면 함수가 죽어 "This page couldn't load".
// Pro 상한(300s)까지 올려 긴 상담도 완료되게 한다(spec 006 §5 결정의 실효화).
export const maxDuration = 300;

import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/footer";
import { SessionRefresher } from "@/components/layout/session-refresher";
import { BadgeManager } from "@/components/layout/badge-manager";
import { getMyInstitutions, getMyInstitutionId, getMyAuthorInfo, getMyInstitutionLab, getSessionUser } from "@/lib/auth/institution";
import { isSuperAdmin } from "@/lib/admin";
import { getChairs } from "@/app/actions/chairs";
import { getClinicMembers } from "@/app/actions/clinic-members";
import { ChairProvider } from "@/components/chair/chair-provider";
import { ChairOverlay } from "@/components/chair/chair-overlay";
import { ConsultationBoard } from "@/components/chair/consultation-board";
import { LiveAlertsProvider } from "@/components/notifications/live-alerts-provider";
import { RouteTracker } from "@/components/usage/route-tracker";
import type { Participant } from "@/lib/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [institutions, activeInstitutionId, chairs, members, authorInfo, labEnabled] = await Promise.all([
    getMyInstitutions(),
    getMyInstitutionId(),
    getChairs(),
    getClinicMembers(),
    getMyAuthorInfo(),
    getMyInstitutionLab(),
  ]);

  const userEmail = user.email ?? "";
  const superAdmin = isSuperAdmin(user.email);
  const userMeta = user.user_metadata as Record<string, string> | undefined;
  const userName: string | undefined = userMeta?.full_name ?? userMeta?.name;
  const userAvatarUrl: string | undefined = userMeta?.avatar_url;

  // 상담보드 참여자 '나' 기본 포함 대상(작성자 표시명 우선)
  const meName = authorInfo.author_name ?? userName ?? userEmail;
  const me: Participant | null = meName ? { id: user.id, name: meName, role: null } : null;

  if (institutions.length > 0 && !institutions.some((i) => i.is_active)) {
    return (
      <>
        <Header
          institutions={[]}
          activeInstitutionId=""
          userEmail={userEmail}
          userName={userName}
          userAvatarUrl={userAvatarUrl}
        />
        <main className="flex flex-1 items-center justify-center p-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-slate-700 font-medium">이 기관의 접근 권한이 비활성화되었습니다.</p>
            <p className="mt-1 text-sm text-slate-500">기관 관리자에게 문의하세요.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <ChairProvider initialChairs={chairs} members={members} me={me} labEnabled={labEnabled}>
      <SessionRefresher />
      <BadgeManager />
      <ChairOverlay />
      <ConsultationBoard institutionId={activeInstitutionId ?? ""} labEnabled={labEnabled} />
      <LiveAlertsProvider
        institutionId={activeInstitutionId ?? ""}
        chairNames={Object.fromEntries(chairs.map((c) => [c.id, c.name]))}
      />
      <Header
        institutions={institutions}
        activeInstitutionId={activeInstitutionId ?? ""}
        userEmail={userEmail}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        isSuperAdmin={superAdmin}
      />
      <RouteTracker />
      <main className="flex-1">{children}</main>
      <Footer />
    </ChairProvider>
  );
}
