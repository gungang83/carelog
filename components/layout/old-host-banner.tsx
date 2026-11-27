import { headers } from "next/headers";
import { isOldHost, siteUrl } from "@/lib/site-url";

/**
 * spec 042 — 옛 주소(carelog-tau.vercel.app)로 들어온 직원에게 새 주소 안내.
 * NEXT_PUBLIC_SITE_URL이 새 주소로 정해진 뒤에만 보인다(그 전엔 아무것도 안 그림).
 * 로그인·설치한 앱·알림 허용은 주소별이라 새 주소에서 한 번씩 다시 해야 한다.
 */
export async function OldHostBanner() {
  const h = await headers();
  if (!isOldHost(h.get("x-forwarded-host") ?? h.get("host"))) return null;
  const next = siteUrl();
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 text-xs text-amber-800">
        <span className="font-semibold">케어로그 주소가 {new URL(next).host}(으)로 바뀌었어요.</span>
        <span className="text-amber-700">새 주소에서 한 번 다시 로그인하고, 홈 화면 앱·알림도 새 주소에서 다시 설정해 주세요.</span>
        <a href={`${next}/`} className="ml-auto rounded-lg bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-700">
          새 주소로 열기
        </a>
      </div>
    </div>
  );
}
