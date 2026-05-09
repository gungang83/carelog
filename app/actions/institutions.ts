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
  | { ok: true; invitation: InstitutionInvitationRow }
  | { ok: false; message: string }
> {
  const email = String(formData.get("email") ?? "").trim();
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

    const { data: existing } = await supabase
      .from("institution_invitations")
      .select("accepted_at")
      .eq("institution_id", institutionId)
      .eq("email", email)
      .maybeSingle();

    if (existing?.accepted_at) {
      return { ok: false, message: "이미 가입된 직원입니다." };
    }

    const admin = createAdminSupabaseClient();

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
      return { ok: false, message: `초대 이메일 발송 실패: ${emailErr.message}` };
    }

    return { ok: true, invitation: invitation as InstitutionInvitationRow };
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
