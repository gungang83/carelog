import { PatientHome } from "@/components/patient-home";

export default function PatientsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="text-center sm:text-left">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-sky-600">
          Patient Center
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          환자 목록 및 등록
        </h1>
        <p className="mt-2 max-w-xl text-slate-600">
          통합 검색으로 환자를 찾고, 바로 등록하거나 정보를 수정할 수 있습니다.
        </p>
      </header>

      <PatientHome />
    </div>
  );
}
