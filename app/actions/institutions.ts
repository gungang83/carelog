"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type {
  InstitutionRow,
  InstitutionInvitationRow,
} from "@/lib/types/database";

export async function getMyInstitution(): Promise<
  | { ok: true; institution: InstitutionRow; role: "owner" | "admin" | "staff" }
  | { ok: false; message: string }
> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, message: "로그인이 필요합니다." };
    }

    const { data, error } = await supabase
      .from("institution_members")
      .select("role, institutions(id, name, type, created_at)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      return { ok: false, message: "기관 정보를 찾을 수 없습니다." };
    }

    return {
      ok: true,
      institution: data.institutions as unknown as InstitutionRow,
      role: data.role as "owner" | "admin" | "staff",
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "기관 조회에 실패했습니다.",
    };
  }
}

export async function inviteStaff(formData: FormData): Promise<
  | { ok: true; mode: "added"; message: string }
  | { ok: true; mode: "invited"; invitation: InstitutionInvitationRow }
  | { ok: false; message: string }
> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "staff").trim() as
    | "staff"
    | "admin";

  if (!email) {
    return { ok: false, message: "이메일을 입력해 주세요." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, message: "로그인이 필요합니다." };
    }

    const { data: memberData } = await supabase
      .from("institution_members")
      .select("role, institution_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      !memberData ||
      (memberData.role !== "owner" && memberData.role !== "admin")
    ) {
      return { ok: false, message: "초대 권한이 없습니다." };
    }

    const institutionId = memberData.institution_id;
    const admin = createAdminSupabaseClient();

    // 이미 가입된 auth 유저인지 확인 (SSO 라우트와 동일한 listUsers 패턴)
    const {
      data: { users },
    } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = users.find((u) => u.email?.toLowerCase() === email);

    // ── 경로 1: 이미 계정 있는 사용자 → 즉시 직원 추가(이메일/수락 단계 없음) ──
    // inviteUserByEmail은 신규 이메일 전용이라 기존 계정엔 실패함 → 멤버십 직접 생성.
    if (existingUser) {
      const { data: existingMember } = await admin
        .from("institution_members")
        .select("id, is_active")
        .eq("user_id", existingUser.id)
        .eq("institution_id", institutionId)
        .maybeSingle();

      if (existingMember) {
        if (existingMember.is_active) {
          return { ok: false, message: "이미 직원으로 등록된 사용자입니다." };
        }
        // 비활성(접근 차단) 상태면 재활성화 + 역할 갱신
        const { error: reErr } = await admin
          .from("institution_members")
          .update({ is_active: true, role })
          .eq("id", existingMember.id);
        if (reErr) {
          return { ok: false, message: `직원 활성화 실패: ${reErr.message}` };
        }
        return { ok: true, mode: "added", message: "기존 직원을 다시 활성화했습니다." };
      }

      const { error: addErr } = await admin.from("institution_members").insert({
        institution_id: institutionId,
        user_id: existingUser.id,
        role,
        invited_by: user.id,
        is_active: true,
      });
      if (addErr) {
        return { ok: false, message: `직원 추가 실패: ${addErr.message}` };
      }
      return { ok: true, mode: "added", message: "직원으로 추가했습니다." };
    }

    // ── 경로 2: 신규 이메일 → 초대 메일 발송(클릭 시 /invite/token 에서 수락) ──
    const { data: existing } = await admin
      .from("institution_invitations")
      .select("id, accepted_at")
      .eq("institution_id", institutionId)
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.accepted_at) {
      return { ok: false, message: "이미 가입된 직원입니다." };
    }

    const { data: invitation, error: invErr } = await admin
      .from("institution_invitations")
      .insert({ institution_id: institutionId, email, role, invited_by: user.id })
      .select()
      .single();

    if (invErr || !invitation) {
      return {
        ok: false,
        message: `초대 생성 실패: ${invErr?.message ?? "알 수 없는 오류"}`,
      };
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const redirectTo = `${siteUrl}/invite/${invitation.token}`;
    const { error: emailErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    if (emailErr) {
      // 메일 실패 시 방금 만든 초대 row 롤백(dangling invitation 방지)
      await admin.from("institution_invitations").delete().eq("id", invitation.id);
      return { ok: false, message: `초대 이메일 발송 실패: ${emailErr.message}` };
    }

    return {
      ok: true,
      mode: "invited",
      invitation: invitation as InstitutionInvitationRow,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "초대에 실패했습니다.",
    };
  }
}

export async function acceptInvitation(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();

  if (!token) {
    redirect("/login?error=invalid_token");
  }

  const supabase = await createServerSupabaseClient();

  const { data: invitation, error: invErr } = await supabase
    .from("institution_invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (invErr || !invitation) {
    redirect("/login?error=invalid_invite");
  }
  if (invitation.accepted_at) {
    redirect("/login?error=already_accepted");
  }
  if (new Date(invitation.expires_at) < new Date()) {
    redirect("/login?error=expired_invite");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?error=no_session`);
  }

  const admin = createAdminSupabaseClient();

  const { error: memberErr } = await admin.from("institution_members").insert({
    institution_id: invitation.institution_id,
    user_id: user.id,
    role: invitation.role,
    invited_by: invitation.invited_by,
  });

  if (memberErr) {
    redirect("/login?error=member_error");
  }

  await admin
    .from("institution_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  redirect("/");
}
