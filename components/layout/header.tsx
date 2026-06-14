import Link from "next/link";
import { HamburgerDrawer } from "@/components/layout/hamburger-drawer";
import { ProfileDropdown } from "@/components/layout/profile-dropdown";
import { RefreshButton } from "@/components/layout/refresh-button";
import { SoundArmButton } from "@/components/notifications/sound-arm-button";
import type { InstitutionWithRole } from "@/lib/auth/institution";

interface HeaderProps {
  institutions: InstitutionWithRole[];
  activeInstitutionId: string;
  userEmail: string;
  userName?: string;
  userAvatarUrl?: string;
}

export function Header({
  institutions,
  activeInstitutionId,
  userEmail,
  userName,
  userAvatarUrl,
}: HeaderProps) {
  const activeInst = institutions.find(
    (i) => i.institution.id === activeInstitutionId,
  )?.institution;

  return (
    <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/90 shadow-sm shadow-sky-100/40 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
        {/* 왼쪽: 햄버거 + 로고 */}
        <HamburgerDrawer
          institutions={institutions}
          activeInstitutionId={activeInstitutionId}
          userEmail={userEmail}
          userName={userName}
        />

        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-xl py-1 pr-2 outline-none ring-sky-400/30 focus-visible:ring-2"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-sm font-bold text-white">
            C
          </div>
          <div className="min-w-0 text-left">
            <div className="truncate text-sm font-semibold text-slate-900">
              Carelog
            </div>
            {activeInst && (
              <div className="truncate text-xs text-slate-500">
                {activeInst.name}
              </div>
            )}
          </div>
        </Link>

        {/* 오른쪽: EO 복귀 + 새로고침 + 프로필 */}
        <div className="ml-auto flex items-center gap-2">
          <a
            href={process.env.EO_APP_URL || "https://eo-ten.vercel.app"}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors"
          >
            EO로 돌아가기
          </a>
          <SoundArmButton />
          <RefreshButton />
          <ProfileDropdown
            userEmail={userEmail}
            userName={userName}
            userAvatarUrl={userAvatarUrl}
          />
        </div>
      </div>
    </header>
  );
}
