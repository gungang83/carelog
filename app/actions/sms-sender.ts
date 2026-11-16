"use server";

// 워크스페이스(병원)별 문자 발신번호 — 설정 화면에서 번호를 넣고 테스트 문자를 받아 확인하면 그 번호로 보낸다.
//   발신번호 사전등록제: 솔라피에 등록(인증)된 번호만 발신 가능 → 테스트 문자 성공 = 등록 확인.
//   비우면 기본 발신번호(env SOLAPI_SENDER_PHONE).
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitutionId } from "@/lib/auth/institution";
import { sendSms } from "@/lib/sms/solapi";

export type SmsSenderState = { phone: string; verifiedAt: string | null; columnsReady: boolean };

const digits = (s: string) => s.replace(/\D/g, "");

async function adminGate(): Promise<{ ok: true; institutionId: string } | { ok: false; message: string }> {
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
    return { ok: false, message: "기관 대표 또는 관리자만 설정할 수 있습니다." };
  }
  return { ok: true, institutionId };
}

export async function getSmsSender(): Promise<SmsSenderState> {
  const g = await adminGate();
  if (!g.ok) return { phone: "", verifiedAt: null, columnsReady: false };
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("institutions")
    .select("sms_sender_phone, sms_sender_verified_at")
    .eq("id", g.institutionId)
    .maybeSingle();
  if (error) return { phone: "", verifiedAt: null, columnsReady: false }; // SQL 실행 전
  const row = (data ?? {}) as { sms_sender_phone?: string | null; sms_sender_verified_at?: string | null };
  return { phone: row.sms_sender_phone ?? "", verifiedAt: row.sms_sender_verified_at ?? null, columnsReady: true };
}

/** 번호로 테스트 문자를 보내 보고, 나가면 그 번호를 이 병원 발신번호로 저장 */
export async function verifySmsSender(input: {
  phone: string;
  testTo: string;
}): Promise<{ ok: true; state: SmsSenderState } | { ok: false; message: string; unregistered?: boolean }> {
  const g = await adminGate();
  if (!g.ok) return g;
  const phone = digits(input.phone);
  const testTo = digits(input.testTo);
  if (phone.length < 8) return { ok: false, message: "발신번호를 확인해 주세요." };
  if (!/^01\d{8,9}$/.test(testTo)) return { ok: false, message: "테스트 문자를 받을 휴대폰 번호를 넣어 주세요." };

  const admin = createAdminSupabaseClient();
  const { data: inst } = await admin.from("institutions").select("name").eq("id", g.institutionId).maybeSingle();
  const name = (inst as { name?: string } | null)?.name ?? "우리 병원";
  const sent = await sendSms(testTo, `[케어로그] ${name} 발신번호 확인 문자입니다. 이제 환자 문자가 이 번호로 나갑니다.`, { from: phone });
  if (!sent.ok) {
    // 솔라피는 등록되지 않은 발신번호를 거절한다(발신번호 사전등록제)
    const unregistered = /발신|sender|from|등록/i.test(sent.message);
    return { ok: false, message: sent.message, unregistered };
  }
  const now = new Date().toISOString();
  const { error } = await admin
    .from("institutions")
    .update({ sms_sender_phone: phone, sms_sender_verified_at: now })
    .eq("id", g.institutionId);
  if (error) return { ok: false, message: `테스트 문자는 나갔지만 저장하지 못했어요: ${error.message}` };
  return { ok: true, state: { phone, verifiedAt: now, columnsReady: true } };
}

/** 병원 발신번호를 지우고 기본 발신번호로 */
export async function clearSmsSender(): Promise<{ ok: true } | { ok: false; message: string }> {
  const g = await adminGate();
  if (!g.ok) return g;
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("institutions")
    .update({ sms_sender_phone: null, sms_sender_verified_at: null })
    .eq("id", g.institutionId);
  return error ? { ok: false, message: error.message } : { ok: true };
}
