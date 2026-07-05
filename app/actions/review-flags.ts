"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyInstitutionId, getMyAuthorInfo } from "@/lib/auth/institution";
import type { ReviewFlag } from "@/lib/review-flags";

// spec 021 확인 꼬리표 — 추가/완료/삭제/조회. 세션(RLS 멤버십) 경유.

type Ok = { ok: true } | { ok: false; message: string };

/** 상담 목록의 열린/전체 꼬리표를 consultation_id별로 반환. */
export async function getReviewFlagsFor(
  consultationIds: (string | number)[],
): Promise<Record<string, ReviewFlag[]>> {
  const map: Record<string, ReviewFlag[]> = {};
  if (consultationIds.length === 0) return map;
  try {
    const institutionId = await getMyInstitutionId();
    if (!institutionId) return map;
    const supabase = await createServerSupabaseClient();
    const ids = [...new Set(consultationIds.map((v) => Number(v)))].filter((n) => Number.isFinite(n));
    const { data } = await supabase
      .from("consultation_review_flags")
      .select("id, consultation_id, type, note, status, created_by, created_at, resolved_by, resolved_at")
      .eq("institution_id", institutionId)
      .in("consultation_id", ids)
      .order("created_at", { ascending: true });
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const cid = String(r.consultation_id);
      (map[cid] ??= []).push({
        id: r.id as string,
        consultation_id: cid,
        type: r.type as string,
        note: (r.note as string | null) ?? null,
        status: (r.status as "open" | "resolved") ?? "open",
        created_by: (r.created_by as string | null) ?? null,
        created_at: r.created_at as string,
        resolved_by: (r.resolved_by as string | null) ?? null,
        resolved_at: (r.resolved_at as string | null) ?? null,
      });
    }
  } catch {
    /* 조회 실패는 빈 맵(카드 표시 유지) */
  }
  return map;
}

export async function addReviewFlag(
  consultationId: string | number,
  type: string,
  note?: string,
): Promise<Ok> {
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };
  const { author_name } = await getMyAuthorInfo();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("consultation_review_flags").insert({
    institution_id: institutionId,
    consultation_id: Number(consultationId),
    type,
    note: note?.trim() || null,
    created_by: author_name,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function resolveReviewFlag(flagId: string): Promise<Ok> {
  const { author_name } = await getMyAuthorInfo();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("consultation_review_flags")
    .update({ status: "resolved", resolved_by: author_name, resolved_at: new Date().toISOString() })
    .eq("id", flagId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteReviewFlag(flagId: string): Promise<Ok> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("consultation_review_flags").delete().eq("id", flagId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
