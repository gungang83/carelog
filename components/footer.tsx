import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-100 bg-white/60 px-4 py-5">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 sm:flex-row">
        <Link
          href="/about"
          className="text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
        >
          서비스 소개
        </Link>
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} SUWANT holdings Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
