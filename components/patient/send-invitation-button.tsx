"use client";

import { useState, useRef } from "react";
import { sendPatientInvitation } from "@/app/actions/patient-portal";

type Props = {
  patientId: string;
  phone: string | null;
  hasRrn: boolean;
};

export function SendInvitationButton({ patientId, phone, hasRrn }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "sending" | "done" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const result = await sendPatientInvitation(formData);

    if (result.ok) {
      setStatus("done");
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 2000);
    } else {
      setStatus("error");
      setErrorMsg(result.message);
    }
  }

  if (!hasRrn) {
    return (
      <div className="relative inline-block">
        <button
          disabled
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
          title="주민번호 등록 후 사용 가능"
        >
          상담 공유
        </button>
        <p className="mt-1 text-xs text-slate-400">
          주민번호 등록 후 사용 가능
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 transition-colors"
      >
        상담 공유
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              상담 내역 문자 전송
            </h2>

            {status === "done" ? (
              <p className="text-center text-sm font-medium text-green-600">
                전송 완료! 환자에게 SMS가 발송되었습니다.
              </p>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit}>
                <input type="hidden" name="patient_id" value={patientId} />

                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    전화번호
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={phone ?? ""}
                    placeholder="010-0000-0000"
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                  />
                </div>

                <div className="mb-4 flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="consent"
                    name="consent_given"
                    value="true"
                    required
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600"
                  />
                  <label htmlFor="consent" className="text-sm text-slate-600">
                    환자의 개인정보 제공 동의를 확인했습니다. (케어로그 서비스
                    이용 문자 발송)
                  </label>
                </div>

                {status === "error" && (
                  <p className="mb-3 text-sm text-red-600">{errorMsg}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setStatus("idle");
                      setErrorMsg("");
                    }}
                    className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="flex-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                  >
                    {status === "sending" ? "전송 중..." : "문자 전송"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
