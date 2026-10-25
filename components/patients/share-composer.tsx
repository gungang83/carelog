"use client";

// spec 038 — 환자에게 보내기: 상담이 끝난 기록에서 보낼 내용을 고르고 → 쉬운 말 초안(또는 그대로) → 다듬고 → 미리보고 → 보낸다.
//   직원 기록은 그대로 두고 환자용 문서(patient_shares)를 따로 만든다. 처음 보내는 환자는 개인정보 제공 동의 확인 필수.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  draftPatientShare,
  getShareContext,
  sendPatientShare,
  type ShareContext,
} from "@/app/actions/patient-shares";
import { blocksToHtml, blocksToText, recordImages, splitRecordBlocks } from "@/lib/patient-share";
import { renderContentHtml } from "@/lib/content-html";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/rich-text-editor";

export function ShareComposer({ consultationId, onClose, onSent }: { consultationId: string; onClose: () => void; onSent?: () => void }) {
  const router = useRouter();
  const [ctx, setCtx] = useState<ShareContext | null>(null);
  const [loadMsg, setLoadMsg] = useState("불러오는 중…");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [imgs, setImgs] = useState<Record<string, boolean>>({});
  const [rx, setRx] = useState<Record<string, boolean>>({});
  const [html, setHtml] = useState("");
  const [consent, setConsent] = useState(false);
  const [includeContact, setIncludeContact] = useState(false); // 병원 설정이 기본값 — 보내는 순간 바꿀 수 있다
  const [busy, setBusy] = useState<"" | "draft" | "send">("");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const editorRef = useRef<RichTextEditorHandle | null>(null);

  useEffect(() => {
    let alive = true;
    void getShareContext(consultationId).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setLoadMsg(r.message);
        return;
      }
      setCtx(r.ctx);
      setIncludeContact(r.ctx.includeContactDefault);
      const bl = splitRecordBlocks(r.ctx.content);
      setPicked(Object.fromEntries(bl.map((b) => [b.id, b.defaultOn])));
      setImgs(Object.fromEntries(recordImages(r.ctx.content).map((u) => [u, true])));
      setRx(Object.fromEntries(r.ctx.prescriptions.map((p) => [p, true])));
    });
    return () => {
      alive = false;
    };
  }, [consultationId]);

  const blocks = useMemo(() => (ctx ? splitRecordBlocks(ctx.content) : []), [ctx]);
  const images = useMemo(() => (ctx ? recordImages(ctx.content) : []), [ctx]);
  const chosen = blocks.filter((b) => picked[b.id]);
  const chosenImgs = images.filter((u) => imgs[u]);
  const chosenRx = (ctx?.prescriptions ?? []).filter((p) => rx[p]);

  const put = (h: string) => {
    setHtml(h);
    editorRef.current?.setHTML(h);
  };

  const draft = async () => {
    if (!ctx) return;
    if (html.replace(/<[^>]*>/g, "").trim() && !window.confirm("지금 작성한 내용을 새 초안으로 바꿀까요?")) return;
    setBusy("draft");
    setMsg("");
    const r = await draftPatientShare({
      consultationId,
      selectedText: blocksToText(chosen),
      prescriptions: chosenRx,
      patientName: ctx.patient.name,
    });
    setBusy("");
    if (r.ok) put(r.html);
    else setMsg(r.message);
  };

  const send = async () => {
    if (!ctx) return;
    setBusy("send");
    setMsg("");
    const r = await sendPatientShare({
      consultationId,
      content: html,
      images: chosenImgs,
      prescriptions: chosenRx,
      consent,
      includeContact,
    });
    setBusy("");
    if (r.ok) {
      setSent(true);
      onSent?.();
      router.refresh();
    } else setMsg(r.message);
  };

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-400 line-through"}`;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-50">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <h2 className="text-base font-bold text-slate-900">📩 환자에게 보내기</h2>
        {ctx && (
          <span className="text-sm text-slate-500">
            {ctx.patient.name} · {ctx.patient.maskedPhone ?? "휴대폰 번호 없음"}
          </span>
        )}
        <button type="button" onClick={onClose} className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          닫기
        </button>
      </div>

      {!ctx ? (
        <p className="p-8 text-center text-sm text-slate-500">{loadMsg}</p>
      ) : sent ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-2xl">✅</p>
          <p className="text-base font-semibold text-slate-900">{ctx.patient.name}님께 상담 안내를 보냈어요</p>
          <p className="text-sm text-slate-500">환자가 문자 링크를 열면 이 기록 카드에 &quot;환자가 확인했어요&quot;로 표시됩니다.</p>
          <button type="button" onClick={onClose} className="mt-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            닫기
          </button>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[1fr_360px]">
          <div className="flex min-w-0 flex-col gap-4">
            {/* ① 고르기 */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-sm font-semibold text-slate-800">① 보낼 내용 고르기</p>
              <ul className="flex flex-col gap-1.5">
                {blocks.map((b) => (
                  <li key={b.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={!!picked[b.id]}
                        onChange={(e) => setPicked((p) => ({ ...p, [b.id]: e.target.checked }))}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 text-sm">
                        <span className="font-semibold text-slate-800">{b.label ?? "기타"}</span>
                        <span className="ml-2 text-slate-500">{b.lines.join(" · ").slice(0, 90)}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {images.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold text-slate-500">그림(누르면 넣기/빼기)</p>
                  <div className="flex flex-wrap gap-2">
                    {images.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setImgs((s) => ({ ...s, [u]: !s[u] }))}
                        className={`relative overflow-hidden rounded-lg border-2 ${imgs[u] ? "border-sky-500" : "border-slate-200 opacity-40"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" className="h-16 w-24 object-cover" />
                        {imgs[u] && <span className="absolute right-1 top-1 rounded bg-sky-600 px-1 text-[10px] text-white">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {ctx.prescriptions.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500">처방 제품</span>
                  {ctx.prescriptions.map((p) => (
                    <button key={p} type="button" onClick={() => setRx((s) => ({ ...s, [p]: !s[p] }))} className={chip(!!rx[p])}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* ② 환자용 문장 */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-800">② 환자용 문장</p>
                <button
                  type="button"
                  onClick={() => void draft()}
                  disabled={busy !== "" || chosen.length === 0}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-40"
                  title="고른 내용을 환자가 읽기 쉬운 말로 바꾼 초안을 만듭니다 (1크레딧)"
                >
                  {busy === "draft" ? "만드는 중…" : "✨ 쉬운 말로 초안 만들기 · 1크레딧"}
                </button>
                <button
                  type="button"
                  onClick={() => put(blocksToHtml(chosen))}
                  disabled={busy !== "" || chosen.length === 0}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  고른 내용 그대로 넣기
                </button>
              </div>
              <RichTextEditor ref={editorRef} value={html} onChange={setHtml} placeholder="초안을 만들거나 직접 써 주세요. 보내기 전에 꼭 읽어 보세요." />
            </section>

            {/* ③ 동의·보내기 */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              {!ctx.consentDone && (
                <label className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                  <span>
                    환자에게 <b>개인정보 제공 동의</b>(케어로그로 상담 안내 받기)를 확인했습니다. <span className="text-amber-600">— 이 환자 처음 1회</span>
                  </span>
                </label>
              )}
              {/* 이번 메시지에 병원 대표번호 넣기 — 기본값은 설정 › 환자 문자 · 알림톡 */}
              <label className={`mb-3 flex items-center gap-2 text-sm ${ctx.contactPhone ? "text-slate-700" : "text-slate-400"}`}>
                <input
                  type="checkbox"
                  checked={includeContact && !!ctx.contactPhone}
                  disabled={!ctx.contactPhone}
                  onChange={(e) => setIncludeContact(e.target.checked)}
                />
                {ctx.contactPhone ? (
                  <>
                    메시지에 <b>&quot;문의: {ctx.contactPhone}&quot;</b> 넣기
                  </>
                ) : (
                  <>병원 대표번호를 넣으려면 설정 › 환자 문자 · 알림톡에서 번호를 등록하세요</>
                )}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={busy !== "" || !html.replace(/<[^>]*>/g, "").trim() || !ctx.patient.maskedPhone || (!ctx.consentDone && !consent)}
                  className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
                >
                  {busy === "send" ? "보내는 중…" : ctx.channel === "alimtalk" ? "카카오 알림톡으로 보내기" : "문자로 보내기"}
                </button>
                <span className="text-xs text-slate-500">
                  {ctx.channel === "alimtalk" ? "알림톡이 안 되면 문자로 대신 보냅니다. " : ""}
                  환자는 링크 → 등록 번호로 인증번호 한 번 → 이 안내를 봅니다(주민번호 묻지 않음).
                </span>
              </div>
              {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
            </section>
          </div>

          {/* 미리보기 — 환자 휴대폰 화면 */}
          <aside className="lg:sticky lg:top-0">
            <p className="mb-2 text-xs font-semibold text-slate-500">환자가 보는 화면</p>
            <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[28px] border-8 border-slate-800 bg-white shadow-lg">
              <div className="max-h-[70vh] overflow-y-auto p-4">
                <p className="text-[11px] font-semibold text-sky-600">상담 안내</p>
                <p className="mb-3 text-base font-bold text-slate-900">{ctx.patient.name}님</p>
                {html.replace(/<[^>]*>/g, "").trim() ? (
                  <div className="rich-content text-sm leading-6 text-slate-800" dangerouslySetInnerHTML={{ __html: renderContentHtml(html) }} />
                ) : (
                  <p className="text-sm text-slate-300">② 환자용 문장을 만들면 여기에 보입니다</p>
                )}
                {chosenImgs.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt="" className="mt-3 w-full rounded-lg border border-slate-100" />
                ))}
                {chosenRx.length > 0 && (
                  <div className="mt-4 rounded-xl bg-sky-50 p-3">
                    <p className="mb-1 text-xs font-semibold text-sky-700">추천 관리 제품</p>
                    <ul className="list-disc pl-4 text-sm text-slate-700">
                      {chosenRx.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
