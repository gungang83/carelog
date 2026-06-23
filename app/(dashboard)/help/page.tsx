import Link from "next/link";

export const metadata = { title: "도움말 — Carelog" };

/**
 * 사용 안내서(도움말) — 1차. 첫 토픽은 EO 연동·계정/워크스페이스 안내.
 * 내부 규칙 SSOT: docs/account-workspace-linking.md (이 페이지는 그 사용자용 버전).
 * 토픽은 아래 배열에 추가하면 늘어난다.
 */
export default function HelpPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-sky-600">도움말</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">케어로그 사용 안내</h1>
        <p className="mt-1.5 text-sm text-slate-500 break-keep">
          자주 묻는 내용을 모았어요. 더 궁금한 점이 있으면 병원 관리자 또는 EO를 통해 문의해 주세요.
        </p>
      </header>

      {/* EO에서 들어오기 */}
      <HelpCard
        emoji="🔑"
        title="EO에서 케어로그로 들어오기"
      >
        <p>
          EO에서 <Strong>“케어로그 열기”</Strong>를 누르면 EO 로그인 상태가 그대로 이어집니다.
          별도로 다시 로그인할 필요가 없어요. 케어로그 안에서 화면을 둘러보셔도 로그인은 유지됩니다.
        </p>
        <Tip>
          EO 소속 직원이라면 <Strong>항상 “케어로그 열기”로 진입</Strong>하시길 권합니다. 그래야
          내 병원(워크스페이스)에 바로 연결되고, 아래 “중복 워크스페이스” 문제가 생기지 않아요.
        </Tip>
      </HelpCard>

      {/* 계정·워크스페이스 연동 */}
      <HelpCard
        emoji="🏥"
        title="계정과 워크스페이스 연동"
      >
        <p>
          케어로그 계정은 <Strong>이메일</Strong>로 구분됩니다. EO에서 쓰시는 이메일과
          <Strong> 같은 이메일</Strong>로 케어로그에 연결되면, EO “케어로그 열기”로 들어오는 순간
          내 병원 워크스페이스에 자동으로 합류됩니다.
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>여러 병원에 속해 있으면 화면 상단의 병원 이름을 눌러 <Strong>워크스페이스를 전환</Strong>할 수 있어요.</li>
          <li>워크스페이스마다 환자·상담 기록은 <Strong>서로 분리</Strong>되어 보관됩니다(다른 병원 자료는 보이지 않아요).</li>
        </ul>
      </HelpCard>

      {/* 중복 워크스페이스 */}
      <HelpCard
        emoji="⚠️"
        title="중복 워크스페이스가 생겼다면"
      >
        <p>
          EO를 거치지 않고 <Strong>직접 회원가입</Strong>하면, 별도의 <Strong>새 병원 워크스페이스</Strong>가
          만들어집니다. 이미 EO에 연결된 병원이 있는데 따로 가입까지 하면 <Strong>빈 워크스페이스가 하나 더</Strong>
          생길 수 있어요.
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>이럴 땐 EO “케어로그 열기”로 들어온 워크스페이스를 사용하시고, 직접 만든 빈 워크스페이스는 정리하는 게 좋아요.</li>
          <li>
            정리·합치기(데이터 이동 포함)는 현재 <Strong>관리자 수동 작업</Strong>으로 처리합니다. 병원 관리자
            또는 EO에 요청해 주세요.
          </li>
        </ul>
        <Tip>예방법은 간단해요 — 처음부터 EO “케어로그 열기”로만 들어오시면 됩니다.</Tip>
      </HelpCard>

      <p className="text-center text-xs text-slate-400">
        찾으시는 내용이 없나요?{" "}
        <Link href="/about" className="font-medium text-sky-600 hover:text-sky-700">
          서비스 소개
        </Link>
        도 확인해 보세요.
      </p>
    </div>
  );
}

function HelpCard({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
        <span aria-hidden="true">{emoji}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 break-keep">
        {children}
      </div>
    </section>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-slate-800">{children}</strong>;
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sky-800">
      💡 {children}
    </p>
  );
}
