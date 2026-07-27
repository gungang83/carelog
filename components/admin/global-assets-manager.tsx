"use client";

import { useRef, useState, useTransition } from "react";
import { SPECIALTIES, specialtyLabel, assetCategoriesFor } from "@/lib/specialties";
import { categoryLabel, type ConsultAsset } from "@/lib/consult-assets";
import {
  createGlobalAsset,
  createGlobalVideoAsset,
  updateGlobalAsset,
  deleteGlobalAsset,
} from "@/app/actions/consult-assets";
import { compressImageFile } from "@/lib/image/optimize";

// spec 029 ① — Carelog 공통(전역) 상담자료 발행/관리 (슈퍼어드민 전용).
export function GlobalAssetsManager({ initialAssets }: { initialAssets: ConsultAsset[] }) {
  const [assets, setAssets] = useState<ConsultAsset[]>(initialAssets);
  const [mode, setMode] = useState<"image" | "video">("image");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [specialty, setSpecialty] = useState<string>(""); // "" = 전 분과 공통
  const [category, setCategory] = useState<string>("general");
  const [caption, setCaption] = useState("");
  const [filterSpec, setFilterSpec] = useState<string>("all");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const categoryOptions = assetCategoriesFor(specialty || null);

  const pickFile = (f: File | null) => {
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleAdd = () => {
    if (!title.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        let r;
        if (mode === "video") {
          if (!/^https?:\/\//i.test(linkUrl.trim())) {
            setError("영상 링크는 http(s):// 로 시작하는 URL이어야 합니다.");
            return;
          }
          r = await createGlobalVideoAsset({
            title: title.trim(),
            link_url: linkUrl.trim(),
            category,
            caption: caption.trim(),
            specialty: specialty || null,
          });
        } else {
          if (!file) {
            setError("이미지를 선택해 주세요.");
            return;
          }
          const optimized = await compressImageFile(file);
          const fd = new FormData();
          fd.set("file", optimized);
          fd.set("title", title.trim());
          fd.set("category", category);
          fd.set("caption", caption.trim());
          fd.set("specialty", specialty);
          r = await createGlobalAsset(fd);
        }
        if (!r.ok) {
          setError(r.message);
          return;
        }
        setAssets((prev) => [r.asset, ...prev]);
        pickFile(null);
        setTitle("");
        setLinkUrl("");
        setCaption("");
        if (fileRef.current) fileRef.current.value = "";
      } catch {
        setError("처리에 실패했습니다. 다시 시도해 주세요.");
      }
    });
  };

  const toggleActive = (a: ConsultAsset) =>
    startTransition(async () => {
      setAssets((prev) => prev.map((x) => (x.id === a.id ? { ...x, active: !a.active } : x)));
      const r = await updateGlobalAsset(a.id, { active: !a.active });
      if (!r.ok) setError(r.message);
    });

  const remove = (a: ConsultAsset) =>
    startTransition(async () => {
      if (!window.confirm("이 공통 자료를 삭제할까요?\n(기관 카테고리에 담긴 참조도 사라집니다. 이미 상담 기록에 삽입된 이미지는 유지)")) return;
      setAssets((prev) => prev.filter((x) => x.id !== a.id));
      const r = await deleteGlobalAsset(a.id);
      if (!r.ok) setError(r.message);
    });

  const filtered = assets.filter(
    (a) => filterSpec === "all" || (filterSpec === "common" ? !a.specialty : a.specialty === filterSpec),
  );

  return (
    <div className="space-y-4">
      {/* 발행 폼 */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">공통 자료 발행</h3>
          <div className="ml-1 flex gap-1">
            {(["image", "video"] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(""); }}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${mode === m ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {m === "image" ? "이미지" : "▶ 영상 링크"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          {mode === "image" ? (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-400 transition hover:border-sky-400 hover:text-sky-600">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="미리보기" className="h-full w-full object-cover" />
              ) : ("이미지 선택")}
            </button>
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-3xl text-white">▶</div>
          )}
          <div className="min-w-[16rem] flex-1 space-y-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500" />
            {mode === "video" && (
              <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="영상 링크 (https://…)"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500" />
            )}
            <div className="flex flex-wrap gap-2">
              <select value={specialty} onChange={(e) => { setSpecialty(e.target.value); setCategory("general"); }}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700" aria-label="분과 타겟">
                <option value="">전 분과 공통</option>
                {SPECIALTIES.map((s) => (<option key={s.id} value={s.id}>{s.label} 전용</option>))}
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700" aria-label="분류">
                {categoryOptions.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
              </select>
              <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="설명 문구(선택)"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-500" />
            </div>
            <button type="button" onClick={handleAdd} disabled={isPending}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50">
              {isPending ? "발행 중…" : "발행"}
            </button>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      {/* 목록 */}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-700">발행된 공통 자료 ({filtered.length})</h3>
        <select value={filterSpec} onChange={(e) => setFilterSpec(e.target.value)}
          className="ml-auto rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600" aria-label="분과 필터">
          <option value="all">전체</option>
          <option value="common">전 분과 공통</option>
          {SPECIALTIES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-400">발행된 자료가 없습니다.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {filtered.map((a) => (
            <li key={a.id} className={`overflow-hidden rounded-xl border bg-white shadow-sm ${a.active ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
              {a.kind === "video_link" || !a.image_url ? (
                <div className="flex h-24 w-full items-center justify-center bg-slate-800 text-2xl text-white">▶</div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.image_url} alt={a.title} loading="lazy" className="h-24 w-full object-cover" />
              )}
              <div className="space-y-1.5 p-2.5">
                <p className="truncate text-xs font-medium text-slate-800" title={a.title}>{a.title}</p>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                    {specialtyLabel(a.specialty ?? null)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {categoryLabel(a.category)}
                  </span>
                  {!a.active && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-600">숨김</span>}
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => toggleActive(a)} disabled={isPending}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    {a.active ? "숨기기" : "노출"}
                  </button>
                  <button type="button" onClick={() => remove(a)} disabled={isPending}
                    className="rounded-lg border border-red-100 px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 disabled:opacity-50">삭제</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
