import { acceptInvitation } from "@/app/actions/institutions";

type PageProps = { params: Promise<{ token: string }> };

export const metadata = { title: "초대 수락 — Carelog" };

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-16 sm:px-0">
      <header className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-xl font-bold text-sky-700">
          C
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          초대 수락
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          클리닉 팀에 합류합니다
        </p>
      </header>

      <div className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm shadow-sky-100/80">
        <form action={acceptInvitation} className="flex flex-col gap-5">
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-slate-600">
            초대 링크를 통해 접속하셨습니다. 아래 버튼을 눌러 기관에 합류하세요.
          </p>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-700"
          >
            기관 합류
          </button>
        </form>
      </div>
    </div>
  );
}
