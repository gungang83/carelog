"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmConsultation,
  deleteDraftConsultation,
  sendConsultationSms,
  updateDraftConsultation,
  updateConsultationContent,
} from "@/app/actions/consultations";
import { CopyAllButton } from "@/components/copy-all-button";
import {
  searchPatientsForChair,
  unlinkChairRecord,
  relinkChairRecord,
} from "@/app/actions/chairs";
import { ZoomableImage } from "@/components/zoomable-image";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/rich-text-editor";

export type ConsultationHistoryItem = {
  id: string;
  content: string;
  image_urls: string[] | null;
  prescriptions: string[] | null;
  station_name: string | null;
  chair_id: string | null;
  status: string;
  sms_sent_at: string | null;
  created_at: string;
};

type Props = {
  consultations: ConsultationHistoryItem[];
  patientId: string;
};

const PRODUCT_ICON: Record<string, string> = {
  "미세모 칫솔": "칫솔",
  "고불소 치약": "치약",
  "치간 칫솔": "치간",
  "무알콜 가글": "가글",
};

function iconLabel(name: string) {
  const label = PRODUCT_ICON[name] ?? name;
  return label.length > 3 ? label.slice(0, 3) : label;
}

// 본문 HTML → 평문(접힌 카드 미리보기·검색 매칭용)
function stripHtmlPlain(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── 임시저장 액션 버튼 ───────────────────────────────────────────────────────
function DraftActions({
  item,
  patientId,
}: {
  item: ConsultationHistoryItem;
  patientId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(item.content);
  const [editPrescriptions] = useState<string[]>(item.prescriptions ?? []);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editorRef = useRef<RichTextEditorHandle>(null);

  const handleSaveEdit = () => {
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("prescriptions", JSON.stringify(editPrescriptions));
      const res = await updateDraftConsultation(item.id, editContent, fd);
      if (!res.ok) { setMessage(res.message); return; }
      setEditing(false);
    });
  };

  const handleConfirm = (shouldSendSms: boolean) => {
    setMessage(null);
    startTransition(async () => {
      const res = await confirmConsultation(item.id, patientId, shouldSendSms);
      if (!res.ok) setMessage(res.message);
    });
  };

  const handleDelete = () => {
    if (!confirm("임시 저장된 상담을 삭제할까요?")) return;
    setMessage(null);
    startTransition(async () => {
      const res = await deleteDraftConsultation(item.id, patientId);
      if (!res.ok) setMessage(res.message);
    });
  };

  if (editing) {
    return (
      <div className="mt-3 flex flex-col gap-3">
        <RichTextEditor
          ref={editorRef}
          value={editContent}
          onChange={setEditContent}
          placeholder="상담 내용을 수정하세요..."
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveEdit}
            disabled={pending}
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
          >
            {pending ? "저장 중..." : "수정 저장"}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setEditContent(item.content); }}
            disabled={pending}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            취소
          </button>
        </div>
        {message ? <p className="text-sm text-red-600">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={pending}
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          수정
        </button>
        <button
          type="button"
          onClick={() => handleConfirm(false)}
          disabled={pending}
          className="inline-flex min-h-9 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "처리 중..." : "확정"}
        </button>
        <button
          type="button"
          onClick={() => handleConfirm(true)}
          disabled={pending}
          className="inline-flex min-h-9 items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
        >
          {pending ? "처리 중..." : "확정 + 환자 전송"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          삭제
        </button>
      </div>
      {message ? (
        <p className={`text-sm ${message.startsWith("확정 완료") ? "text-amber-600" : "text-red-600"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

// ─── 체어 기록 재연결 / 연결 해제 ────────────────────────────────────────────
function RelinkControls({
  item,
  patientId,
}: {
  item: ConsultationHistoryItem;
  patientId: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "search">("menu");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; name: string; chart_no: string | null }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    startTransition(async () => {
      const data = await searchPatientsForChair(q);
      setResults(data);
    });
  };

  const handleRelink = (newPatientId: number) => {
    setMsg(null);
    startTransition(async () => {
      const res = await relinkChairRecord({ consultationId: item.id, newPatientId });
      if (res.ok) {
        setOpen(false);
        setMode("menu");
      } else {
        setMsg(res.message);
      }
    });
  };

  const handleUnlink = () => {
    if (!confirm("이 상담 기록을 미연결 상태로 되돌리겠습니까?")) return;
    setMsg(null);
    startTransition(async () => {
      const res = await unlinkChairRecord({ consultationId: item.id });
      if (!res.ok) setMsg(res.message);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
      >
        연결 변경
      </button>
    );
  }

  if (mode === "search") {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <input
          type="text"
          placeholder="다른 환자 이름 또는 차트번호 검색"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
          autoFocus
        />
        {results.length > 0 && (
          <ul className="flex flex-col gap-1">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => handleRelink(p.id)}
                  disabled={isPending}
                  className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 hover:border-sky-200 hover:bg-sky-50 disabled:opacity-50"
                >
                  {p.name}
                  {p.chart_no && <span className="ml-2 text-xs text-slate-400">#{p.chart_no}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setMode("menu")}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          취소
        </button>
        {msg && <p className="text-xs text-red-500">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setMode("search")}
        className="inline-flex min-h-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-700 hover:bg-sky-100"
      >
        다른 환자로 재연결
      </button>
      <button
        type="button"
        onClick={handleUnlink}
        disabled={isPending}
        className="inline-flex min-h-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
      >
        {isPending ? "처리 중…" : "미연결로 되돌리기"}
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setMode("menu"); }}
        className="inline-flex min-h-8 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs text-slate-500 hover:bg-slate-50"
      >
        취소
      </button>
      {msg && <p className="text-xs text-red-500">{msg}</p>}
    </div>
  );
}

// ─── 확정 상담 인라인 편집 (사후 정정) ───────────────────────────────────────
function ConfirmedEditControls({
  item,
  patientId,
}: {
  item: ConsultationHistoryItem;
  patientId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(item.content);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editorRef = useRef<RichTextEditorHandle>(null);

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("prescriptions", JSON.stringify(item.prescriptions ?? []));
      const res = await updateConsultationContent(item.id, patientId, editContent, fd);
      if (!res.ok) { setMessage(res.message); return; }
      setEditing(false);
      router.refresh();
    });
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <RichTextEditor
          ref={editorRef}
          value={editContent}
          onChange={setEditContent}
          placeholder="상담 내용을 수정하세요..."
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
          >
            {pending ? "저장 중..." : "수정 저장"}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setEditContent(item.content); setMessage(null); }}
            disabled={pending}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            취소
          </button>
        </div>
        {message ? <p className="text-sm text-red-600">{message}</p> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex min-h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
    >
      편집
    </button>
  );
}

// ─── 확정된 상담 SMS 전송 버튼 ────────────────────────────────────────────────
function SmsControls({
  item,
  patientId,
}: {
  item: ConsultationHistoryItem;
  patientId: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sentAt, setSentAt] = useState<string | null>(item.sms_sent_at);

  const handleSend = () => {
    if (!confirm("환자에게 상담 내역 링크를 SMS로 전송할까요?")) return;
    setMessage(null);
    startTransition(async () => {
      const res = await sendConsultationSms(item.id, patientId);
      if (!res.ok) {
        setMessage(res.message);
      } else {
        setSentAt(new Date().toISOString());
      }
    });
  };

  const sentLabel = sentAt
    ? new Date(sentAt).toLocaleString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
      {sentLabel ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
          <span>✓</span>
          <span>SMS 전송됨 ({sentLabel})</span>
        </span>
      ) : (
        <span className="text-slate-400">SMS 미전송</span>
      )}
      <button
        type="button"
        onClick={handleSend}
        disabled={pending}
        className="inline-flex min-h-8 items-center justify-center rounded-lg border border-sky-200 bg-white px-3 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-60"
      >
        {pending ? "전송 중..." : sentLabel ? "재전송" : "환자에게 전송"}
      </button>
      {message ? <p className="text-red-600">{message}</p> : null}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function ConsultationHistory({ consultations, patientId }: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // spec 011 A6 — 카드 접이식 보기 + 환자 내 키워드 검색
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const closeLightbox = useCallback(() => setLightboxUrl(null), []);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#consultation-")) return;
    const targetId = hash.slice(1);
    setHighlightId(targetId);
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      const timer = setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeLightbox(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl, closeLightbox]);

  if (consultations.length === 0) {
    return <p className="mt-6 text-sm text-slate-600">아직 저장된 상담 기록이 없습니다.</p>;
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? consultations.filter((c) => stripHtmlPlain(c.content).toLowerCase().includes(q))
    : consultations;

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="이 환자 상담 내용 검색"
        className="mt-6 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
      />
      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">검색 결과가 없어요.</p>
      ) : (
      <ol className="mt-4 space-y-4">
        {filtered.map((c) => {
          const created = new Date(c.created_at);
          const createdLabel = Number.isNaN(created.getTime())
            ? c.created_at
            : created.toLocaleString("ko-KR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });

          const urls = c.image_urls ?? [];
          const prescriptions = c.prescriptions ?? [];
          const isDraft = c.status === "draft";
          const isHighlighted = highlightId === `consultation-${c.id}`;
          const open = openId === c.id || isHighlighted;
          const preview = stripHtmlPlain(c.content);

          return (
            <li
              key={c.id}
              id={`consultation-${c.id}`}
              className={`rounded-2xl border p-4 shadow-sm transition-colors duration-1000 ${
                isDraft
                  ? "border-amber-200 bg-amber-50"
                  : isHighlighted
                  ? "border-sky-400 bg-sky-50"
                  : "border-sky-100 bg-white"
              }`}
            >
              {/* 헤더 — 클릭 시 펼침/접힘(기본 접힘, A6) */}
              <button
                type="button"
                onClick={() => setOpenId(open ? null : c.id)}
                className="flex w-full items-start gap-2 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <time dateTime={c.created_at} className="text-xs font-semibold text-slate-500">
                      {createdLabel}
                    </time>
                    {isDraft ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        임시저장
                      </span>
                    ) : null}
                    {c.station_name ? (
                      <>
                        <span className="text-[11px] text-sky-200" aria-hidden>·</span>
                        <span className="text-[11px] font-medium tracking-tight text-sky-700">
                          {c.station_name}
                        </span>
                      </>
                    ) : null}
                  </div>
                  {!open && (
                    <p className="mt-1 truncate text-sm text-slate-600">
                      {preview || "(내용 없음)"}
                    </p>
                  )}
                </div>
                <span className="mt-0.5 shrink-0 text-xs text-slate-400">{open ? "▲" : "▼"}</span>
              </button>

              {open && (
              <>
              {/* 본문 */}
              <div
                className="rich-content mt-3 text-sm leading-6 text-slate-800"
                dangerouslySetInnerHTML={{ __html: c.content }}
              />

              {/* 전체 복사 — 덴트웹 등 외부 EMR 붙여넣기용 */}
              <div className="mt-3">
                <CopyAllButton
                  html={c.content}
                  label="전체 복사"
                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                />
              </div>

              {/* 이미지 */}
              {urls.length ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-600">
                    이미지 ({urls.length}) — 썸네일을 눌러 확대
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {urls.map((url, idx) => (
                      <button
                        key={`${c.id}-${idx}`}
                        type="button"
                        onClick={() => setLightboxUrl(url)}
                        className="group relative overflow-hidden rounded-xl border border-sky-100 bg-sky-50/30 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-28 w-full object-cover transition group-hover:scale-[1.02]" />
                        <span className="absolute bottom-2 right-2 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-semibold text-sky-800 shadow">
                          확대
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* 처방 제품 */}
              {prescriptions.length ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-600">처방 제품</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {prescriptions.map((name) => (
                      <span
                        key={`${c.id}-${name}`}
                        className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50 px-4 py-2.5 shadow-sm"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-xs font-bold text-sky-800">
                          {iconLabel(name)}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">{name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* 하단 액션 */}
              {isDraft ? (
                <DraftActions item={c} patientId={patientId} />
              ) : (
                <div className="flex flex-col gap-2">
                  <SmsControls item={c} patientId={patientId} />
                  <ConfirmedEditControls item={c} patientId={patientId} />
                  {c.chair_id && (
                    <RelinkControls item={c} patientId={patientId} />
                  )}
                </div>
              )}
              </>
              )}
            </li>
          );
        })}
      </ol>
      )}

      {/* 이미지 라이트박스 */}
      {lightboxUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="이미지 확대"
          onClick={closeLightbox}
        >
          <div
            className="relative h-[85vh] max-h-[85vh] w-full max-w-4xl rounded-2xl border border-sky-100 bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute right-3 top-3 z-10 min-h-11 min-w-11 rounded-xl border border-sky-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-sky-50"
            >
              닫기
            </button>
            <ZoomableImage src={lightboxUrl} />
          </div>
        </div>
      ) : null}
    </>
  );
}
