export default function PatientDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 pb-16 animate-pulse">
      <div className="h-4 w-24 rounded bg-slate-200" />

      <div className="rounded-2xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
        <div className="h-3 w-16 rounded bg-slate-200" />
        <div className="mt-2 h-7 w-40 rounded bg-slate-200" />
        <div className="mt-2 h-4 w-64 rounded bg-slate-200" />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="h-5 w-32 rounded bg-slate-200" />
        <div className="mt-4 h-32 rounded-xl bg-slate-100" />
        <div className="mt-4 flex gap-3">
          <div className="h-10 w-24 rounded-xl bg-slate-200" />
          <div className="h-10 w-28 rounded-xl bg-slate-200" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
        <div className="h-5 w-28 rounded bg-slate-200" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-slate-100 p-4 space-y-2">
            <div className="h-4 w-20 rounded bg-slate-200" />
            <div className="h-4 w-full rounded bg-slate-100" />
            <div className="h-4 w-3/4 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
