import { LoginForm } from "@/components/auth/login-form";
import { EO_APP_URL } from "@/lib/eo/app-url";
import { safeNextPath } from "@/lib/eo/session-relay";

export const metadata = { title: "로그인 — Carelog" };

/** spec 043 — "EO로 로그인"이 안 됐을 때 이유 */
const EO_MESSAGE: Record<string, string> = {
  signin: "EO에 로그인돼 있지 않아요. EO에서 먼저 로그인한 뒤 다시 눌러 주세요.",
  not_linked: "이 EO 워크스페이스는 아직 케어로그와 연결돼 있지 않아요. EO 관리자에게 케어로그 연결을 요청해 주세요.",
  no_workspace: "EO에서 소속 워크스페이스를 찾지 못했어요. EO에서 워크스페이스를 고른 뒤 다시 시도해 주세요.",
  fail: "EO와 연결하지 못했어요. 잠시 뒤 다시 시도하거나 아래 방법으로 로그인해 주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ eo?: string; redirect?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(sp.redirect);
  const eoError = sp.eo ? EO_MESSAGE[sp.eo] ?? EO_MESSAGE.fail : null;
  const eoHref = `/api/auth/eo-login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-16 sm:px-0">
      <header className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-xl font-bold text-sky-700">
          C
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Carelog
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          클리닉 계정으로 로그인하세요
        </p>
      </header>

      <div className="flex flex-col gap-5 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm shadow-sky-100/80">
        {/* spec 043 — EO 계정으로(EO에 로그인돼 있으면 바로 들어감) */}
        <div className="flex flex-col gap-2">
          <a
            href={eoHref}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-6 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100"
          >
            <span className="flex size-5 items-center justify-center rounded-md bg-indigo-600 text-[10px] font-bold text-white">EO</span>
            EO 계정으로 로그인
          </a>
          {eoError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {eoError}
              {(sp.eo === "signin" || sp.eo === "no_workspace") && (
                <a href={`${EO_APP_URL}/login`} className="ml-1 font-semibold text-amber-900 underline underline-offset-2">
                  EO 열기
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">또는 케어로그 계정</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
