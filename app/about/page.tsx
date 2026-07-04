import Link from "next/link";
import { getSessionUser } from "@/lib/auth/institution";
import { FounderLetter } from "@/components/about/founder-letter";

export const metadata = {
  title: "Carelog — 치과 상담 기록 플랫폼",
  description:
    "치과 상담 내역을 안전하게 기록하고 환자에게 직접 전달하는 클리닉 관리 플랫폼입니다.",
};

export default async function AboutPage() {
  const loggedIn = !!(await getSessionUser());
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sm font-bold text-sky-700">
              C
            </div>
            <span className="text-base font-semibold text-slate-900">Carelog</span>
          </div>
          <div className="flex items-center gap-3">
            {loggedIn ? (
              <Link
                href="/"
                className="inline-flex h-9 items-center rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                대시보드로 →
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-9 items-center rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                >
                  시작하기
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <span className="inline-block rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-700">
          치과 상담 기록 플랫폼
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          상담 기록을 환자에게
          <br />
          <span className="text-sky-600">직접 전달</span>하세요
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-slate-500">
          Carelog는 치과 직원이 작성한 상담 기록을 환자에게 SMS로 즉시 전달하고,
          환자는 언제든지 자신의 진료 이력을 확인할 수 있는 클리닉 관리
          플랫폼입니다.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {loggedIn ? (
            <Link
              href="/"
              className="inline-flex h-12 items-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
            >
              대시보드로 가기 →
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="inline-flex h-12 items-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                무료로 시작하기 →
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                로그인
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Feature Grid — Staff */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-sky-600">
            치과 직원용
          </p>
          <h2 className="mt-3 text-center text-3xl font-bold text-slate-900">
            진료실을 더 효율적으로
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-center text-slate-500">
            번거로운 수기 기록 없이, 체어에서 바로 작성하고 환자에게 전송합니다.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            <FeatureCard
              icon="📋"
              title="상담 기록"
              desc="환자별 상담 내용, 처방 메모, 사진을 체어 번호와 함께 기록합니다. 이전 방문 이력도 한눈에 확인."
            />
            <FeatureCard
              icon="📲"
              title="SMS 즉시 전송"
              desc="기록 저장과 동시에 환자 휴대폰으로 상담 내역 링크를 전송합니다. 수기 안내 없이 자동 전달."
            />
            <FeatureCard
              icon="🏥"
              title="다기관 지원"
              desc="여러 치과를 하나의 계정으로 관리합니다. 기관 전환 한 번으로 다른 클리닉으로 이동."
            />
          </div>
        </div>
      </section>

      {/* Feature Grid — Patient */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-sky-600">
            환자용
          </p>
          <h2 className="mt-3 text-center text-3xl font-bold text-slate-900">
            내 상담 기록, 언제든지 확인
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-center text-slate-500">
            치과에 다시 가지 않아도 스마트폰으로 상담 내역을 볼 수 있습니다.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            <FeatureCard
              icon="📄"
              title="진료 이력 조회"
              desc="여러 치과에서 받은 상담 기록을 하나의 화면에서 통합 확인합니다. 날짜순으로 정렬."
            />
            <FeatureCard
              icon="🔔"
              title="새 기록 알림"
              desc="치과에서 새 상담 기록을 저장하면 즉시 푸시 알림으로 알려드립니다. 앱 설치 불필요."
            />
            <FeatureCard
              icon="🔐"
              title="안전한 본인 확인"
              desc="주민번호 + 전화번호 인증으로 정확한 본인 확인. Google 계정 연동으로 재방문 시 간편 로그인."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-sky-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-sky-600">
            사용 방법
          </p>
          <h2 className="mt-3 text-center text-3xl font-bold text-slate-900">
            4단계로 시작합니다
          </h2>

          <div className="mt-12 grid gap-8 sm:grid-cols-4">
            <Step
              num="1"
              title="직원 가입"
              desc="기관 이메일로 Carelog에 가입하고 소속 치과를 등록합니다."
            />
            <Step
              num="2"
              title="상담 기록 작성"
              desc="환자를 검색해 체어에서 바로 상담 내용, 처방, 사진을 입력합니다."
            />
            <Step
              num="3"
              title="환자에게 전송"
              desc="'전송' 버튼 하나로 환자 휴대폰에 상담 내역 링크 SMS가 발송됩니다."
            />
            <Step
              num="4"
              title="환자가 확인"
              desc="환자는 링크를 클릭해 본인 확인 후 상담 기록을 조회하고 Google 계정으로 연동합니다."
            />
          </div>
        </div>
      </section>

      {/* Admin & Permissions */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-10 sm:p-14">
            <div className="sm:flex sm:items-center sm:gap-12">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">
                  팀 관리
                </p>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">
                  직원 권한을 세밀하게 관리하세요
                </h2>
                <p className="mt-4 text-slate-500">
                  원장(Owner), 관리자(Admin), 직원(Staff) 세 가지 역할로 접근 권한을
                  나눕니다. 이메일 초대 링크로 직원을 추가하고, 필요 시 언제든지 권한을
                  조정할 수 있습니다.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                    <strong>Owner</strong> — 기관 설정, 직원 관리, 전체 기록 접근
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                    <strong>Admin</strong> — 직원 초대, 권한 변경, 기록 작성
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                    <strong>Staff</strong> — 환자 조회, 상담 기록 작성 및 전송
                  </li>
                </ul>
              </div>
              <div className="mt-10 shrink-0 sm:mt-0">
                <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:w-64">
                  <p className="text-xs font-semibold text-slate-500">팀 구성원</p>
                  <div className="mt-4 space-y-3">
                    {[
                      { name: "김원장", role: "Owner", color: "bg-sky-100 text-sky-700" },
                      { name: "이실장", role: "Admin", color: "bg-indigo-100 text-indigo-700" },
                      { name: "박치위사", role: "Staff", color: "bg-slate-100 text-slate-600" },
                      { name: "최간호사", role: "Staff", color: "bg-slate-100 text-slate-600" },
                    ].map((m) => (
                      <div key={m.name} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">{m.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.color}`}>
                          {m.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PWA */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">
            PWA 지원
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">
            앱 설치 없이 홈 화면에 추가
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-500">
            환자용 Carelog는 Progressive Web App(PWA)으로 제공됩니다. 별도 앱 설치 없이
            스마트폰 홈 화면에 추가해 네이티브 앱처럼 사용할 수 있습니다.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {["Android (Chrome)", "iOS (Safari)", "데스크톱 (Chrome/Edge)"].map(
              (platform) => (
                <span
                  key={platform}
                  className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700"
                >
                  {platform}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      {/* 창업자 편지 (카드 #745) */}
      <FounderLetter />

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900">
            지금 바로 시작해보세요
          </h2>
          <p className="mt-4 text-slate-500">
            가입은 무료입니다. 이메일 하나로 치과를 등록하고 오늘부터 상담 기록을
            디지털로 관리하세요.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {loggedIn ? (
              <Link
                href="/"
                className="inline-flex h-12 items-center rounded-xl bg-sky-600 px-8 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                대시보드로 가기 →
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="inline-flex h-12 items-center rounded-xl bg-sky-600 px-8 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                >
                  무료로 시작하기 →
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center rounded-xl border border-slate-200 bg-white px-8 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  로그인
                </Link>
              </>
            )}
          </div>
          <p className="mt-6 text-xs text-slate-400">
            환자이신가요? 치과에서 발송한 SMS 링크를 통해 상담 기록을 확인하세요.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-xs font-bold text-sky-700">
              C
            </div>
            <span className="text-sm font-semibold text-slate-700">Carelog</span>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} SUWANT holdings Inc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-2xl">{icon}</div>
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{desc}</p>
    </div>
  );
}

function Step({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-600 text-base font-bold text-white">
        {num}
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{desc}</p>
    </div>
  );
}
