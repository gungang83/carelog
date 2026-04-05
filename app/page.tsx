import { PatientHome } from "@/components/patient-home";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6">
      <header className="text-center sm:text-left">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-sky-600">
          Dental chart
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Carelog
        </h1>
        <p className="mt-2 max-w-xl text-slate-600">
          환자를 검색하거나 새로 등록한 뒤, 상담 내용과 이미지를 기록합니다.
        </p>
      </header>

      <PatientHome />
    </div>
  );
}
