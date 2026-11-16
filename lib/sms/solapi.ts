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

/** 기본 발신번호(env SOLAPI_SENDER_PHONE, 숫자만) — 병원 번호를 고르지 않은 워크스페이스가 쓰는 번호 */
export function defaultSenderPhone(): string {
  return env("SOLAPI_SENDER_PHONE").replace(/\D/g, "");
}

/** 솔라피 REST 인증 헤더(HMAC-SHA256 — SDK와 같은 방식) */
async function authHeader(): Promise<string | null> {
  const apiKey = env("SOLAPI_API_KEY");
  const apiSecret = env("SOLAPI_API_SECRET");
  if (!apiKey || !apiSecret) return null;
  const { createHmac, randomBytes } = await import("node:crypto");
  const date = new Date().toISOString();
  const salt = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

/**
 * 솔라피에 등록·활성(ACTIVE)된 발신번호 목록(숫자만). 조회 실패면 null.
 *   GET /senderid/v1/numbers/active — 응답 모양이 바뀌어도 phoneNumber·숫자 문자열을 모아 읽는다.
 */
export async function activeSenderNumbers(): Promise<string[] | null> {
  const auth = await authHeader();
  if (!auth) return null;
  try {
    const r = await fetch("https://api.solapi.com/senderid/v1/numbers/active", { headers: { Authorization: auth }, cache: "no-store" });
    if (!r.ok) return null;
    const out = new Set<string>();
    const walk = (v: unknown, depth: number) => {
      if (depth > 4 || v == null) return;
      if (typeof v === "string") {
        const d = v.replace(/\D/g, "");
        if (d.length >= 8 && d.length <= 12 && /^0|^1[5-9]/.test(d)) out.add(d);
      } else if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1));
      else if (typeof v === "object") {
        const o = v as Record<string, unknown>;
        if (typeof o.phoneNumber === "string") out.add(o.phoneNumber.replace(/\D/g, ""));
        else Object.values(o).forEach((x) => walk(x, depth + 1));
      }
    };
    walk(await r.json(), 0);
    return [...out];
  } catch {
    return null;
  }
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
