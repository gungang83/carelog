"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updatePatient } from "@/app/actions/patients";
import type { PatientRow } from "@/lib/types/database";
import { formatResidentNoForList } from "@/lib/rrn-core";

type Props = { patient: PatientRow };

type EditProps = Props & { initialOpen?: boolean };

export function PatientEditForm({ patient, initialOpen = false }: EditProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(initialOpen);
  const rrn = patient.resident_no;
  const defaultFront = rrn && rrn.length === 13 ? rrn.slice(0, 6) : "";
  const defaultBack = rrn && rrn.length === 13 ? rrn.slice(6) : "";

  return (
    <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800">환자 정보 수정</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-h-11 rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-800 shadow-sm hover:bg-sky-100"
        >
          {open ? "수정 닫기" : "정보 수정"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        주민등록번호는 앞·뒤 각각 정확히 입력해야 저장됩니다. 비우면 저장 시
        주민번호 항목은 삭제됩니다.
      </p>
      {open ? (
        <form
          className="mt-4 grid gap-4"
          action={(fd) => {
            setMessage(null);
            fd.set("patient_id", patient.id);
            const front = String(fd.get("resident_no_front") ?? "").replace(/\D/g, "");
            const back = String(fd.get("resident_no_back") ?? "").replace(/\D/g, "");
            fd.set("resident_no", front && back ? `${front}${back}` : "");
            start(async () => {
              const res = await updatePatient(fd);
              if (res.ok) {
                router.refresh();
                setMessage("저장되었습니다.");
              } else {
                setMessage(res.message);
              }
            });
          }}
        >
        <div>
          <label htmlFor="edit_name" className="text-xs font-medium text-slate-600">
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            id="edit_name"
            name="name"
            required
            defaultValue={patient.name}
            className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
          />
        </div>
        <div>
          <label htmlFor="edit_chart_no" className="text-xs font-medium text-slate-600">
            차트 번호
          </label>
          <input
            id="edit_chart_no"
            name="chart_no"
            type="text"
            defaultValue={patient.chart_no ?? ""}
            className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
          />
        </div>
        <div>
          <label htmlFor="edit_phone" className="text-xs font-medium text-slate-600">
            연락처
          </label>
          <input
            id="edit_phone"
            name="phone"
            type="tel"
            defaultValue={patient.phone ?? ""}
            className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="edit_resident_front"
              className="text-xs font-medium text-slate-600"
            >
              주민번호 앞 6자리
            </label>
            <input
              id="edit_resident_front"
              name="resident_no_front"
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
              defaultValue={defaultFront}
              placeholder="YYMMDD"
              className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 font-mono text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
            />
          </div>
          <div>
            <label
              htmlFor="edit_resident_back"
              className="text-xs font-medium text-slate-600"
            >
              뒤 7자리
            </label>
            <input
              id="edit_resident_back"
              name="resident_no_back"
              inputMode="numeric"
              maxLength={7}
              autoComplete="off"
              defaultValue={defaultBack}
              className="mt-1 w-full min-h-11 rounded-xl border border-sky-200 px-3 font-mono text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
            />
          </div>
        </div>
        {patient.resident_no ? (
          <p className="text-[11px] text-slate-500">
            현재 등록(표시): {formatResidentNoForList(patient.resident_no)}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl border border-sky-200 bg-sky-50 text-sm font-semibold text-sky-900 shadow-sm hover:bg-sky-100 disabled:opacity-60"
        >
          {pending ? "저장 중..." : "정보 저장"}
        </button>
        {message ? (
          <p
            className={`text-sm ${message === "저장되었습니다." ? "text-emerald-600" : "text-red-600"}`}
            role="status"
          >
            {message}
          </p>
        ) : null}
        </form>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          이름, 연락처, 차트번호, 주민번호를 수정하려면 `정보 수정` 버튼을 눌러주세요.
        </p>
      )}
    </section>
  );
}
