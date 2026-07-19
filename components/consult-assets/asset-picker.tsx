"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CONSULT_ASSET_CATEGORIES, categoryLabel, type ConsultAsset } from "@/lib/consult-assets";
import { getConsultAssets, createConsultAsset } from "@/app/actions/consult-assets";
import { compressImageFile } from "@/lib/image/optimize";
import { ImageAnnotator } from "@/components/image-annotator";

export type AssetInsertPayload = {
  kind: "image" | "video_link";
  image_url: string | null;
  link_url: string | null;
  title: string;
  caption: string | null;
};

// spec 025 — 상담 에디터 자료 픽커. 카테고리 필터 + 검색 + 확대 미리보기 + 삽입.
// 즉석 업로드(라이브러리 등록과 동시에 삽입)도 지원 — 상담 중 찍은 사진을 바로.
// spec 026 — 스테이지: "크게 열고 그리기" → 그린 스냅샷을 기록에 담기. 영상 링크 자산 삽입.
export function AssetPicker({
  onInsert,
  onInsertAnnotated,
  onClose,
}: {
  onInsert: (asset: AssetInsertPayload) => void;
  /** 스테이지에서 그린 스냅샷 파일을 업로드·삽입(에디터가 처리) */
  onInsertAnnotated?: (file: File) => void;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<ConsultAsset[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<ConsultAsset | null>(null);
  const [withCaption, setWithCaption] = useState(true);
  const [uploadTitle, setUploadTitle] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getConsultAssets().then(setAssets).catch(() => setAssets([]));
  }, []);

  const filtered = useMemo(() => {
    const list = assets ?? [];
    const q = query.trim().toLowerCase();
    return list.filter(
      (a) =>
        (filter === "all" || a.category === filter) &&
        (!q || a.title.toLowerCase().includes(q) || (a.caption ?? "").toLowerCase().includes(q)),
    );
  }, [assets, filter, query]);

  const [stageFile, setStageFile] = useState<File | null>(null);
  const [stageBusy, setStageBusy] = useState(false);

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

  // 즉석 업로드 → 라이브러리 등록 + 바로 삽입
  const handleQuickUpload = (file: File | null) => {
    if (!file) return;
    setError("");
    startTransition(async () => {
      try {
        const optimized = await compressImageFile(file);
        const fd = new FormData();
        fd.set("file", optimized);
        fd.set("title", uploadTitle.trim() || file.name.replace(/\.[^.]+$/, ""));
        fd.set("category", filter === "all" ? "general" : filter);
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
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-label="상담 자료 선택"
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">📚 상담 자료</h3>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색"
            className="ml-2 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 카테고리 칩 */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-2">
          {[{ id: "all", label: "전체" }, ...CONSULT_ASSET_CATEGORIES].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                filter === c.id
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* 본문 */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {assets === null ? (
            <p className="py-10 text-center text-sm text-slate-400">불러오는 중…</p>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              {assets.length === 0 ? (
                <>
                  등록된 상담 자료가 없습니다.
                  <br />
                  설정 → 상담 자료에서 미리 등록하거나, 아래에서 바로 올려 쓰세요.
                </>
              ) : (
                "검색 결과가 없습니다."
              )}
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {filtered.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setPreview(a)}
                    className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-sky-400 hover:shadow"
                    title={a.title}
                  >
                    {a.kind === "video_link" || !a.image_url ? (
                      <div className="flex h-20 w-full items-center justify-center bg-slate-800 text-2xl text-white">
                        ▶
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image_url} alt={a.title} loading="lazy" className="h-20 w-full object-cover" />
                    )}
                    <p className="truncate px-2 py-1.5 text-[11px] font-medium text-slate-700">
                      {a.kind === "video_link" ? "▶ " : ""}
                      {a.title}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 푸터: 캡션 옵션 + 즉석 업로드 */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={withCaption}
              onChange={(e) => setWithCaption(e.target.checked)}
              className="size-3.5 rounded border-slate-300"
            />
            설명 문구 함께 삽입
          </label>
          <div className="ml-auto flex items-center gap-2">
            <input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="새 자료 제목(선택)"
              className="w-36 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isPending}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
            >
              {isPending ? "올리는 중…" : "+ 바로 올려 삽입"}
            </button>
          </div>
          {error && <p className="w-full text-xs text-red-500">{error}</p>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            handleQuickUpload(e.target.files?.[0] ?? null);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />

        {/* 확대 미리보기 */}
        {preview && (
          <div
            className="absolute inset-0 z-10 flex flex-col bg-white"
            role="dialog"
            aria-label={`${preview.title} 미리보기`}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                ← 목록
              </button>
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{preview.title}</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                {categoryLabel(preview.category)}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-50 p-4">
              {preview.kind === "video_link" || !preview.image_url ? (
                <div className="space-y-3 text-center">
                  <div className="mx-auto flex h-24 w-40 items-center justify-center rounded-xl bg-slate-800 text-4xl text-white">
                    ▶
                  </div>
                  {preview.link_url && (
                    <a
                      href={preview.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all text-xs text-sky-600 underline"
                    >
                      {preview.link_url}
                    </a>
                  )}
                  <p className="text-[11px] text-slate-400">
                    영상은 링크로 기록에 담겨요 — 환자에게 전달되면 대기실·집에서 볼 수 있어요.
                  </p>
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
                  <button
                    type="button"
                    onClick={() => openStage(preview)}
                    disabled={stageBusy}
                    className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50"
                    title="전체화면으로 열고 펜/마우스로 그리며 설명 — '기록에 담기'로 그린 스냅샷 삽입"
                  >
                    {stageBusy ? "여는 중…" : "🖊 크게 열고 그리기"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => insert(preview)}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
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
