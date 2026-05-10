import { PatientLoginForm } from "@/components/patient/patient-login-form";

export default function PatientLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-sky-600 mb-1">
          케어로그
        </p>
        <h1 className="text-xl font-semibold text-slate-900 mb-6">
          환자 로그인
        </h1>

        <p className="mb-6 text-sm text-slate-600">
          주민등록번호와 전화번호를 입력하면 인증번호를 발송해 드립니다.
        </p>

        <PatientLoginForm />
      </div>
    </div>
  );
}
