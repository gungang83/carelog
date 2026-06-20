export const maxDuration = 120;

import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/footer";
import { SessionRefresher } from "@/components/layout/session-refresher";
import { BadgeManager } from "@/components/layout/badge-manager";
import { getMyInstitutions, getMyInstitutionId, getMyAuthorInfo, getSessionUser } from "@/lib/auth/institution";
import { getChairs } from "@/app/actions/chairs";
import { getClinicMembers } from "@/app/actions/clinic-members";
import { ChairProvider } from "@/components/chair/chair-provider";
import { ChairOverlay } from "@/components/chair/chair-overlay";
import { ConsultationBoard } from "@/components/chair/consultation-board";
import { LiveAlertsProvider } from "@/components/notifications/live-alerts-provider";
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

  const [institutions, activeInstitutionId, chairs, members, authorInfo] = await Promise.all([
    getMyInstitutions(),
    getMyInstitutionId(),
    getChairs(),
    getClinicMembers(),
    getMyAuthorInfo(),
  ]);

  const userEmail = user.email ?? "";
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
    <ChairProvider initialChairs={chairs} members={members} me={me}>
      <SessionRefresher />
      <BadgeManager />
      <ChairOverlay />
      <ConsultationBoard />
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
      />
      <main className="flex-1">{children}</main>
      <Footer />
    </ChairProvider>
  );
}
