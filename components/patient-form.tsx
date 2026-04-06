"use client";

type Prefill = {
  name: string;
  phone: string;
  residentFront: string;
};

type Props = {
  query: string;
  prefill: Prefill;
  pending: boolean;
  registerMessage: string | null;
  onSubmit: (fd: FormData) => void;
};

export function PatientForm({
  query,
  prefill,
  pending,
  registerMessage,
  onSubmit,
}: Props) {
  return (
    <form key={`register-${query}`} className="mt-5 grid gap-4" action={onSubmit}>
      <div>
        <label htmlFor="name" className="text-xs font-medium text-slate-600">
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={prefill.name}
          className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
        />
      </div>
      <div>
        <label htmlFor="chart_no" className="text-xs font-medium text-slate-600">
          차트 번호
        </label>
        <input
          id="chart_no"
          name="chart_no"
          type="text"
          inputMode="numeric"
          placeholder="예: 12-34"
          className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
        />
      </div>
      <div>
        <label htmlFor="phone" className="text-xs font-medium text-slate-600">
          연락처
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={prefill.phone}
          className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="resident_no_front"
            className="text-xs font-medium text-slate-600"
          >
            주민등록번호 앞 6자리
          </label>
          <input
            id="resident_no_front"
            name="resident_no_front"
            inputMode="numeric"
            maxLength={6}
            autoComplete="off"
            defaultValue={prefill.residentFront}
            placeholder="YYMMDD"
            className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 font-mono text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
          />
        </div>
        <div>
          <label
            htmlFor="resident_no_back"
            className="text-xs font-medium text-slate-600"
          >
            뒤 7자리
          </label>
          <input
            id="resident_no_back"
            name="resident_no_back"
            inputMode="numeric"
            maxLength={7}
            autoComplete="off"
            className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 font-mono text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
          />
        </div>
      </div>
      <p className="text-[11px] leading-snug text-slate-500">
        주민번호는 선택 사항입니다. 입력 시 서버에 저장·검색되며, 타 병원 매칭을 위한
        해시 식별자를 서버에서 계산할 수 있습니다.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-xl bg-sky-600 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
      >
        {pending ? "등록 중..." : "새 환자 등록"}
      </button>
      {registerMessage ? (
        <p
          className={`text-sm ${registerMessage.startsWith("등록") ? "text-emerald-600" : "text-red-600"}`}
        >
          {registerMessage}
        </p>
      ) : null}
    </form>
  );
}
