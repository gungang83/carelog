"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitutionId, getMyAuthorInfo, getMyInstitution } from "@/lib/auth/institution";
import { isSuperAdmin } from "@/lib/admin";
import { requireFeature } from "@/lib/auth/feature-gate";
import { FEATURES } from "@/lib/permissions";
import type {
  AssetCategory,
  CategoryWithAssets,
  ConsultAsset,
  PickerData,
} from "@/lib/consult-assets";

// spec 025/026/029 상담자료 —
//   Library 2개(전역=institution_id null·슈퍼어드민 / 기관 업로드) + 기관 카테고리 큐레이션.
//   기관 관리 가드 = 기능 권한(consult_assets.manage: 개인 오버라이드 > 역할 기본값).
//   파일 업로드는 클라 압축(webp) → FormData → service_role 업로드(버킷 public read).

const BUCKET = "consult-assets";
const COLS =
  "id, institution_id, specialty, kind, title, category, image_url, link_url, caption, display_order, active, created_by, created_at";

type Ok = { ok: true } | { ok: false; message: string };

const manageGuard = () => requireFeature(FEATURES.CONSULT_ASSETS_MANAGE);

async function requireSuperAdmin(): Promise<
  { ok: true; name: string } | { ok: false; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isSuperAdmin(user.email)) {
    return { ok: false, message: "최고 관리자만 가능합니다." };
  }
  return { ok: true, name: "Carelog" };
}

/** 내 기관 분과에 맞는 전역 자료 필터(전 분과 공통 포함). */
function matchesSpecialty(a: ConsultAsset, myType: string | null): boolean {
  return !a.specialty || a.specialty === myType;
}

async function uploadAssetFile(
  file: File,
  folder: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, message: "이미지 파일만 등록할 수 있습니다." };
  }
  const admin = createAdminSupabaseClient();
  const ext = file.type === "image/webp" ? "webp" : (file.name.split(".").pop()?.toLowerCase() ?? "png");
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) return { ok: false, message: `업로드 실패: ${error.message}` };
  return { ok: true, url: admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

// ═══════════════ 조회 (직원 공용) ═══════════════

/** 픽커용(레거시 호환): 기관 활성 자료 + 내 분과 전역 자료. */
export async function getConsultAssets(): Promise<ConsultAsset[]> {
  try {
    const institutionId = await getMyInstitutionId();
    if (!institutionId) return [];
    const inst = await getMyInstitution();
    const myType = inst?.institution.type ?? null;
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("consult_assets")
      .select(COLS)
      .or(`institution_id.eq.${institutionId},institution_id.is.null`)
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });
    return ((data ?? []) as ConsultAsset[]).filter((a) => matchesSpecialty(a, myType));
  } catch {
    return [];
  }
}

/** 픽커 데이터 — 기관 카테고리(담긴 자료 포함) + Library(우리 기관/전역, 분과 필터). */
export async function getPickerData(): Promise<PickerData> {
  const empty: PickerData = { categories: [], mine: [], global: [] };
  try {
    const institutionId = await getMyInstitutionId();
    if (!institutionId) return empty;
    const inst = await getMyInstitution();
    const myType = inst?.institution.type ?? null;
    const supabase = await createServerSupabaseClient();

    const [{ data: assets }, { data: cats }, { data: items }] = await Promise.all([
      supabase
        .from("consult_assets")
        .select(COLS)
        .or(`institution_id.eq.${institutionId},institution_id.is.null`)
        .eq("active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("consult_asset_categories")
        .select("id, institution_id, name, display_order, active, created_at")
        .eq("institution_id", institutionId)
        .eq("active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("consult_asset_category_items")
        .select("id, category_id, asset_id, display_order")
        .order("display_order", { ascending: true }),
    ]);

    const all = ((assets ?? []) as ConsultAsset[]).filter((a) => matchesSpecialty(a, myType));
    const byId = new Map(all.map((a) => [a.id, a]));
    const categories: CategoryWithAssets[] = ((cats ?? []) as AssetCategory[]).map((c) => ({
      ...c,
      items: ((items ?? []) as { id: string; category_id: string; asset_id: string }[])
        .filter((i) => i.category_id === c.id)
        .map((i) => ({ itemId: i.id, asset: byId.get(i.asset_id) }))
        .filter((x): x is { itemId: string; asset: ConsultAsset } => !!x.asset),
    }));

    return {
      categories,
      mine: all.filter((a) => a.institution_id === institutionId),
      global: all.filter((a) => a.institution_id === null),
    };
  } catch {
    return empty;
  }
}

// ═══════════════ 기관 Library 관리 (기능 권한) ═══════════════

/** 관리용: 기관 자료 전체(비활성 포함). */
export async function listConsultAssetsForManage(): Promise<ConsultAsset[]> {
  const guard = await manageGuard();
  if (!guard.ok) return [];
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("consult_assets")
    .select(COLS)
    .eq("institution_id", guard.institutionId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });
  return (data ?? []) as ConsultAsset[];
}

export async function createConsultAsset(formData: FormData): Promise<
  { ok: true; asset: ConsultAsset } | { ok: false; message: string }
> {
  const guard = await manageGuard();
  if (!guard.ok) return guard;

  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "general").trim() || "general";
  const caption = String(formData.get("caption") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "이미지 파일이 필요합니다." };
  }
  if (!title) return { ok: false, message: "제목을 입력해 주세요." };

  const up = await uploadAssetFile(file, guard.institutionId);
  if (!up.ok) return up;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("consult_assets")
    .insert({
      institution_id: guard.institutionId,
      title,
      category,
      image_url: up.url,
      caption: caption || null,
      created_by: guard.name,
    })
    .select(COLS)
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "등록에 실패했습니다." };
  revalidatePath("/settings");
  return { ok: true, asset: data as ConsultAsset };
}

export async function createConsultVideoAsset(input: {
  title: string;
  link_url: string;
  category?: string;
  caption?: string;
}): Promise<{ ok: true; asset: ConsultAsset } | { ok: false; message: string }> {
  const guard = await manageGuard();
  if (!guard.ok) return guard;
  const title = input.title.trim();
  const linkUrl = input.link_url.trim();
  if (!title) return { ok: false, message: "제목을 입력해 주세요." };
  if (!/^https?:\/\//i.test(linkUrl)) {
    return { ok: false, message: "영상 링크는 http(s):// 로 시작하는 URL이어야 합니다." };
  }
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("consult_assets")
    .insert({
      institution_id: guard.institutionId,
      kind: "video_link",
      title,
      category: input.category?.trim() || "general",
      link_url: linkUrl,
      caption: input.caption?.trim() || null,
      created_by: guard.name,
    })
    .select(COLS)
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "등록에 실패했습니다." };
  revalidatePath("/settings");
  return { ok: true, asset: data as ConsultAsset };
}

export async function updateConsultAsset(
  id: string,
  patch: { title?: string; category?: string; caption?: string | null; active?: boolean; display_order?: number },
): Promise<Ok> {
  const guard = await manageGuard();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("consult_assets")
    .update(patch)
    .eq("id", id)
    .eq("institution_id", guard.institutionId); // 자기 기관 자산만(전역은 슈퍼어드민 전용)
  if (error) return { ok: false, message: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteConsultAsset(id: string): Promise<Ok> {
  const guard = await manageGuard();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("consult_assets")
    .delete()
    .eq("id", id)
    .eq("institution_id", guard.institutionId);
  if (error) return { ok: false, message: error.message };
  // 스토리지 원본은 보존 — 이미 상담 기록 본문의 이미지 URL이 깨지지 않게(기록 보존 우선).
  revalidatePath("/settings");
  return { ok: true };
}

// ═══════════════ 기관 카테고리 큐레이션 (기능 권한) ═══════════════

/** 관리용: 카테고리(숨김 포함) + 담긴 자료. */
export async function listCategoriesForManage(): Promise<CategoryWithAssets[]> {
  const guard = await manageGuard();
  if (!guard.ok) return [];
  const supabase = await createServerSupabaseClient();
  const inst = await getMyInstitution();
  const myType = inst?.institution.type ?? null;

  const [{ data: cats }, { data: items }, { data: assets }] = await Promise.all([
    supabase
      .from("consult_asset_categories")
      .select("id, institution_id, name, display_order, active, created_at")
      .eq("institution_id", guard.institutionId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("consult_asset_category_items")
      .select("id, category_id, asset_id, display_order")
      .order("display_order", { ascending: true }),
    supabase
      .from("consult_assets")
      .select(COLS)
      .or(`institution_id.eq.${guard.institutionId},institution_id.is.null`)
      .eq("active", true),
  ]);
  const byId = new Map(
    ((assets ?? []) as ConsultAsset[]).filter((a) => matchesSpecialty(a, myType)).map((a) => [a.id, a]),
  );
  return ((cats ?? []) as AssetCategory[]).map((c) => ({
    ...c,
    items: ((items ?? []) as { id: string; category_id: string; asset_id: string }[])
      .filter((i) => i.category_id === c.id)
      .map((i) => ({ itemId: i.id, asset: byId.get(i.asset_id) }))
      .filter((x): x is { itemId: string; asset: ConsultAsset } => !!x.asset),
  }));
}

export async function createAssetCategory(name: string): Promise<
  { ok: true; category: AssetCategory } | { ok: false; message: string }
> {
  const guard = await manageGuard();
  if (!guard.ok) return guard;
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "카테고리 이름을 입력해 주세요." };
  const admin = createAdminSupabaseClient();
  const { count } = await admin
    .from("consult_asset_categories")
    .select("id", { count: "exact", head: true })
    .eq("institution_id", guard.institutionId);
  const { data, error } = await admin
    .from("consult_asset_categories")
    .insert({ institution_id: guard.institutionId, name: trimmed, display_order: count ?? 0 })
    .select("id, institution_id, name, display_order, active, created_at")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "생성에 실패했습니다." };
  revalidatePath("/settings");
  return { ok: true, category: data as AssetCategory };
}

export async function updateAssetCategory(
  id: string,
  patch: { name?: string; display_order?: number; active?: boolean },
): Promise<Ok> {
  const guard = await manageGuard();
  if (!guard.ok) return guard;
  if (patch.name !== undefined && !patch.name.trim()) {
    return { ok: false, message: "카테고리 이름을 입력해 주세요." };
  }
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("consult_asset_categories")
    .update({ ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) })
    .eq("id", id)
    .eq("institution_id", guard.institutionId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteAssetCategory(id: string): Promise<Ok> {
  const guard = await manageGuard();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("consult_asset_categories")
    .delete()
    .eq("id", id)
    .eq("institution_id", guard.institutionId); // items는 cascade — 자료 원본은 무관
  if (error) return { ok: false, message: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

/** 카테고리에 자료 담기(전역 자료 포함, 중복은 무시). */
export async function addAssetsToCategory(categoryId: string, assetIds: string[]): Promise<Ok> {
  const guard = await manageGuard();
  if (!guard.ok) return guard;
  if (assetIds.length === 0) return { ok: false, message: "담을 자료를 선택해 주세요." };
  const admin = createAdminSupabaseClient();
  const { data: cat } = await admin
    .from("consult_asset_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("institution_id", guard.institutionId)
    .maybeSingle();
  if (!cat) return { ok: false, message: "카테고리를 찾을 수 없습니다." };

  const { count } = await admin
    .from("consult_asset_category_items")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);
  let order = count ?? 0;
  const rows = assetIds.map((asset_id) => ({
    category_id: categoryId,
    asset_id,
    display_order: order++,
    added_by: guard.name,
  }));
  const { error } = await admin
    .from("consult_asset_category_items")
    .upsert(rows, { onConflict: "category_id,asset_id", ignoreDuplicates: true });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeCategoryItem(itemId: string): Promise<Ok> {
  const guard = await manageGuard();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();
  // 기관 검증: item → category.institution_id
  const { data: item } = await admin
    .from("consult_asset_category_items")
    .select("id, category_id, consult_asset_categories!inner(institution_id)")
    .eq("id", itemId)
    .maybeSingle();
  const inst = (item as { consult_asset_categories?: { institution_id?: string } } | null)
    ?.consult_asset_categories?.institution_id;
  if (!item || inst !== guard.institutionId) {
    return { ok: false, message: "항목을 찾을 수 없습니다." };
  }
  const { error } = await admin.from("consult_asset_category_items").delete().eq("id", itemId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

/** 카테고리 내 자료 순서 이동(위/아래) — 인접 항목과 display_order 스왑. */
export async function moveCategoryItem(itemId: string, dir: "up" | "down"): Promise<Ok> {
  const guard = await manageGuard();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();
  const { data: item } = await admin
    .from("consult_asset_category_items")
    .select("id, category_id, display_order")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { ok: false, message: "항목을 찾을 수 없습니다." };
  const { data: siblings } = await admin
    .from("consult_asset_category_items")
    .select("id, display_order")
    .eq("category_id", item.category_id)
    .order("display_order", { ascending: true });
  const list = (siblings ?? []) as { id: string; display_order: number }[];
  const idx = list.findIndex((s) => s.id === itemId);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return { ok: true };
  const a = list[idx];
  const b = list[swapIdx];
  await admin.from("consult_asset_category_items").update({ display_order: b.display_order }).eq("id", a.id);
  await admin.from("consult_asset_category_items").update({ display_order: a.display_order }).eq("id", b.id);
  revalidatePath("/settings");
  return { ok: true };
}

// ═══════════════ 전역(Carelog 제공) Library — 슈퍼어드민 ═══════════════

export async function listGlobalAssets(): Promise<ConsultAsset[]> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return [];
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("consult_assets")
    .select(COLS)
    .is("institution_id", null)
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []) as ConsultAsset[];
}

export async function createGlobalAsset(formData: FormData): Promise<
  { ok: true; asset: ConsultAsset } | { ok: false; message: string }
> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard;
  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "general").trim() || "general";
  const caption = String(formData.get("caption") ?? "").trim();
  const specialty = String(formData.get("specialty") ?? "").trim() || null; // "" = 전 분과 공통
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "이미지 파일이 필요합니다." };
  }
  if (!title) return { ok: false, message: "제목을 입력해 주세요." };

  const up = await uploadAssetFile(file, "global");
  if (!up.ok) return up;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("consult_assets")
    .insert({
      institution_id: null,
      specialty,
      title,
      category,
      image_url: up.url,
      caption: caption || null,
      created_by: "Carelog",
    })
    .select(COLS)
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "등록에 실패했습니다." };
  revalidatePath("/admin/assets");
  return { ok: true, asset: data as ConsultAsset };
}

export async function createGlobalVideoAsset(input: {
  title: string;
  link_url: string;
  category?: string;
  caption?: string;
  specialty?: string | null;
}): Promise<{ ok: true; asset: ConsultAsset } | { ok: false; message: string }> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard;
  const title = input.title.trim();
  const linkUrl = input.link_url.trim();
  if (!title) return { ok: false, message: "제목을 입력해 주세요." };
  if (!/^https?:\/\//i.test(linkUrl)) {
    return { ok: false, message: "영상 링크는 http(s):// 로 시작하는 URL이어야 합니다." };
  }
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("consult_assets")
    .insert({
      institution_id: null,
      specialty: input.specialty || null,
      kind: "video_link",
      title,
      category: input.category?.trim() || "general",
      link_url: linkUrl,
      caption: input.caption?.trim() || null,
      created_by: "Carelog",
    })
    .select(COLS)
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "등록에 실패했습니다." };
  revalidatePath("/admin/assets");
  return { ok: true, asset: data as ConsultAsset };
}

export async function updateGlobalAsset(
  id: string,
  patch: { title?: string; category?: string; caption?: string | null; active?: boolean; specialty?: string | null },
): Promise<Ok> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("consult_assets")
    .update(patch)
    .eq("id", id)
    .is("institution_id", null);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/assets");
  return { ok: true };
}

export async function deleteGlobalAsset(id: string): Promise<Ok> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("consult_assets").delete().eq("id", id).is("institution_id", null);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/assets");
  return { ok: true };
}
