/**
 * EO 마스터 → Carelog 로컬 캐시(clinic_members) 동기화 (계약 §1).
 *
 * 동기화 규칙:
 *  - EO 응답 members[]를 eo_employee_id 키로 upsert(source='eo').
 *  - 응답에 없는 EO-source 행은 is_active=false(EO에서 삭제됨 → 비활성).
 *  - source='manual' 행은 절대 건드리지 않는다(수동 추가분 보호).
 *  - active:false(퇴사) / is_draft:true(미승인)는 비활성으로 둔다(이력 보존).
 *
 * RLS 우회가 필요하므로 admin(service role) 클라이언트로 동작한다.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { fetchEoMaster, type EoMasterMember } from "@/lib/eo/gateway";

export type SyncEoMasterResult =
  | {
      ok: true;
      inserted: number;
      updated: number;
      deactivated: number;
      memberCount: number;
    }
  | { ok: false; reason: string; message?: string };

type ExistingRow = {
  id: string;
  eo_employee_id: string | null;
  is_active: boolean;
};

/** EO 멤버 1건을 clinic_members 컬럼으로 매핑. */
function toCacheRow(institutionId: string, m: EoMasterMember, syncedAt: string) {
  return {
    institution_id: institutionId,
    eo_employee_id: m.id,
    name: m.name,
    email: m.email,
    eo_role: m.eo_role,
    position: m.position,
    // 참여자 선택 UI의 기존 role 표기는 직책(position)을 우선 노출.
    role: m.position ?? m.job_category ?? null,
    source: "eo" as const,
    // 퇴사(active:false)·미승인(is_draft:true)은 노출 보류(비활성).
    is_active: m.active && !m.is_draft,
    synced_at: syncedAt,
  };
}

/**
 * 한 기관의 EO 마스터를 받아 clinic_members 캐시를 갱신한다.
 * EO 미연동(404)이면 ok:false reason:'not_linked'로 조용히 스킵 가능.
 */
export async function syncEoMaster(
  institutionId: string,
): Promise<SyncEoMasterResult> {
  const fetched = await fetchEoMaster(institutionId);
  if (!fetched.ok) {
    return { ok: false, reason: fetched.reason };
  }

  const { members, synced_at } = fetched.data;
  const admin = createAdminSupabaseClient();

  // 현재 EO-source 캐시 상태(upsert/비활성 판정용)
  const { data: existingRows, error: selErr } = await admin
    .from("clinic_members")
    .select("id, eo_employee_id, is_active")
    .eq("institution_id", institutionId)
    .eq("source", "eo");

  if (selErr) {
    return { ok: false, reason: "db_error", message: selErr.message };
  }

  const existingByEoId = new Map<string, ExistingRow>();
  for (const row of (existingRows ?? []) as ExistingRow[]) {
    if (row.eo_employee_id) existingByEoId.set(row.eo_employee_id, row);
  }

  let inserted = 0;
  let updated = 0;
  const seenEoIds = new Set<string>();

  for (const m of members) {
    seenEoIds.add(m.id);
    const row = toCacheRow(institutionId, m, synced_at);
    const existing = existingByEoId.get(m.id);

    if (existing) {
      const { error } = await admin
        .from("clinic_members")
        .update(row)
        .eq("id", existing.id);
      if (error) return { ok: false, reason: "db_error", message: error.message };
      updated += 1;
    } else {
      const { error } = await admin.from("clinic_members").insert(row);
      if (error) return { ok: false, reason: "db_error", message: error.message };
      inserted += 1;
    }
  }

  // 응답에 없는 EO-source 활성 행 → 비활성(EO에서 삭제됨). manual 행은 위 쿼리에서 제외됨.
  let deactivated = 0;
  const toDeactivate = ((existingRows ?? []) as ExistingRow[]).filter(
    (r) => r.eo_employee_id && r.is_active && !seenEoIds.has(r.eo_employee_id),
  );
  if (toDeactivate.length > 0) {
    const { error } = await admin
      .from("clinic_members")
      .update({ is_active: false, synced_at })
      .in(
        "id",
        toDeactivate.map((r) => r.id),
      );
    if (error) return { ok: false, reason: "db_error", message: error.message };
    deactivated = toDeactivate.length;
  }

  return {
    ok: true,
    inserted,
    updated,
    deactivated,
    memberCount: members.length,
  };
}
