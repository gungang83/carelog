"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitutionId, getMyAuthorInfo } from "@/lib/auth/institution";
import type { ConsultAsset } from "@/lib/consult-assets";

// spec 025 상담 이미지 라이브러리 — 조회(멤버, RLS 경유) + 등록/수정/삭제(owner·admin).
// 파일 업로드는 클라이언트에서 압축(webp, spec 017)한 것을 FormData로 받아
// 서버에서 service_role로 스토리지에 올린다(storage 정책 불필요, 버킷 public read).

const BUCKET = "consult-assets";
const COLS =
  "id, institution_id, kind, title, category, image_url, link_url, caption, display_order, active, created_by, created_at";

type Ok = { ok: true } | { ok: false; message: string };

async function requireOwnerAdmin(): Promise<
  { ok: true; institutionId: string; name: string } | { ok: false; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };

  const { data: member } = await supabase
    .from("institution_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("institution_id", institutionId)
    .eq("is_active", true)
    .maybeSingle();
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return { ok: false, message: "기관 대표 또는 관리자만 상담 자료를 관리할 수 있습니다." };
  }
  const { author_name } = await getMyAuthorInfo();
  return { ok: true, institutionId, name: author_name ?? user.email ?? "관리자" };
}

/** 픽커용: 현재 기관의 활성 자료(+활성 전역, 후속). 표시순 → 최신순. */
export async function getConsultAssets(): Promise<ConsultAsset[]> {
  try {
    const institutionId = await getMyInstitutionId();
    if (!institutionId) return [];
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("consult_assets")
      .select(COLS)
      .or(`institution_id.eq.${institutionId},institution_id.is.null`)
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });
    return (data ?? []) as ConsultAsset[];
  } catch {
    return [];
  }
}

/** 관리용: 현재 기관 자료 전체(비활성 포함). owner/admin. */
export async function listConsultAssetsForManage(): Promise<ConsultAsset[]> {
  const guard = await requireOwnerAdmin();
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

/** 등록: 압축된 이미지 파일(FormData "file") + 메타. 성공 시 생성된 자산 반환(픽커 즉시 삽입용). */
export async function createConsultAsset(formData: FormData): Promise<
  { ok: true; asset: ConsultAsset } | { ok: false; message: string }
> {
  const guard = await requireOwnerAdmin();
  if (!guard.ok) return guard;

  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "general").trim() || "general";
  const caption = String(formData.get("caption") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "이미지 파일이 필요합니다." };
  }
  if (!title) return { ok: false, message: "제목을 입력해 주세요." };
  if (!file.type.startsWith("image/")) {
    return { ok: false, message: "이미지 파일만 등록할 수 있습니다." };
  }

  const admin = createAdminSupabaseClient();
  const ext = file.type === "image/webp" ? "webp" : (file.name.split(".").pop()?.toLowerCase() ?? "png");
  const path = `${guard.institutionId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) return { ok: false, message: `업로드 실패: ${upErr.message}` };

  const imageUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { data, error } = await admin
    .from("consult_assets")
    .insert({
      institution_id: guard.institutionId,
      title,
      category,
      image_url: imageUrl,
      caption: caption || null,
      created_by: guard.name,
    })
    .select(COLS)
    .single();
  if (error || !data) {
    return { ok: false, message: error?.message ?? "등록에 실패했습니다." };
  }

  revalidatePath("/settings");
  return { ok: true, asset: data as ConsultAsset };
}

/** 영상 링크 자산 등록(spec 026) — 파일 없음, 외부 URL만. */
export async function createConsultVideoAsset(input: {
  title: string;
  link_url: string;
  category?: string;
  caption?: string;
}): Promise<{ ok: true; asset: ConsultAsset } | { ok: false; message: string }> {
  const guard = await requireOwnerAdmin();
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
  const guard = await requireOwnerAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("consult_assets")
    .update(patch)
    .eq("id", id)
    .eq("institution_id", guard.institutionId); // 자기 기관 자산만(전역은 서버액션으로 못 건드림)
  if (error) return { ok: false, message: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteConsultAsset(id: string): Promise<Ok> {
  const guard = await requireOwnerAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();

  const { error } = await admin
    .from("consult_assets")
    .delete()
    .eq("id", id)
    .eq("institution_id", guard.institutionId);
  if (error) return { ok: false, message: error.message };

  // 스토리지 원본은 남긴다 — 이미 상담 기록 본문에 삽입된 이미지가 같은 URL을 참조하므로
  // 지우면 과거 기록이 깨진다(기록 보존 우선). 라이브러리 목록에서만 사라짐.

  revalidatePath("/settings");
  return { ok: true };
}
