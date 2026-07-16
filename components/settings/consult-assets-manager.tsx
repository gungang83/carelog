"use client";

import { useRef, useState, useTransition } from "react";
import { CONSULT_ASSET_CATEGORIES, categoryLabel, type ConsultAsset } from "@/lib/consult-assets";
import {
  createConsultAsset,
  updateConsultAsset,
  deleteConsultAsset,
} from "@/app/actions/consult-assets";
import { compressImageFile } from "@/lib/image/optimize";

// spec 025 — /settings "상담 자료" 섹션. 라이브러리 업로드·활성 토글·삭제 (owner/admin).
export function ConsultAssetsManager({ initialAssets }: { initialAssets: ConsultAsset[] }) {
  const [assets, setAssets] = useState<ConsultAsset[]>(initialAssets);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null) => {
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleAdd = () => {
    if (!file) {
      setError("이미지를 선택해 주세요.");
      return;
    }
    if (!title.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const optimized = await compressImageFile(file);
        const fd = new FormData();
        fd.set("file", optimized);
        fd.set("title", title.trim());
        fd.set("category", category);
        fd.set("caption", caption.trim());
        const r = await createConsultAsset(fd);
        if (!r.ok) {
          setError(r.message);
          return;
        }
        setAssets((prev) => [r.asset, ...prev]);
        pickFile(null);
        setTitle("");
        setCaption("");
        setCategory("general");
        if (fileRef.current) fileRef.current.value = "";
      } catch {
        setError("이미지 처리에 실패했습니다. 다시 시도해 주세요.");
      }
    });
  };

  const toggleActive = (a: ConsultAsset) =>
    startTransition(async () => {
      setAssets((prev) => prev.map((x) => (x.id === a.id ? { ...x, active: !a.active } : x)));
      const r = await updateConsultAsset(a.id, { active: !a.active });
      if (!r.ok) {
        setAssets((prev) => prev.map((x) => (x.id === a.id ? { ...x, active: a.active } : x)));
        setError(r.message);
      }
    });

  const remove = (a: ConsultAsset) =>
    startTransition(async () => {
      if (
        !window.confirm(
          "이 자료를 라이브러리에서 삭제할까요?\n(이미 상담 기록에 삽입된 이미지는 그대로 남습니다)",
        )
      )
        return;
      setAssets((prev) => prev.filter((x) => x.id !== a.id));
      const r = await deleteConsultAsset(a.id);
      if (!r.ok) setError(r.message);
    });

  return (
    <div className="space-y-4">
      {/* 업로드 폼 */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">새 자료 등록</h3>
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-400 transition hover:border-sky-400 hover:text-sky-600"
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="미리보기" className="h-full w-full object-cover" />
            ) : (
              "이미지 선택"
            )}
          </button>
          <div className="min-w-[14rem] flex-1 space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 (예: 임플란트 시술 단계)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
            <div className="flex gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
              >
                {CONSULT_ASSET_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="설명 문구(선택) — 삽입 시 이미지 아래 함께"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
            >
              {isPending ? "등록 중…" : "등록"}
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <p className="text-[11px] text-slate-400">
          등록한 자료는 상담 편집기의 &apos;📚 자료&apos; 버튼에서 골라 삽입합니다. 업로드 시 자동 압축(webp)됩니다.
        </p>
      </div>

      {/* 목록 */}
      {assets.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400">
          등록된 상담 자료가 없습니다.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {assets.map((a) => (
            <li
              key={a.id}
              className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
                a.active ? "border-slate-200" : "border-slate-100 opacity-60"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.image_url} alt={a.title} loading="lazy" className="h-28 w-full object-cover" />
              <div className="space-y-1.5 p-2.5">
                <p className="truncate text-xs font-medium text-slate-800" title={a.title}>
                  {a.title}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {categoryLabel(a.category)}
                  </span>
                  {!a.active && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                      숨김
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => toggleActive(a)}
                    disabled={isPending}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {a.active ? "숨기기" : "노출"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(a)}
                    disabled={isPending}
                    className="rounded-lg border border-red-100 px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
