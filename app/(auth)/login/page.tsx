import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "로그인 — Carelog" };

export default function LoginPage() {
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

      <div className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm shadow-sky-100/80">
        <LoginForm />
      </div>
    </div>
  );
}
