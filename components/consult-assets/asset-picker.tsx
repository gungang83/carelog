"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CONSULT_ASSET_CATEGORIES, categoryLabel, type ConsultAsset, type PickerData } from "@/lib/consult-assets";
import { getPickerData, createConsultAsset } from "@/app/actions/consult-assets";
import { compressImageFile } from "@/lib/image/optimize";
import { ImageAnnotator } from "@/components/image-annotator";

export type AssetInsertPayload = {
  kind: "image" | "video_link";
  image_url: string | null;
  link_url: string | null;
  title: string;
  caption: string | null;
};

// spec 025/026/029 — 상담 에디터 자료 픽커.
//   기본 뷰 = 기관이 구성한 카테고리(큐레이션). '전체 Library' 탭 = 우리 기관/Carelog 제공 + 분류·검색.
//   카테고리 미구성 기관은 Library 뷰 폴백. 스테이지(크게 열고 그리기)·빈 캔버스·즉석 업로드 유지.
export function AssetPicker({
  onInsert,
  onInsertAnnotated,
  onClose,
}: {
  onInsert: (asset: AssetInsertPayload) => void;
  onInsertAnnotated?: (file: File) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<PickerData | null>(null);
  // view: 카테고리 id 또는 "library"
  const [view, setView] = useState<string>("library");
  const [libTab, setLibTab] = useState<"mine" | "global">("mine");
  const [libFilter, setLibFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<ConsultAsset | null>(null);
  const [withCaption, setWithCaption] = useState(true);
  const [uploadTitle, setUploadTitle] = useState("");
  const [stageFile, setStageFile] = useState<File | null>(null);
  const [stageBusy, setStageBusy] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPickerData()
      .then((d) => {
        setData(d);
        if (d.categories.length > 0) setView(d.categories[0].id);
      })
      .catch(() => setData({ categories: [], mine: [], global: [] }));
  }, []);

  const hasCategories = (data?.categories.length ?? 0) > 0;

  const visibleAssets: ConsultAsset[] = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const match = (a: ConsultAsset) => !q || a.title.toLowerCase().includes(q) || (a.caption ?? "").toLowerCase().includes(q);
    if (view !== "library") {
      const cat = data.categories.find((c) => c.id === view);
      return (cat?.items ?? []).map((i) => i.asset).filter(match);
    }
    const src = libTab === "mine" ? data.mine : data.global;
    return src.filter((a) => (libFilter === "all" || a.category === libFilter) && match(a));
  }, [data, view, libTab, libFilter, query]);

  const insert = (a: ConsultAsset) => {
    onInsert({
      kind: (a.kind ?? "image") as "image" | "video_link",
      image_url: a.image_url,
      link_url: a.link_url,
      title: a.title,
      caption: withCaption ? a.caption : null,
    });
    onClose();
  };

  // spec 026 — 스테이지로 크게 열기(그리며 설명 → 기록에 담기)
  const openStage = async (a: ConsultAsset) => {
    if (!a.image_url || stageBusy) return;
    setStageBusy(true);
    setError("");
    try {
      const res = await fetch(a.image_url);
      const blob = await res.blob();
      setStageFile(new File([blob], "stage.webp", { type: blob.type || "image/webp" }));
    } catch {
      setError("이미지를 열지 못했습니다.");
    } finally {
      setStageBusy(false);
    }
  };

  // spec 028 확장 — 빈 캔버스(백지·모눈·줄노트) → 바로 스테이지
  const openBlankCanvas = (tpl: "blank" | "grid" | "lined") => {
    const W = 1600;
    const H = 1200;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    if (tpl === "grid") {
      for (let x = 0; x <= W; x += 50) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    } else if (tpl === "lined") {
      for (let y = 80; y <= H; y += 70) { ctx.beginPath(); ctx.moveTo(40, y + 0.5); ctx.lineTo(W - 40, y + 0.5); ctx.stroke(); }
    }
    canvas.toBlob((blob) => {
      if (blob) setStageFile(new File([blob], `${tpl}.webp`, { type: blob.type || "image/webp" }));
    }, "image/webp", 0.9);
  };

  // 즉석 업로드 → 기관 Library 등록 + 바로 삽입 (기능 권한 없으면 서버가 거절 메시지)
  const handleQuickUpload = (file: File | null) => {
    if (!file) return;
    setError("");
    startTransition(async () => {
      try {
        const optimized = await compressImageFile(file);
        const fd = new FormData();
        fd.set("file", optimized);
        fd.set("title", uploadTitle.trim() || file.name.replace(/\.[^.]+$/, ""));
        fd.set("category", libFilter !== "all" ? libFilter : "general");
        const r = await createConsultAsset(fd);
        if (!r.ok) {
          setError(r.message);
          return;
        }
        insert(r.asset);
      } catch {
        setError("이미지 처리에 실패했습니다.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose} role="dialog" aria-label="상담 자료 선택">
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">📚 상담 자료</h3>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="검색"
            className="ml-2 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-500" />
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="닫기">✕</button>
        </div>

        {/* 뷰 선택: 기관 카테고리(큐레이션) + 전체 Library */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-2">
          {(data?.categories ?? []).map((c) => (
            <button key={c.id} type="button" onClick={() => setView(c.id)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${view === c.id ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {c.name}
            </button>
          ))}
          <button type="button" onClick={() => setView("library")}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${view === "library" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {hasCategories ? "전체 Library" : "전체"}
          </button>
        </div>

        {/* Library 뷰 보조 필터 */}
        {view === "library" && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2">
            {(["mine", "global"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setLibTab(t)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${libTab === t ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {t === "mine" ? "우리 기관" : "Carelog 제공"}
              </button>
            ))}
            <span className="mx-0.5 h-4 w-px bg-slate-200" />
            {[{ id: "all", label: "전체" }, ...CONSULT_ASSET_CATEGORIES].map((c) => (
              <button key={c.id} type="button" onClick={() => setLibFilter(c.id)}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${libFilter === c.id ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* 빈 캔버스 */}
        {onInsertAnnotated && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
            <span className="text-[11px] font-semibold text-slate-500">🗒 빈 캔버스에 그리기:</span>
            {([{ tpl: "blank", label: "백지" }, { tpl: "grid", label: "모눈" }, { tpl: "lined", label: "줄노트" }] as const).map(({ tpl, label }) => (
              <button key={tpl} type="button" onClick={() => openBlankCanvas(tpl)}
                className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 transition hover:bg-teal-100"
                title={`${label}를 전체화면으로 열어 그리며 설명 — '기록에 담기'로 삽입`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* 본문 */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {data === null ? (
            <p className="py-10 text-center text-sm text-slate-400">불러오는 중…</p>
          ) : visibleAssets.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              {view !== "library" ? (
                <>이 카테고리에 담긴 자료가 없습니다.<br />설정 → 상담 자료에서 Library의 자료를 담아 구성하세요.</>
              ) : (data.mine.length + data.global.length) === 0 ? (
                <>등록된 상담 자료가 없습니다.<br />설정 → 상담 자료에서 미리 등록하거나, 아래에서 바로 올려 쓰세요.</>
              ) : (
                "검색 결과가 없습니다."
              )}
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {visibleAssets.map((a) => (
                <li key={`${view}-${a.id}`}>
                  <button type="button" onClick={() => setPreview(a)}
                    className="relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-sky-400 hover:shadow" title={a.title}>
                    {a.kind === "video_link" || !a.image_url ? (
                      <div className="flex h-20 w-full items-center justify-center bg-slate-800 text-2xl text-white">▶</div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image_url} alt={a.title} loading="lazy" className="h-20 w-full object-cover" />
                    )}
                    <p className="truncate px-2 py-1.5 text-[11px] font-medium text-slate-700">
                      {a.kind === "video_link" ? "▶ " : ""}{a.title}
                    </p>
                    {a.institution_id === null && (
                      <span className="absolute right-1 top-1 rounded bg-violet-500/90 px-1 text-[9px] font-semibold text-white">Carelog</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 푸터: 캡션 옵션 + 즉석 업로드 */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={withCaption} onChange={(e) => setWithCaption(e.target.checked)} className="size-3.5 rounded border-slate-300" />
            설명 문구 함께 삽입
          </label>
          <div className="ml-auto flex items-center gap-2">
            <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="새 자료 제목(선택)"
              className="w-36 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-sky-500" />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={isPending}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50">
              {isPending ? "올리는 중…" : "+ 바로 올려 삽입"}
            </button>
          </div>
          {error && <p className="w-full text-xs text-red-500">{error}</p>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only"
          onChange={(e) => { handleQuickUpload(e.target.files?.[0] ?? null); if (fileRef.current) fileRef.current.value = ""; }} />

        {/* 확대 미리보기 */}
        {preview && (
          <div className="absolute inset-0 z-10 flex flex-col bg-white" role="dialog" aria-label={`${preview.title} 미리보기`}>
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <button type="button" onClick={() => setPreview(null)} className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">← 목록</button>
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{preview.title}</p>
              {preview.institution_id === null && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-600">Carelog 제공</span>
              )}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{categoryLabel(preview.category)}</span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-50 p-4">
              {preview.kind === "video_link" || !preview.image_url ? (
                <div className="space-y-3 text-center">
                  <div className="mx-auto flex h-24 w-40 items-center justify-center rounded-xl bg-slate-800 text-4xl text-white">▶</div>
                  {preview.link_url && (
                    <a href={preview.link_url} target="_blank" rel="noopener noreferrer" className="block break-all text-xs text-sky-600 underline">{preview.link_url}</a>
                  )}
                  <p className="text-[11px] text-slate-400">영상은 링크로 기록에 담겨요 — 환자에게 전달되면 대기실·집에서 볼 수 있어요.</p>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.image_url} alt={preview.title} className="max-h-full max-w-full rounded-lg object-contain" />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-xs text-slate-500">{preview.caption ?? ""}</p>
              <div className="flex shrink-0 gap-2">
                {preview.kind !== "video_link" && preview.image_url && onInsertAnnotated && (
                  <button type="button" onClick={() => openStage(preview)} disabled={stageBusy}
                    className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50"
                    title="전체화면으로 열고 펜/마우스로 그리며 설명 — '기록에 담기'로 그린 스냅샷 삽입">
                    {stageBusy ? "여는 중…" : "🖊 크게 열고 그리기"}
                  </button>
                )}
                <button type="button" onClick={() => insert(preview)}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700">
                  {preview.kind === "video_link" ? "기록에 넣기" : "에디터에 삽입"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* spec 026 스테이지 — 그리며 설명 → 기록에 담기 */}
        {stageFile && (
          <ImageAnnotator
            file={stageFile}
            saveLabel="기록에 담기"
            onClose={() => setStageFile(null)}
            onSave={(f) => {
              setStageFile(null);
              onInsertAnnotated?.(f);
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}
