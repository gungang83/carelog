"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isSuperAdmin } from "@/lib/admin";
import { getMyAuthorInfo } from "@/lib/auth/institution";
import type { Announcement } from "@/lib/announcements";

// spec 022 공지·업데이트 — 전역 공지 조회(직원, RLS 경유) + 발행/수정(슈퍼어드민, service_role).

const COLS =
  "id, title, body, link, level, active, pinned, starts_at, ends_at, created_by, created_at";

type Ok = { ok: true } | { ok: false; message: string };

/** 활성·노출기간 내 공지(직원용). 고정 우선 → 최신순. RLS가 활성/기간을 이미 거른다. */
export async function getActiveAnnouncements(limit = 30): Promise<Announcement[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("announcements")
      .select(COLS)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as Announcement[];
  } catch {
    return [];
  }
}

// ── 슈퍼어드민 발행/관리 (service_role — RLS 우회, 반드시 이메일 가드) ─────────────

async function requireSuperAdmin(): Promise<
  { ok: true; name: string } | { ok: false; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isSuperAdmin(user.email)) {
    return { ok: false, message: "최고 관리자만 발행할 수 있습니다." };
  }
  const { author_name } = await getMyAuthorInfo();
  return { ok: true, name: author_name ?? user.email ?? "관리자" };
}

/** 전체 공지(비활성 포함) — 관리 화면용. */
export async function listAllAnnouncements(): Promise<Announcement[]> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return [];
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("announcements")
    .select(COLS)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as Announcement[];
}

export async function createAnnouncement(input: {
  title: string;
  body?: string;
  link?: string;
  level?: string;
  pinned?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}): Promise<Ok> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard;
  const title = input.title.trim();
  if (!title) return { ok: false, message: "제목을 입력해 주세요." };
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("announcements").insert({
    title,
    body: input.body?.trim() || null,
    link: input.link?.trim() || null,
    level: input.level || "update",
    pinned: !!input.pinned,
    starts_at: input.starts_at || null,
    ends_at: input.ends_at || null,
    created_by: guard.name,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  return { ok: true };
}

export async function setAnnouncementActive(id: string, active: boolean): Promise<Ok> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("announcements").update({ active }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  return { ok: true };
}

export async function setAnnouncementPinned(id: string, pinned: boolean): Promise<Ok> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("announcements").update({ pinned }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<Ok> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("announcements").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  return { ok: true };
}
