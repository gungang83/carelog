"use client";

import { useState, useTransition } from "react";
import { sendPatientInvitation } from "@/app/actions/patient-portal";
import type { PatientPortalStatusData, PatientSmsRecord } from "@/app/actions/patient-status";

type Props = {
  patientId: string;
  phone: string | null;
  hasRrn: boolean;
  status: PatientPortalStatusData;
};

function fmtDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  if (!withTime) return `${yy}.${mm}.${dd}`;
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}

function SmsRow({ record }: { record: PatientSmsRecord }) {
  const now = Date.now();
  const expired = new Date(record.expiresAt).getTime() < now;

  return (
    <div className="flex items-start gap-3 py-2 text-xs">
      <span className="w-28 shrink-0 font-mono text-slate-400">
        {fmtDate(record.sentAt, true)}
      </span>
      <span className="shrink-0 text-slate-600">{record.phone}</span>
      <span className="ml-auto shrink-0">
        {record.acceptedAt ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
            수락됨 {fmtDate(record.acceptedAt)}
          </span>
        ) : expired ? (
          <span className="text-slate-400">링크 만료</span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-600">
            대기 중
          </span>
        )}
      </span>
    </div>
  );
}

export function PatientPortalStatus({ patientId, phone, hasRrn, status }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const hasConsent = !!status.consentAt;

  const handleSend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setResultMsg(null);
    startTransition(async () => {
      const res = await sendPatientInvitation(fd);
      if (res.ok) {
        setResultMsg({ ok: true, text: "문자 발송 완료! 발송 이력은 새로고침 후 확인하세요." });
        setShowForm(false);
      } else {
        setResultMsg({ ok: false, text: res.message });
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">

      {/* 상태 배지 행 */}
      <div className="flex flex-wrap items-center gap-3">
        {status.isActive ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            앱 사용 중
            {status.linkedAt ? (
              <span className="text-xs font-normal text-emerald-500">
                ({fmtDate(status.linkedAt)} 가입)
              </span>
            ) : null}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-500">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            미가입
          </span>
        )}

        {hasConsent ? (
          <span className="text-xs text-slate-500">
            개인정보 활용 동의 완료
            <span className="ml-1 font-semibold text-slate-700">
              ({fmtDate(status.consentAt!)})
            </span>
          </span>
        ) : (
          <span className="text-xs text-slate-400">동의 미확인</span>
        )}
      </div>

      {/* SMS 발송 이력 */}
      {status.smsHistory.length > 0 ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50">
          <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
            문자 발송 이력 ({status.smsHistory.length}건)
          </div>
          <div className="divide-y divide-slate-100 px-4">
            {status.smsHistory.map((r) => (
              <SmsRow key={r.id} record={r} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">아직 문자를 발송한 이력이 없습니다.</p>
      )}

      {/* 발송 버튼 / 폼 */}
      {!hasRrn ? (
        <p className="text-xs text-slate-400">주민번호를 등록해야 문자 발송이 가능합니다.</p>
      ) : showForm ? (
        <form
          onSubmit={handleSend}
          className="flex flex-col gap-4 rounded-xl border border-sky-100 bg-sky-50/40 p-4"
        >
          <input type="hidden" name="patient_id" value={patientId} />

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              전화번호
            </label>
            <input
              type="tel"
              name="phone"
              defaultValue={phone ?? ""}
              required
              placeholder="010-0000-0000"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
          </div>

          {hasConsent ? (
            <>
              <input type="hidden" name="consent_given" value="true" />
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                개인정보 동의 완료 ({fmtDate(status.consentAt!)}) — 재동의 불필요
              </p>
            </>
          ) : (
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                name="consent_given"
                value="true"
                required
                className="mt-0.5 h-4 w-4 accent-sky-600"
              />
              환자의 개인정보 제공 동의를 확인했습니다.
            </label>
          )}

          {resultMsg && !resultMsg.ok ? (
            <p className="text-sm text-red-600">{resultMsg.text}</p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setResultMsg(null); }}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {pending ? "전송 중..." : "문자 전송"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => { setShowForm(true); setResultMsg(null); }}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-50"
        >
          + 상담 공유 문자 보내기
        </button>
      )}

      {resultMsg?.ok ? (
        <p className="text-sm text-emerald-600">{resultMsg.text}</p>
      ) : null}
    </div>
  );
}
