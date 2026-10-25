// spec 038 — 환자 문자 링크 공용: 짧은 링크 토큰 · 링크 주소 · 병원별 문자 발신번호.
//   링크만으로는 열리지 않고(등록 번호 인증번호 필요) 30일 뒤 만료되므로 10자리(62진수, 약 59비트)로 충분하다.
import { randomBytes } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminSupabaseClient>;

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function newShortToken(len = 10): string {
  const bytes = randomBytes(len * 2);
  let out = "";
  for (let i = 0; out.length < len && i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 248) out += ALPHABET[b % 62]; // 248 = 62×4 — 치우침 없이
  }
  return out.length === len ? out : newShortToken(len);
}

export function patientLinkUrl(token: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://carelog-tau.vercel.app").replace(/\/$/, "");
  return `${site}/p/${token}`;
}

/** 짧은 토큰으로 초대 행 만들기(겹치면 다시) */
export async function insertInvitation(
  admin: Admin,
  row: Record<string, unknown>,
): Promise<{ ok: true; token: string; id: string } | { ok: false; message: string }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const token = newShortToken();
    const { data, error } = await admin
      .from("patient_invitations")
      .insert({ ...row, token })
      .select("id, token")
      .single();
    if (data) return { ok: true, token: data.token as string, id: data.id as string };
    if (error?.code !== "23505") return { ok: false, message: error?.message ?? "링크 생성 실패" };
  }
  return { ok: false, message: "링크 생성 실패(중복)" };
}

/** 병원별 문자 발신번호(솔라피에 등록된 번호) — 없으면 null(기본 발신번호 사용) */
export async function institutionSmsSender(admin: Admin, institutionId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("institutions")
    .select("sms_sender_phone")
    .eq("id", institutionId)
    .maybeSingle();
  if (error || !data) return null;
  const v = String((data as { sms_sender_phone?: string | null }).sms_sender_phone ?? "").replace(/\D/g, "");
  return v.length >= 8 ? v : null;
}

/** "10월 25일" (한국 시간) */
export function koreanMonthDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }).format(d);
}
