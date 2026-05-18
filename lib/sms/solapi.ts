import { SolapiMessageService } from "solapi";

function stripBom(s: string) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

export async function sendSms(
  to: string,
  text: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const apiKey = stripBom(process.env.SOLAPI_API_KEY ?? "").trim();
  const apiSecret = stripBom(process.env.SOLAPI_API_SECRET ?? "").trim();
  const from = stripBom(process.env.SOLAPI_SENDER_PHONE ?? "").trim();

  if (!apiKey || !apiSecret || !from) {
    return { ok: false, message: "SMS 발송 환경변수가 설정되지 않았습니다." };
  }

  try {
    const client = new SolapiMessageService(apiKey, apiSecret);
    await client.send({ to, from, text });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMS 발송 실패";
    return { ok: false, message };
  }
}
