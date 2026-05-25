"use client";

const PRODUCTS = [
  { name: "미세모 칫솔", label: "칫솔" },
  { name: "고불소 치약", label: "치약" },
  { name: "치간 칫솔", label: "치간" },
  { name: "무알콜 가글", label: "가글" },
];

export function PrescriptionPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (name: string) =>
    onChange(
      value.includes(name) ? value.filter((x) => x !== name) : [...value, name],
    );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-slate-500">처방 제품 선택</p>
      <div className="flex flex-wrap gap-2">
        {PRODUCTS.map((p) => {
          const selected = value.includes(p.name);
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => toggle(p.name)}
              className={[
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                selected
                  ? "border-sky-400 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50",
              ].join(" ")}
            >
              <span
                className={[
                  "flex size-5 items-center justify-center rounded-full text-[9px] font-bold",
                  selected ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600",
                ].join(" ")}
              >
                {p.label}
              </span>
              {p.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
