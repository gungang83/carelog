import Link from "next/link";
import { StationManager } from "@/components/station-manager";
import { signOut } from "@/app/actions/auth";
import { InstitutionSwitcher } from "@/components/layout/institution-switcher";
import { RefreshButton } from "@/components/layout/refresh-button";
import type { InstitutionWithRole } from "@/lib/auth/institution";

interface HeaderProps {
  institutions: InstitutionWithRole[];
  activeInstitutionId: string;
}

export function Header({ institutions, activeInstitutionId }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/90 shadow-sm shadow-sky-100/40 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3 rounded-xl py-1 pr-2 outline-none ring-sky-400/30 focus-visible:ring-2 sm:mr-auto"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-base font-bold text-sky-700 sm:h-10 sm:w-10">
            C
          </div>
          <InstitutionSwitcher
            institutions={institutions}
            activeInstitutionId={activeInstitutionId}
          />
        </Link>

        <div className="min-w-0 flex-1 sm:ml-auto sm:flex-none sm:max-w-[220px] sm:pl-3">
          <StationManager />
        </div>

        <RefreshButton />

        <Link
          href="/portal/records"
          className="hidden sm:inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          내 진료 기록
        </Link>

        <Link
          href="/settings"
          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          설정
        </Link>

        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-sky-200 bg-white px-3 text-xs font-semibold text-sky-800 shadow-sm transition hover:bg-sky-50"
          >
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}
