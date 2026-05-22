import Link from "next/link";
import { PatientHamburgerDrawer } from "@/components/patient/patient-hamburger-drawer";

interface PatientHeaderProps {
  isLoggedIn: boolean;
}

export function PatientHeader({ isLoggedIn }: PatientHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/90 shadow-sm shadow-sky-100/40 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
        <PatientHamburgerDrawer isLoggedIn={isLoggedIn} />

        <Link
          href={isLoggedIn ? "/portal/records" : "/portal/login"}
          className="flex shrink-0 items-center gap-2.5 rounded-xl py-1 pr-2 outline-none ring-sky-400/30 focus-visible:ring-2"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-sm font-bold text-white">
            C
          </div>
          <div className="min-w-0 text-left">
            <div className="truncate text-sm font-semibold text-slate-900">Carelog</div>
            <div className="truncate text-xs text-slate-500">내 진료 기록</div>
          </div>
        </Link>

        {isLoggedIn && (
          <div className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
            환
          </div>
        )}
      </div>
    </header>
  );
}
