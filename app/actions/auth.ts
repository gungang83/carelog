"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function signUp(formData: FormData): Promise<
  | { ok: true; needsConfirmation: boolean }
  | { ok: false; message: string }
> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const institution_name = String(
    formData.get("institution_name") ?? "",
  ).trim();

  if (!email || !password || !institution_name) {
    return { ok: false, message: "모든 항목을 입력해 주세요." };
  }
  if (password.length < 6) {
    return { ok: false, message: "비밀번호는 6자 이상이어야 합니다." };
  }

  const supabase = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();

  // 같은 이름의 기관 중복 방지(대소문자 무시). auth 유저 생성 전에 막아 orphan 계정 방지.
  const { data: dupInst } = await admin
    .from("institutions")
    .select("id")
    .ilike("name", institution_name)
    .maybeSingle();
  if (dupInst) {
    return {
      ok: false,
      message: "이미 같은 이름의 기관이 등록되어 있습니다. 다른 이름을 사용해 주세요.",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://carelog-tau.vercel.app";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data.user) {
    return { ok: false, message: "회원가입에 실패했습니다." };
  }

  // 기관 + 멤버 생성은 admin 클라이언트로 RLS 우회 (신규 사용자는 institution_members 미보유)
  const { data: inst, error: instErr } = await admin
    .from("institutions")
    .insert({ name: institution_name, type: "dental" })
    .select("id, name, type, created_at")
    .single();

  if (instErr || !inst) {
    return {
      ok: false,
      message: `기관 등록 실패: ${instErr?.message ?? "알 수 없는 오류"}`,
    };
  }

  const { error: memberErr } = await admin.from("institution_members").insert({
    institution_id: inst.id,
    user_id: data.user.id,
    role: "owner",
  });

  if (memberErr) {
    return { ok: false, message: `멤버 등록 실패: ${memberErr.message}` };
  }

  if (data.session) {
    redirect("/");
  }

  return { ok: true, needsConfirmation: true };
}

export async function signIn(formData: FormData): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    return { ok: false, message: "이메일과 비밀번호를 입력해 주세요." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  redirect("/");
}

export async function signOut(_formData?: FormData): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setupInstitution(formData: FormData): Promise<
  { ok: false; message: string }
> {
  const institution_name = String(formData.get("institution_name") ?? "").trim();
  if (!institution_name) {
    return { ok: false, message: "기관명을 입력해 주세요." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) redirect("/login");

  const admin = createAdminSupabaseClient();

  const { data: existing } = await admin
    .from("institution_members")
    .select("id")
    .eq("user_id", user!.id)
    .maybeSingle();

  if (existing) redirect("/");

  // 같은 이름의 기관 중복 방지(대소문자 무시)
  const { data: dupInst } = await admin
    .from("institutions")
    .select("id")
    .ilike("name", institution_name)
    .maybeSingle();
  if (dupInst) {
    return {
      ok: false,
      message: "이미 같은 이름의 기관이 등록되어 있습니다. 다른 이름을 사용해 주세요.",
    };
  }

  const { data: inst, error: instErr } = await admin
    .from("institutions")
    .insert({ name: institution_name, type: "dental" })
    .select("id")
    .single();

  if (instErr || !inst) {
    return { ok: false, message: `기관 등록 실패: ${instErr?.message ?? "알 수 없는 오류"}` };
  }

  const { error: memberErr } = await admin.from("institution_members").insert({
    institution_id: inst.id,
    user_id: user!.id,
    role: "owner",
  });

  if (memberErr) {
    return { ok: false, message: `멤버 등록 실패: ${memberErr.message}` };
  }

  redirect("/");
}
