import { SolapiMessageService } from "solapi";

function stripBom(s: string) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function env(name: string): string {
  return stripBom(process.env[name] ?? "").trim();
}

function client(): SolapiMessageService | null {
  const apiKey = env("SOLAPI_API_KEY");
  const apiSecret = env("SOLAPI_API_SECRET");
  return apiKey && apiSecret ? new SolapiMessageService(apiKey, apiSecret) : null;
}

/** from = 병원별 발신번호(솔라피에 사전 등록된 번호만 가능). 없으면 기본 발신번호(SOLAPI_SENDER_PHONE). */
export async function sendSms(
  to: string,
  text: string,
  opts?: { from?: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const c = client();
  const from = (opts?.from || env("SOLAPI_SENDER_PHONE")).trim();
  if (!c || !from) {
    return { ok: false, message: "SMS 발송 환경변수가 설정되지 않았습니다." };
  }

  try {
    await c.send({ to, from, text });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMS 발송 실패";
    return { ok: false, message };
  }
}

// ── 카카오 알림톡(spec 038 3단계) ───────────────────────────────────
//   채널(발신프로필) pfId + 카카오 검수 통과 템플릿 id가 환경변수에 있을 때만 쓴다.
//   알림톡이 실패하면 솔라피가 문자로 대체 발송(발신번호 필요). 템플릿 문구는 specs/038 §7.

export type AlimtalkTemplate = "share";

const TEMPLATE_ENV: Record<AlimtalkTemplate, string> = {
  share: "SOLAPI_KAKAO_TPL_SHARE",
};

export function alimtalkReady(template: AlimtalkTemplate): boolean {
  return !!(env("SOLAPI_KAKAO_PFID") && env(TEMPLATE_ENV[template]) && client());
}

export async function sendAlimtalk(
  to: string,
  template: AlimtalkTemplate,
  variables: Record<string, string>,
  opts?: { from?: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const c = client();
  const pfId = env("SOLAPI_KAKAO_PFID");
  const templateId = env(TEMPLATE_ENV[template]);
  if (!c || !pfId || !templateId) return { ok: false, message: "알림톡 설정이 없습니다." };
  const from = (opts?.from || env("SOLAPI_SENDER_PHONE")).trim();
  try {
    await c.send({
      to,
      ...(from ? { from } : {}),
      kakaoOptions: { pfId, templateId, variables, disableSms: !from },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "알림톡 발송 실패" };
  }
}
