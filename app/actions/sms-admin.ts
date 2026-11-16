"use server";

// 슈퍼어드민 — 케어로그 기본 발신번호(병원 번호를 고르지 않은 워크스페이스가 쓰는 번호) 바꾸기.
//   솔라피에 등록(활성)된 번호 중에서 고르고, 테스트 문자가 나가면 저장(platform_settings 'sms_default_sender').
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { platformSettingsReady, getPlatformSetting, setPlatformSetting } from "@/lib/platform-settings";
import { activeSenderNumbers, envSenderPhone, sendSms } from "@/lib/sms/solapi";

type Fail = { ok: false; message: string };

async function requireSuper(): Promise<{ ok: true; email: string } | Fail> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isSuperAdmin(user.email)) return { ok: false, message: "최고 관리자만 쓸 수 있습니다." };
  return { ok: true, email: user.email };
}

export type SmsAdminData = {
  tableReady: boolean;
  /** 지금 기본 번호와 출처 */
  current: string;
  source: "setting" | "env" | "none";
  envPhone: string;
  /** 솔라피에 등록(활성)된 발신번호 — 조회 실패면 null */
  active: string[] | null;
  updatedBy: string | null;
};

const digits = (s: string) => s.replace(/\D/g, "");

export async function getSmsAdminData(): Promise<{ ok: true; data: SmsAdminData } | Fail> {
  const g = await requireSuper();
  if (!g.ok) return g;
  const [tableReady, setting, active] = await Promise.all([
    platformSettingsReady(),
    getPlatformSetting<{ phone?: string; by?: string }>("sms_default_sender", true),
    activeSenderNumbers(),
  ]);
  const envPhone = envSenderPhone();
  const set = digits(String(setting?.phone ?? ""));
  return {
    ok: true,
    data: {
      tableReady,
      current: set.length >= 8 ? set : envPhone,
      source: set.length >= 8 ? "setting" : envPhone ? "env" : "none",
      envPhone,
      active,
      updatedBy: setting?.by ?? null,
    },
  };
}

/** 기본 번호 바꾸기 — 등록된 번호인지 확인 → 테스트 문자 → 저장 */
export async function setDefaultSender(input: { phone: string; testTo: string }): Promise<{ ok: true } | Fail> {
  const g = await requireSuper();
  if (!g.ok) return g;
  const phone = digits(input.phone);
  const testTo = digits(input.testTo);
  if (phone.length < 8) return { ok: false, message: "번호를 확인해 주세요." };
  if (!/^01\d{8,9}$/.test(testTo)) return { ok: false, message: "테스트 문자를 받을 휴대폰 번호를 넣어 주세요." };
  const active = await activeSenderNumbers();
  if (active && !active.includes(phone)) return { ok: false, message: "솔라피에 등록(활성)되지 않은 번호예요. 솔라피 콘솔에서 먼저 발신번호로 등록해 주세요." };
  const sent = await sendSms(testTo, "[케어로그] 기본 발신번호 확인 문자입니다. 이제 케어로그 기본 문자가 이 번호로 나갑니다.", { from: phone });
  if (!sent.ok) return { ok: false, message: `테스트 문자를 보내지 못했어요: ${sent.message}` };
  try {
    await setPlatformSetting("sms_default_sender", { phone, by: g.email }, g.email);
  } catch (e) {
    return { ok: false, message: `테스트 문자는 나갔지만 저장하지 못했어요: ${e instanceof Error ? e.message : ""}` };
  }
  return { ok: true };
}

/** 화면 설정을 지우고 환경변수 번호로 되돌리기 */
export async function resetDefaultSender(): Promise<{ ok: true } | Fail> {
  const g = await requireSuper();
  if (!g.ok) return g;
  try {
    await setPlatformSetting("sms_default_sender", null, g.email);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "실패" };
  }
}
