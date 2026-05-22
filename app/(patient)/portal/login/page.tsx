import { PatientLoginForm } from "@/components/patient/patient-login-form";

export default function PatientLoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-sky-600">
          케어로그
        </p>
        <h1 className="mb-2 text-xl font-semibold text-slate-900">환자 로그인</h1>
        <p className="mb-6 text-sm text-slate-500">
          주민등록번호와 전화번호를 입력하면 인증번호를 발송해 드립니다.
        </p>
        <PatientLoginForm />
      </div>
    </div>
  );
}
