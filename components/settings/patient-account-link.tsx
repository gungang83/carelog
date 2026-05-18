"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkMyPatientAccount } from "@/app/actions/patient-portal";

type Props = {
  initialLinked: boolean;
};

export function PatientAccountLink({ initialLinked }: Props) {
  const router = useRouter();
  const [linked, setLinked] = useState(initialLinked);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("pending");
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const rrnFront = String(formData.get("rrn_front") ?? "").trim();
    const rrnBack = String(formData.get("rrn_back") ?? "").trim();

    const result = await linkMyPatientAccount(rrnFront, rrnBack);

    if (result.ok) {
      setLinked(true);
      setOpen(false);
      router.refresh();
    } else {
      setStatus("error");
      setErrorMsg(result.message);
    }
  }

  if (linked) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-green-100 bg-green-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-green-800">환자 계정 연동 완료</p>
            <p className="text-xs text-green-600">
              내 진료 기록을 환자 포털에서 확인할 수 있습니다.
            </p>
          </div>
        </div>
        <a
          href="/portal/records"
          className="shrink-0 rounded-xl border border-green-200 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-50"
        >
          진료 기록 보기 →
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              내 환자 계정 연동
            </p>
            <p className="mt-1 text-xs text-slate-500">
              본인의 주민번호를 입력하면 치과에 등록된 진료 기록을 케어로그
              환자 포털과 연동합니다. SMS 초대 없이 즉시 연동됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700"
          >
            연동하기
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-slate-900">
              내 환자 계정 연동
            </h2>
            <p className="mb-5 text-sm text-slate-500">
              이 기관에 등록된 본인의 주민번호를 입력하세요. 입력 정보는
              해시 처리되어 저장됩니다.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  주민등록번호
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    name="rrn_front"
                    placeholder="앞 6자리"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="\d{6}"
                    required
                    autoFocus
                    className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                  />
                  <span className="text-slate-400">—</span>
                  <input
                    type="password"
                    name="rrn_back"
                    placeholder="뒤 7자리"
                    maxLength={7}
                    inputMode="numeric"
                    pattern="\d{7}"
                    required
                    className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  환자 목록에 등록된 주민번호와 일치해야 합니다.
                </p>
              </div>

              {status === "error" && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {errorMsg}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setStatus("idle");
                    setErrorMsg("");
                  }}
                  className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={status === "pending"}
                  className="flex-1 rounded-xl bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {status === "pending" ? "확인 중..." : "연동하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
