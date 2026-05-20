"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { StationManager } from "@/components/station-manager";
import { InstitutionSwitcher } from "@/components/layout/institution-switcher";
import { signOut } from "@/app/actions/auth";
import type { InstitutionWithRole } from "@/lib/auth/institution";

interface HamburgerDrawerProps {
  institutions: InstitutionWithRole[];
  activeInstitutionId: string;
  userEmail: string;
  userName?: string;
}

export function HamburgerDrawer({
  institutions,
  activeInstitutionId,
  userEmail,
  userName,
}: HamburgerDrawerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const displayName = userName ?? userEmail.split("@")[0];

  // 드로어와 오버레이는 헤더의 backdrop-filter 컨테이닝 블록 영향을 받지 않도록
  // document.body에 포털로 렌더링
  const portal = mounted ? createPortal(
    <>
      {/* 오버레이 */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* 드로어 */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="내비게이션 메뉴"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 드로어 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600 text-xs font-bold text-white">
              C
            </div>
            <span className="text-sm font-semibold text-slate-900">Carelog</span>
          </div>
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* 사용자 정보 */}
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="truncate text-xs text-slate-500">{userEmail}</p>
            </div>
          </div>
        </div>

        {/* 체어 선택 */}
        <div className="border-b border-slate-100 px-5 py-3">
          <StationManager />
        </div>

        {/* 기관 전환 */}
        {institutions.length > 1 && (
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              기관 전환
            </p>
            <InstitutionSwitcher
              institutions={institutions}
              activeInstitutionId={activeInstitutionId}
            />
          </div>
        )}

        {/* 내비게이션 링크 */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <NavItem href="/" icon={<HomeIcon />} onClick={() => setOpen(false)}>
            홈
          </NavItem>
          <NavItem href="/patients" icon={<PatientsIcon />} onClick={() => setOpen(false)}>
            환자 목록
          </NavItem>
          <NavItem href="/portal/records" icon={<RecordsIcon />} onClick={() => setOpen(false)}>
            내 진료 기록
          </NavItem>

          <div className="my-2 border-t border-slate-100" />

          <NavItem href="/settings" icon={<SettingsIcon />} onClick={() => setOpen(false)}>
            설정
          </NavItem>
          <NavItem href="/about" icon={<InfoIcon />} onClick={() => setOpen(false)}>
            서비스 소개
          </NavItem>
        </nav>

        {/* 로그아웃 */}
        <div className="border-t border-slate-100 px-3 py-4">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
                <path
                  fillRule="evenodd"
                  d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
                  clipRule="evenodd"
                />
                <path
                  fillRule="evenodd"
                  d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-1.047a.75.75 0 1 0-1.06-1.06l-2.25 2.25a.75.75 0 0 0 0 1.06l2.25 2.25a.75.75 0 1 0 1.06-1.06L8.704 10.75H18.25A.75.75 0 0 0 19 10Z"
                  clipRule="evenodd"
                />
              </svg>
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <>
      {/* 헤더 안에는 버튼만 */}
      <button
        type="button"
        aria-label="메뉴 열기"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
          <path
            fillRule="evenodd"
            d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 5A.75.75 0 0 1 2.75 9h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 9.75Zm0 5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* 드로어·오버레이는 document.body 포털로 렌더링 (헤더 backdrop-filter 격리 우회) */}
      {portal}
    </>
  );
}

function NavItem({
  href,
  icon,
  onClick,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
    >
      <span className="size-4 shrink-0 text-slate-400">{icon}</span>
      {children}
    </Link>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
      <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
    </svg>
  );
}

function PatientsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
      <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 17a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
    </svg>
  );
}

function RecordsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
      <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z" clipRule="evenodd" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
      <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .205 1.251l-1.18 2.044a1 1 0 0 1-1.186.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.113a7.047 7.047 0 0 1 0-2.228L1.821 7.773a1 1 0 0 1-.205-1.251l1.18-2.044a1 1 0 0 1 1.186-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
    </svg>
  );
}
