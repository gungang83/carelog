"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isSuperAdmin } from "@/lib/admin";
import { getMyAuthorInfo } from "@/lib/auth/institution";
import {
  UPDATE_FEED,
  type UpdateFeedDecision,
  type UpdateFeedItem,
} from "@/lib/update-feed";

// spec 023 업데이트 피드 — 슈퍼어드민 전용. 피드(레포 코드) + 결정 상태(DB) 병합 조회,
// 선택 엔트리 → 공지 발행, 보류/결정 취소. 모두 service_role 경유 + isSuperAdmin 가드.

type Ok = { ok: true } | { ok: false; message: string };

async function requireSuperAdmin(): Promise<
  { ok: true; name: string } | { ok: false; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isSuperAdmin(user.email)) {
    return { ok: false, message: "최고 관리자만 사용할 수 있습니다." };
  }
  const { author_name } = await getMyAuthorInfo();
  return { ok: true, name: author_name ?? user.email ?? "관리자" };
}

/** 피드 전체(최신 우선) + 결정 상태. 테이블 미생성이어도 피드는 뜬다(결정만 비움). */
export async function getUpdateFeed(): Promise<UpdateFeedItem[]> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return [];

  let decisions = new Map<string, UpdateFeedDecision>();
  try {
    const admin = createAdminSupabaseClient();
    const { data } = await admin
      .from("update_feed_decisions")
      .select("entry_id, status, announcement_id, decided_at");
    decisions = new Map(
      ((data ?? []) as UpdateFeedDecision[]).map((d) => [d.entry_id, d]),
    );
  } catch {
    // 테이블 없음 등 — 결정 없음으로 진행
  }

  return [...UPDATE_FEED]
    .reverse()
    .map((e) => ({ ...e, decision: decisions.get(e.id) ?? null }));
}

/** 선택 엔트리로 공지 발행: announcements insert + 엔트리들을 published로 기록. */
export async function publishUpdateAnnouncement(input: {
  entryIds: string[];
  title: string;
  body?: string;
  level?: string;
  pinned?: boolean;
}): Promise<Ok> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard;

  const entryIds = input.entryIds.filter((id) =>
    UPDATE_FEED.some((e) => e.id === id),
  );
  if (entryIds.length === 0)
    return { ok: false, message: "발행할 업데이트 항목을 선택해 주세요." };
  const title = input.title.trim();
  if (!title) return { ok: false, message: "제목을 입력해 주세요." };

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("announcements")
    .insert({
      title,
      body: input.body?.trim() || null,
      level: input.level || "update",
      pinned: !!input.pinned,
      created_by: guard.name,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  const announcementId = (data as { id: string }).id;
  const { error: decisionError } = await admin.from("update_feed_decisions").upsert(
    entryIds.map((entry_id) => ({
      entry_id,
      status: "published",
      announcement_id: announcementId,
      decided_at: new Date().toISOString(),
    })),
  );
  if (decisionError) {
    // 공지는 이미 발행됨 — 상태 기록만 실패(테이블 미생성 등). 발행 자체는 성공으로 안내.
    return {
      ok: false,
      message: `공지는 발행됐지만 피드 상태 기록에 실패했습니다: ${decisionError.message}`,
    };
  }

  revalidatePath("/");
  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  revalidatePath("/admin/updates");
  return { ok: true };
}

/** 선택 엔트리 보류(공지로 올리지 않음 / 이미 안내됨). */
export async function dismissUpdateEntries(entryIds: string[]): Promise<Ok> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard;
  const ids = entryIds.filter((id) => UPDATE_FEED.some((e) => e.id === id));
  if (ids.length === 0) return { ok: false, message: "항목을 선택해 주세요." };

  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("update_feed_decisions").upsert(
    ids.map((entry_id) => ({
      entry_id,
      status: "dismissed",
      announcement_id: null,
      decided_at: new Date().toISOString(),
    })),
  );
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/updates");
  return { ok: true };
}

/** 결정 취소 → 다시 '대기'로. */
export async function clearUpdateDecision(entryId: string): Promise<Ok> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("update_feed_decisions")
    .delete()
    .eq("entry_id", entryId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/updates");
  return { ok: true };
}
