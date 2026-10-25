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
          휴대폰 번호를 입력하면 인증번호를 보내 드립니다. 처음이시면 병원에서 받은 문자 링크로 들어와 주세요.
        </p>
        <PatientLoginForm />
      </div>
    </div>
  );
}
