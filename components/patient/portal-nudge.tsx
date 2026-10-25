// spec 038 — 포털 넛징: 안내를 보고 난 환자에게 "케어로그에서 이런 것도 할 수 있어요".
//   환자가 할 수 있는 일이 늘어날 때마다 여기에 한 줄씩 더한다.
import Link from "next/link";

export function PortalNudge({ isGoogleLinked }: { isGoogleLinked: boolean }) {
  const items: { icon: string; title: string; desc: string; href?: string; soon?: boolean }[] = [
    { icon: "🗂", title: "지난 상담 안내·기록 모아보기", desc: "받은 안내와 상담 기록을 한곳에서 언제든", href: "/portal/records" },
    ...(isGoogleLinked
      ? []
      : [{ icon: "🔑", title: "다음부턴 간편하게 로그인", desc: "구글 계정을 연결하면 인증번호 없이 바로", href: "/portal/signup-cta" }]),
    { icon: "🔔", title: "새 안내가 오면 알림 받기", desc: "기록 화면 위쪽에서 알림을 켜 주세요", href: "/portal/records" },
    { icon: "🪥", title: "처방 제품 다시 구매", desc: "추천받은 관리 제품을 바로 주문", soon: true },
    { icon: "📅", title: "다음 방문 알림", desc: "정기 검진·관리 시기를 알려 드려요", soon: true },
  ];
  return (
    <section className="mt-6 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5">
      <p className="text-sm font-bold text-slate-900">케어로그에서 이런 것도 할 수 있어요</p>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((it) => {
          const body = (
            <span className="flex items-start gap-3">
              <span className="text-xl leading-none">{it.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-800">
                  {it.title}
                  {it.soon && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">준비 중</span>}
                </span>
                <span className="block text-xs text-slate-500">{it.desc}</span>
              </span>
              {it.href && <span className="text-slate-300">›</span>}
            </span>
          );
          return (
            <li key={it.title}>
              {it.href ? (
                <Link href={it.href} className="block rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-sky-100 hover:ring-sky-300">
                  {body}
                </Link>
              ) : (
                <div className="rounded-xl bg-white/60 px-3 py-2.5 ring-1 ring-slate-100">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
