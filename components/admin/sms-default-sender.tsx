"use client";

// 슈퍼어드민 — 케어로그 기본 발신번호. 솔라피에 등록된 번호 중에서 고르고 테스트 문자로 확인해 저장.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetDefaultSender, setDefaultSender, type SmsAdminData } from "@/app/actions/sms-admin";

const fmt = (d: string) => d.replace(/\D/g, "").replace(/^(02|0\d{2})(\d{3,4})(\d{4})$/, "$1-$2-$3").replace(/^(1\d{3})(\d{4})$/, "$1-$2");

export function SmsDefaultSender({ data }: { data: SmsAdminData }) {
  const router = useRouter();
  const [pick, setPick] = useState(data.current);
  const [testTo, setTestTo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const r = await setDefaultSender({ phone: pick, testTo });
      if (r.ok) {
        setMsg({ ok: true, text: "테스트 문자가 나갔고, 기본 번호를 바꿨어요(1분 안에 모든 발송에 반영)." });
        router.refresh();
      } else setMsg({ ok: false, text: r.message });
    });
  };
  const reset = () =>
    startTransition(async () => {
      const r = await resetDefaultSender();
      setMsg(r.ok ? { ok: true, text: "환경변수 번호로 되돌렸어요." } : { ok: false, text: r.message });
      router.refresh();
    });

  if (!data.tableReady)
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        DB 준비 전이에요 — SQL `20261116000002_platform_settings.sql`을 실행하면 여기서 바꿀 수 있어요. 지금 기본 번호: {data.envPhone ? fmt(data.envPhone) : "없음"}(환경변수)
      </p>
    );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold text-slate-500">지금 케어로그 기본 번호</p>
        <p className="mt-1 text-2xl font-black text-slate-900">{data.current ? fmt(data.current) : "없음"}</p>
        <p className="mt-1 text-xs text-slate-400">
          {data.source === "setting" ? `이 화면에서 정한 번호${data.updatedBy ? ` · ${data.updatedBy}` : ""}` : data.source === "env" ? "환경변수 SOLAPI_SENDER_PHONE" : "설정 없음 — 문자가 나가지 않습니다"}
          {" · "}병원 번호를 고르지 않은 모든 워크스페이스가 이 번호로 보냅니다.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">기본 번호 바꾸기</p>
        {data.active === null ? (
          <p className="text-xs text-amber-700">솔라피 등록 번호 목록을 불러오지 못했어요. 아래에 번호를 직접 넣고 테스트 문자로 확인하세요.</p>
        ) : data.active.length === 0 ? (
          <p className="text-xs text-amber-700">솔라피에 활성 발신번호가 없어요. 솔라피 콘솔 → 발신번호 관리에서 먼저 등록하세요.</p>
        ) : (
          <div>
            <p className="mb-1.5 text-xs text-slate-500">솔라피에 등록(활성)된 번호 {data.active.length}개</p>
            <div className="flex flex-wrap gap-1.5">
              {data.active.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPick(n)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                    pick === n ? "border-sky-500 bg-sky-50 text-sky-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {fmt(n)}
                  {n === data.current && <span className="ml-1 text-[10px] font-bold text-emerald-600">사용 중</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          번호
          <input value={pick} onChange={(e) => setPick(e.target.value)} inputMode="tel" className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-sky-500" />
        </label>
        <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          테스트 받을 내 휴대폰
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} inputMode="tel" placeholder="010-0000-0000" className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-sky-500" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={isPending || !pick.trim() || !testTo.trim()}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {isPending ? "보내는 중…" : "테스트 문자 받고 기본 번호로"}
          </button>
          {data.source === "setting" && (
            <button type="button" onClick={reset} disabled={isPending} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              환경변수 번호로 되돌리기{data.envPhone ? ` (${fmt(data.envPhone)})` : ""}
            </button>
          )}
        </div>
        {msg && <p className={`rounded-lg px-3 py-2 text-xs ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
