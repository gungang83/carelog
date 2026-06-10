"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isSuperAdmin } from "@/lib/admin";
import { ACTIVE_INSTITUTION_COOKIE } from "@/lib/auth/institution";

// ── US1: 기관 전환 ────────────────────────────────────────────

export async function switchInstitution(institutionId: string): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const { data: member } = await supabase
    .from("institution_members")
    .select("institution_id, is_active")
    .eq("user_id", user.id)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!member || !member.is_active) {
    return { ok: false, message: "해당 기관에 대한 접근 권한이 없습니다." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_INSTITUTION_COOKIE, institutionId, {
    httpOnly: true,
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
    sameSite: "lax",
  });

  return { ok: true };
}

// ── US2: 직원 목록 조회 ──────────────────────────────────────

export type StaffMemberView = {
  id: string;
  user_id: string;
  email: string;
  role: "owner" | "admin" | "staff";
  is_active: boolean;
  joined_at: string;
};

export async function getStaffList(): Promise<
  { ok: true; members: StaffMemberView[] } | { ok: false; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const { data: myMember } = await supabase
    .from("institution_members")
    .select("institution_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!myMember || (myMember.role !== "owner" && myMember.role !== "admin")) {
    return { ok: false, message: "관리자 권한이 필요합니다." };
  }

  const admin = createAdminSupabaseClient();
  const { data: members, error } = await admin
    .from("institution_members")
    .select("id, user_id, role, is_active, joined_at")
    .eq("institution_id", myMember.institution_id)
    .order("joined_at", { ascending: true });

  if (error || !members) {
    return { ok: false, message: "직원 목록 조회에 실패했습니다." };
  }

  const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map(usersData?.users.map((u) => [u.id, u.email ?? ""]));

  const staffList: StaffMemberView[] = members.map((m) => ({
    id: m.id,
    user_id: m.user_id,
    email: emailMap.get(m.user_id) ?? "(이메일 없음)",
    role: m.role as "owner" | "admin" | "staff",
    is_active: m.is_active,
    joined_at: m.joined_at,
  }));

  return { ok: true, members: staffList };
}

// ── US2: 직원 권한 활성/비활성 ────────────────────────────────

export async function setStaffActive(
  memberId: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const { data: myMember } = await supabase
    .from("institution_members")
    .select("institution_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!myMember || (myMember.role !== "owner" && myMember.role !== "admin")) {
    return { ok: false, message: "관리자 권한이 필요합니다." };
  }

  const admin = createAdminSupabaseClient();
  const { data: target } = await admin
    .from("institution_members")
    .select("id, user_id, role, institution_id")
    .eq("id", memberId)
    .eq("institution_id", myMember.institution_id)
    .maybeSingle();

  if (!target) return { ok: false, message: "해당 직원을 찾을 수 없습니다." };

  // 자기 자신 비활성화 차단
  if (target.user_id === user.id && !isActive) {
    return { ok: false, message: "자기 자신의 접근 권한을 비활성화할 수 없습니다." };
  }

  // 슈퍼 어드민 계정 변경 차단
  const { data: targetUserData } = await admin.auth.admin.getUserById(target.user_id);
  if (isSuperAdmin(targetUserData?.user?.email) && !isActive) {
    return { ok: false, message: "최고 관리자 계정의 권한은 변경할 수 없습니다." };
  }

  // 기관 마지막 활성 owner 비활성화 차단
  if (target.role === "owner" && !isActive) {
    const { count } = await admin
      .from("institution_members")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", myMember.institution_id)
      .eq("role", "owner")
      .eq("is_active", true);

    if ((count ?? 0) <= 1) {
      return { ok: false, message: "기관의 마지막 관리자는 비활성화할 수 없습니다." };
    }
  }

  const { error } = await admin
    .from("institution_members")
    .update({ is_active: isActive })
    .eq("id", memberId);

  if (error) return { ok: false, message: "권한 변경에 실패했습니다." };

  revalidatePath("/settings");
  return { ok: true };
}

// ── US2: 직원 역할 변경 (staff ↔ admin) ──────────────────────

export async function changeStaffRole(
  memberId: string,
  newRole: "staff" | "admin",
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (newRole !== "staff" && newRole !== "admin") {
    return { ok: false, message: "지원하지 않는 역할입니다." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const { data: myMember } = await supabase
    .from("institution_members")
    .select("institution_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!myMember || (myMember.role !== "owner" && myMember.role !== "admin")) {
    return { ok: false, message: "관리자 권한이 필요합니다." };
  }

  const admin = createAdminSupabaseClient();
  const { data: target } = await admin
    .from("institution_members")
    .select("id, user_id, role, institution_id")
    .eq("id", memberId)
    .eq("institution_id", myMember.institution_id)
    .maybeSingle();

  if (!target) return { ok: false, message: "해당 직원을 찾을 수 없습니다." };
  if (target.user_id === user.id) {
    return { ok: false, message: "자기 자신의 역할은 변경할 수 없습니다." };
  }
  if (target.role === "owner") {
    return { ok: false, message: "대표의 역할은 변경할 수 없습니다." };
  }

  const { error } = await admin
    .from("institution_members")
    .update({ role: newRole })
    .eq("id", memberId);

  if (error) return { ok: false, message: "역할 변경에 실패했습니다." };

  revalidatePath("/settings");
  return { ok: true };
}

// ── US2: 직원 완전 제거 (멤버십 삭제) ────────────────────────

export async function removeStaff(
  memberId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const { data: myMember } = await supabase
    .from("institution_members")
    .select("institution_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!myMember || (myMember.role !== "owner" && myMember.role !== "admin")) {
    return { ok: false, message: "관리자 권한이 필요합니다." };
  }

  const admin = createAdminSupabaseClient();
  const { data: target } = await admin
    .from("institution_members")
    .select("id, user_id, role, institution_id")
    .eq("id", memberId)
    .eq("institution_id", myMember.institution_id)
    .maybeSingle();

  if (!target) return { ok: false, message: "해당 직원을 찾을 수 없습니다." };
  if (target.user_id === user.id) {
    return { ok: false, message: "자기 자신은 제거할 수 없습니다." };
  }
  if (target.role === "owner") {
    return { ok: false, message: "기관 대표는 제거할 수 없습니다." };
  }

  // 슈퍼 어드민 계정 제거 차단
  const { data: targetUserData } = await admin.auth.admin.getUserById(target.user_id);
  if (isSuperAdmin(targetUserData?.user?.email)) {
    return { ok: false, message: "최고 관리자 계정은 제거할 수 없습니다." };
  }

  // 멤버십만 삭제(접근 권한 회수). auth 계정·작성한 기록은 user_id로 보존되며, 재초대 가능.
  const { error } = await admin
    .from("institution_members")
    .delete()
    .eq("id", memberId);

  if (error) return { ok: false, message: "직원 제거에 실패했습니다." };

  revalidatePath("/settings");
  return { ok: true };
}

// ── US3: 슈퍼 어드민 — 전체 기관 조회 ───────────────────────

export type AdminInstitutionView = {
  id: string;
  name: string;
  type: string;
  created_at: string;
  member_count: number;
  active_member_count: number;
};

export async function getAllInstitutions(): Promise<
  { ok: true; institutions: AdminInstitutionView[] } | { ok: false; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isSuperAdmin(user?.email)) {
    return { ok: false, message: "접근 권한이 없습니다." };
  }

  const admin = createAdminSupabaseClient();
  const { data: institutions, error } = await admin
    .from("institutions")
    .select("id, name, type, created_at")
    .order("created_at", { ascending: false });

  if (error || !institutions) {
    return { ok: false, message: "기관 목록 조회에 실패했습니다." };
  }

  const { data: members } = await admin
    .from("institution_members")
    .select("institution_id, is_active");

  const membersByInst = new Map<string, { total: number; active: number }>();
  for (const m of members ?? []) {
    const cur = membersByInst.get(m.institution_id) ?? { total: 0, active: 0 };
    cur.total += 1;
    if (m.is_active) cur.active += 1;
    membersByInst.set(m.institution_id, cur);
  }

  const result: AdminInstitutionView[] = institutions.map((inst) => {
    const counts = membersByInst.get(inst.id) ?? { total: 0, active: 0 };
    return {
      id: inst.id,
      name: inst.name,
      type: inst.type,
      created_at: inst.created_at,
      member_count: counts.total,
      active_member_count: counts.active,
    };
  });

  return { ok: true, institutions: result };
}

// ── US3: 슈퍼 어드민 — 기관별 직원 조회 ─────────────────────

export async function getInstitutionStaff(institutionId: string): Promise<
  { ok: true; members: StaffMemberView[] } | { ok: false; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isSuperAdmin(user?.email)) {
    return { ok: false, message: "접근 권한이 없습니다." };
  }

  const admin = createAdminSupabaseClient();
  const { data: members, error } = await admin
    .from("institution_members")
    .select("id, user_id, role, is_active, joined_at")
    .eq("institution_id", institutionId)
    .order("joined_at", { ascending: true });

  if (error || !members) {
    return { ok: false, message: "직원 목록 조회에 실패했습니다." };
  }

  const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map(usersData?.users.map((u) => [u.id, u.email ?? ""]));

  return {
    ok: true,
    members: members.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      email: emailMap.get(m.user_id) ?? "(이메일 없음)",
      role: m.role as "owner" | "admin" | "staff",
      is_active: m.is_active,
      joined_at: m.joined_at,
    })),
  };
}

export async function setStaffActiveAsAdmin(
  memberId: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isSuperAdmin(user?.email)) {
    return { ok: false, message: "접근 권한이 없습니다." };
  }

  const admin = createAdminSupabaseClient();
  const { data: target } = await admin
    .from("institution_members")
    .select("id, user_id, role, institution_id")
    .eq("id", memberId)
    .maybeSingle();

  if (!target) return { ok: false, message: "해당 직원을 찾을 수 없습니다." };

  const { data: targetUserData } = await admin.auth.admin.getUserById(target.user_id);
  if (isSuperAdmin(targetUserData?.user?.email) && !isActive) {
    return { ok: false, message: "최고 관리자 계정의 권한은 변경할 수 없습니다." };
  }

  if (target.role === "owner" && !isActive) {
    const { count } = await admin
      .from("institution_members")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", target.institution_id)
      .eq("role", "owner")
      .eq("is_active", true);

    if ((count ?? 0) <= 1) {
      return { ok: false, message: "기관의 마지막 관리자는 비활성화할 수 없습니다." };
    }
  }

  const { error } = await admin
    .from("institution_members")
    .update({ is_active: isActive })
    .eq("id", memberId);

  if (error) return { ok: false, message: "권한 변경에 실패했습니다." };

  revalidatePath("/admin");
  return { ok: true };
}

// ── US4: 기관명 수정 ─────────────────────────────────────────

export async function updateInstitutionName(name: string): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "기관명을 입력해 주세요." };

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const { data: myMember } = await supabase
    .from("institution_members")
    .select("institution_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!myMember || myMember.role !== "owner") {
    return { ok: false, message: "기관 대표만 기관 정보를 수정할 수 있습니다." };
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("institutions")
    .update({ name: trimmed })
    .eq("id", myMember.institution_id);

  if (error) return { ok: false, message: "기관명 수정에 실패했습니다." };

  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}
