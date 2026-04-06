import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { StationManager } from "@/components/station-manager";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Carelog — 진료 상담 기록",
  description: "치과 환자 검색 및 상담·이미지 기록",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gradient-to-b from-sky-50 via-white to-sky-50/80 text-slate-900">
        <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/90 shadow-sm shadow-sky-100/40 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
            <Link
              href="/"
              className="flex min-w-0 shrink-0 items-center gap-3 rounded-xl py-1 pr-2 outline-none ring-sky-400/30 focus-visible:ring-2 sm:mr-auto"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-base font-bold text-sky-700 sm:h-10 sm:w-10">
                C
              </div>
              <div className="min-w-0 text-left">
                <div className="truncate text-sm font-semibold text-slate-900 sm:text-base">
                  Carelog
                </div>
                <div className="hidden truncate text-xs text-slate-500 sm:block">
                  진료 상담 기록
                </div>
              </div>
            </Link>
            <div className="min-w-0 flex-1 sm:ml-auto sm:flex-none sm:max-w-[220px] sm:pl-3">
              <StationManager />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
