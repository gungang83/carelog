"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CONSULT_ASSET_CATEGORIES, categoryLabel, type CategoryWithAssets, type ConsultAsset } from "@/lib/consult-assets";
import {
  createConsultAsset,
  createConsultVideoAsset,
  updateConsultAsset,
  deleteConsultAsset,
  createAssetCategory,
  updateAssetCategory,
  deleteAssetCategory,
  addAssetsToCategory,
  removeCategoryItem,
  moveCategoryItem,
  listCategoriesForManage,
  getPickerData,
} from "@/app/actions/consult-assets";
import { compressImageFile } from "@/lib/image/optimize";

// spec 025/029 — /settings "상담 자료": ① 카테고리 큐레이션(그릇에 Library 자료 담기, 2패널)
// ② 우리 기관 Library 관리(업로드·숨김·삭제). 가드는 기능 권한(consult_assets.manage).

function Thumb({ a, className }: { a: ConsultAsset; className: string }) {
  return a.kind === "video_link" || !a.image_url ? (
    <div className={`flex items-center justify-center bg-slate-800 text-white ${className}`}>▶</div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={a.image_url} alt={a.title} loading="lazy" className={`object-cover ${className}`} />
  );
}

export function ConsultAssetsManager({
  initialAssets,
  initialCategories,
}: {
  initialAssets: ConsultAsset[];
  initialCategories: CategoryWithAssets[];
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryWithAssets[]>(initialCategories);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(initialCategories[0]?.id ?? null);
  const [newCatName, setNewCatName] = useState("");
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedCat = categories.find((c) => c.id === selectedCatId) ?? null;

  const refreshCategories = async () => {
    const next = await listCategoriesForManage();
    setCategories(next);
    if (selectedCatId && !next.some((c) => c.id === selectedCatId)) {
      setSelectedCatId(next[0]?.id ?? null);
    }
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    setError("");
    startTransition(async () => {
      const r = await createAssetCategory(newCatName);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setNewCatName("");
      await refreshCategories();
      setSelectedCatId(r.category.id);
    });
  };

  const saveCatName = (id: string) => {
    const name = editCatName.trim();
    setEditCatId(null);
    if (!name) return;
    startTransition(async () => {
      const r = await updateAssetCategory(id, { name });
      if (!r.ok) setError(r.message);
      await refreshCategories();
    });
  };

  const moveCat = (id: string, dir: "up" | "down") => {
    const idx = categories.findIndex((c) => c.id === id);
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= categories.length) return;
    const a = categories[idx];
    const b = categories[swap];
    startTransition(async () => {
      await updateAssetCategory(a.id, { display_order: b.display_order });
      await updateAssetCategory(b.id, { display_order: a.display_order });
      await refreshCategories();
    });
  };

  const toggleCatActive = (c: CategoryWithAssets) =>
    startTransition(async () => {
      const r = await updateAssetCategory(c.id, { active: !c.active });
      if (!r.ok) setError(r.message);
      await refreshCategories();
    });

  const removeCat = (c: CategoryWithAssets) =>
    startTransition(async () => {
      if (!window.confirm(`'${c.name}' 카테고리를 삭제할까요?\n(담긴 목록만 사라지고, 자료 원본은 Library에 남습니다)`)) return;
      const r = await deleteAssetCategory(c.id);
      if (!r.ok) setError(r.message);
      await refreshCategories();
    });

  const removeItem = (itemId: string) =>
    startTransition(async () => {
      const r = await removeCategoryItem(itemId);
      if (!r.ok) setError(r.message);
      await refreshCategories();
    });

  const moveItem = (itemId: string, dir: "up" | "down") =>
    startTransition(async () => {
      await moveCategoryItem(itemId, dir);
      await refreshCategories();
    });

  return (
    <div className="space-y-6">
      {/* ── 큐레이션: 카테고리 구성 (spec 029) ───────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-700">상담 카테고리 구성</p>
        <p className="mb-3 mt-0.5 text-[11px] text-slate-400">
          카테고리를 만들고 Library(우리 기관 + Carelog 제공)에서 쓸 자료를 골라 담으세요 — 상담 중 &apos;📚 자료&apos;에 이 구성이 그대로 보입니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          {/* 좌: 카테고리 목록 */}
          <div className="space-y-1.5">
            {categories.map((c, i) => (
              <div key={c.id}
                className={`flex items-center gap-1 rounded-xl border px-2 py-1.5 ${
                  selectedCatId === c.id ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white"
                } ${c.active ? "" : "opacity-50"}`}>
                {editCatId === c.id ? (
                  <input value={editCatName} autoFocus onChange={(e) => setEditCatName(e.target.value)}
                    onBlur={() => saveCatName(c.id)}
                    onKeyDown={(e) => e.key === "Enter" && saveCatName(c.id)}
                    className="min-w-0 flex-1 rounded border border-sky-300 px-1.5 py-0.5 text-sm outline-none" />
                ) : (
                  <button type="button" onClick={() => setSelectedCatId(c.id)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-700">
                    {c.name} <span className="text-[10px] text-slate-400">({c.items.length})</span>
                  </button>
                )}
                <button type="button" title="이름 변경" onClick={() => { setEditCatId(c.id); setEditCatName(c.name); }}
                  className="px-1 text-xs text-slate-400 hover:text-slate-600">✏️</button>
                <button type="button" title="위로" disabled={i === 0 || isPending} onClick={() => moveCat(c.id, "up")}
                  className="px-0.5 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30">↑</button>
                <button type="button" title="아래로" disabled={i === categories.length - 1 || isPending} onClick={() => moveCat(c.id, "down")}
                  className="px-0.5 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30">↓</button>
                <button type="button" title={c.active ? "픽커에서 숨김" : "노출"} onClick={() => toggleCatActive(c)}
                  className="px-0.5 text-xs text-slate-400 hover:text-slate-600">{c.active ? "🙈" : "👁"}</button>
                <button type="button" title="삭제" onClick={() => removeCat(c)}
                  className="px-0.5 text-xs text-red-300 hover:text-red-500">✕</button>
              </div>
            ))}
            <div className="flex gap-1.5">
              <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
                placeholder="새 카테고리 (예: 임플란트 상담)"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-sky-500" />
              <button type="button" onClick={addCategory} disabled={isPending || !newCatName.trim()}
                className="rounded-xl bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">＋</button>
            </div>
          </div>

          {/* 우: 담긴 자료 */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            {!selectedCat ? (
              <p className="py-8 text-center text-sm text-slate-400">왼쪽에서 카테고리를 만들거나 선택하세요.</p>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">{selectedCat.name}</p>
                  <button type="button" onClick={() => setBrowserOpen(true)}
                    className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700">
                    ＋ 자료 담기
                  </button>
                </div>
                {selectedCat.items.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    아직 담긴 자료가 없어요 — &apos;＋ 자료 담기&apos;로 Library에서 골라 담으세요.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {selectedCat.items.map(({ itemId, asset }, i) => (
                      <li key={itemId} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1.5">
                        <Thumb a={asset} className="h-10 w-14 shrink-0 rounded" />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{asset.title}</span>
                        {asset.institution_id === null && (
                          <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">Carelog</span>
                        )}
                        <button type="button" disabled={i === 0 || isPending} onClick={() => moveItem(itemId, "up")}
                          className="px-0.5 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30">↑</button>
                        <button type="button" disabled={i === selectedCat.items.length - 1 || isPending} onClick={() => moveItem(itemId, "down")}
                          className="px-0.5 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30">↓</button>
                        <button type="button" title="카테고리에서 빼기" onClick={() => removeItem(itemId)}
                          className="px-1 text-xs text-red-300 hover:text-red-500">✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>

      {/* ── 우리 기관 Library 관리 (업로드·숨김·삭제) ─────────────────── */}
      <LibrarySection
        onChanged={() => {
          void refreshCategories();
          router.refresh();
        }}
        initialAssets={initialAssets}
      />

      {/* Library 브라우저 — 담기 */}
      {browserOpen && selectedCat && (
        <LibraryBrowser
          categoryName={selectedCat.name}
          alreadyIds={new Set(selectedCat.items.map((x) => x.asset.id))}
          onClose={() => setBrowserOpen(false)}
          onAdd={(ids) =>
            startTransition(async () => {
              const r = await addAssetsToCategory(selectedCat.id, ids);
              if (!r.ok) setError(r.message);
              setBrowserOpen(false);
              await refreshCategories();
            })
          }
        />
      )}
    </div>
  );
}

// ── Library 브라우저(담기 모달): 탭 우리 기관/Carelog 제공 + 분류·검색 + 체크 담기 ──
function LibraryBrowser({
  categoryName,
  alreadyIds,
  onClose,
  onAdd,
}: {
  categoryName: string;
  alreadyIds: Set<string>;
  onClose: () => void;
  onAdd: (assetIds: string[]) => void;
}) {
  const [tab, setTab] = useState<"mine" | "global">("mine");
  const [data, setData] = useState<{ mine: ConsultAsset[]; global: ConsultAsset[] } | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    getPickerData()
      .then((d) => setData({ mine: d.mine, global: d.global }))
      .catch(() => setData({ mine: [], global: [] }));
  }, []);

  const list = useMemo(() => {
    const src = tab === "mine" ? (data?.mine ?? []) : (data?.global ?? []);
    const q = query.trim().toLowerCase();
    return src.filter(
      (a) => (filter === "all" || a.category === filter) && (!q || a.title.toLowerCase().includes(q)),
    );
  }, [data, tab, filter, query]);

  const toggle = (id: string) =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose} role="dialog" aria-label="Library에서 자료 담기">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">&apos;{categoryName}&apos;에 담기</h3>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="검색"
            className="ml-2 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-500" />
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100" aria-label="닫기">✕</button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2">
          {(["mine", "global"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${tab === t ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {t === "mine" ? "우리 기관" : "Carelog 제공"}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-slate-200" />
          {[{ id: "all", label: "전체" }, ...CONSULT_ASSET_CATEGORIES].map((c) => (
            <button key={c.id} type="button" onClick={() => setFilter(c.id)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${filter === c.id ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {data === null ? (
            <p className="py-10 text-center text-sm text-slate-400">불러오는 중…</p>
          ) : list.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              {tab === "mine" ? "우리 기관 Library가 비어 있어요 — 아래 'Library 관리'에서 업로드하세요." : "해당 자료가 없습니다."}
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {list.map((a) => {
                const inCat = alreadyIds.has(a.id);
                const isChecked = checked.has(a.id);
                return (
                  <li key={a.id}>
                    <button type="button" disabled={inCat} onClick={() => toggle(a.id)}
                      className={`relative block w-full overflow-hidden rounded-xl border text-left shadow-sm transition ${
                        inCat ? "border-emerald-200 opacity-50" : isChecked ? "border-sky-500 ring-2 ring-sky-300" : "border-slate-200 hover:border-sky-400"
                      }`} title={a.title}>
                      <Thumb a={a} className="h-20 w-full" />
                      <p className="truncate px-2 py-1.5 text-[11px] font-medium text-slate-700">{a.title}</p>
                      {inCat && <span className="absolute right-1 top-1 rounded bg-emerald-500 px-1 text-[10px] text-white">담김</span>}
                      {isChecked && <span className="absolute right-1 top-1 rounded bg-sky-600 px-1 text-[10px] text-white">✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button type="button" onClick={() => onAdd([...checked])} disabled={checked.size === 0}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
            {checked.size}개 담기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 우리 기관 Library 관리(업로드·숨김·삭제) — 기존 spec 025/026 기능 유지 ──
function LibrarySection({
  initialAssets,
  onChanged,
}: {
  initialAssets: ConsultAsset[];
  onChanged: () => void;
}) {
  const [assets, setAssets] = useState<ConsultAsset[]>(initialAssets);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"image" | "video">("image");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
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
    setError("");
    startTransition(async () => {
      try {
        let r;
        if (mode === "video") {
          r = await createConsultVideoAsset({ title, link_url: linkUrl, category, caption });
        } else {
          if (!file) {
            setError("이미지를 선택해 주세요.");
            return;
          }
          if (!title.trim()) {
            setError("제목을 입력해 주세요.");
            return;
          }
          const optimized = await compressImageFile(file);
          const fd = new FormData();
          fd.set("file", optimized);
          fd.set("title", title.trim());
          fd.set("category", category);
          fd.set("caption", caption.trim());
          r = await createConsultAsset(fd);
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
        onChanged();
      } catch {
        setError("처리에 실패했습니다. 다시 시도해 주세요.");
      }
    });
  };

  const toggleActive = (a: ConsultAsset) =>
    startTransition(async () => {
      setAssets((prev) => prev.map((x) => (x.id === a.id ? { ...x, active: !a.active } : x)));
      const r = await updateConsultAsset(a.id, { active: !a.active });
      if (!r.ok) setError(r.message);
      onChanged();
    });

  const remove = (a: ConsultAsset) =>
    startTransition(async () => {
      if (!window.confirm("이 자료를 Library에서 삭제할까요?\n(담긴 카테고리에서도 사라지고, 이미 상담 기록에 삽입된 이미지는 그대로 남습니다)")) return;
      setAssets((prev) => prev.filter((x) => x.id !== a.id));
      const r = await deleteConsultAsset(a.id);
      if (!r.ok) setError(r.message);
      onChanged();
    });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50">
        <span className="text-sm font-semibold text-slate-700">우리 기관 Library 관리</span>
        <span className="text-xs text-slate-400">업로드 · 숨김 · 삭제 ({assets.length})</span>
        <span className={`ml-auto text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
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
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-400 transition hover:border-sky-400 hover:text-sky-600">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="미리보기" className="h-full w-full object-cover" />
                ) : ("이미지 선택")}
              </button>
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-2xl text-white">▶</div>
            )}
            <div className="min-w-[14rem] flex-1 space-y-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500" />
              {mode === "video" && (
                <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="영상 링크 (https://…)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500" />
              )}
              <div className="flex gap-2">
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700" aria-label="분류">
                  {CONSULT_ASSET_CATEGORIES.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
                </select>
                <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="설명 문구(선택)"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-500" />
                <button type="button" onClick={handleAdd} disabled={isPending}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50">
                  {isPending ? "등록 중…" : "등록"}
                </button>
              </div>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          {error && <p className="text-xs text-red-500">{error}</p>}

          {assets.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {assets.map((a) => (
                <li key={a.id} className={`overflow-hidden rounded-xl border bg-white shadow-sm ${a.active ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
                  <Thumb a={a} className="h-20 w-full" />
                  <div className="space-y-1 p-2">
                    <p className="truncate text-[11px] font-medium text-slate-800" title={a.title}>{a.title}</p>
                    <div className="flex items-center gap-1">
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{categoryLabel(a.category)}</span>
                      {!a.active && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">숨김</span>}
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => toggleActive(a)} disabled={isPending}
                        className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        {a.active ? "숨기기" : "노출"}
                      </button>
                      <button type="button" onClick={() => remove(a)} disabled={isPending}
                        className="rounded-lg border border-red-100 px-2 py-0.5 text-[10px] font-medium text-red-500 hover:bg-red-50 disabled:opacity-50">삭제</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
