// spec 035 — 기공지 전송기(세션 무관). 서버 액션(즉시 전송)과 cron 재전송 큐가 공용.
// never-throw: 결과는 lab_orders 행 상태로 남는다(queued 재시도 / sent / failed 영구).

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { gatewaySubmitLabOrder } from "@/lib/eo/lab-gateway";
import type { LabAttachmentMeta } from "@/lib/lab-orders";

export const labBucket = "lab-orders";
const SIGNED_URL_TTL = 24 * 60 * 60; // 24h — EO가 수신 즉시 pull 복사(카드 #1957 합의: 저장=복사, 전달=참조)
const MAX_ATTEMPTS = 20; // 게이트웨이 미발효 기간을 버티는 여유(10분 cron × 20 ≈ 3시간+). 초과 시 failed.

export type SendOutcome = { status: "sent" | "queued" | "failed"; error?: string };

export async function sendLabOrderById(orderId: string): Promise<SendOutcome> {
  const admin = createAdminSupabaseClient();
  const now = () => new Date().toISOString();
  try {
    const { data: order } = await admin
      .from("lab_orders")
      .select("id, institution_id, payload, status, attempts")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return { status: "failed", error: "의뢰를 찾을 수 없습니다." };
    if (order.status === "sent") return { status: "sent" }; // 멱등 — 이미 전송됨

    const payload = (order.payload ?? {}) as Record<string, unknown>;

    // 첨부: 보관된 path → 전송 시점에 단기 서명 URL 생성(EO가 pull해 자기 스토리지에 복사)
    const metas = (payload.attachments ?? []) as LabAttachmentMeta[];
    const attachments: { kind: string; name: string; bytes: number; url: string }[] = [];
    for (const a of metas) {
      const { data: signed, error } = await admin.storage
        .from(labBucket)
        .createSignedUrl(a.path, SIGNED_URL_TTL);
      if (error || !signed?.signedUrl) {
        const msg = `첨부 서명 URL 생성 실패: ${a.name}`;
        await admin
          .from("lab_orders")
          .update({ attempts: (order.attempts ?? 0) + 1, error: msg, updated_at: now() })
          .eq("id", orderId);
        return { status: "queued", error: msg };
      }
      attachments.push({ kind: a.kind, name: a.name, bytes: a.bytes, url: signed.signedUrl });
    }

    const result = await gatewaySubmitLabOrder({ ...payload, attachments });

    if (result.ok) {
      await admin
        .from("lab_orders")
        .update({
          status: "sent",
          eo_order_id: result.eo_order_id,
          portal_status: result.portal_status ?? null,
          error: null,
          sent_at: now(),
          updated_at: now(),
        })
        .eq("id", orderId);
      return { status: "sent" };
    }

    const attempts = (order.attempts ?? 0) + 1;
    const terminal = !result.retryable || attempts >= MAX_ATTEMPTS;
    await admin
      .from("lab_orders")
      .update({
        status: terminal ? "failed" : "queued",
        attempts,
        error: result.error,
        updated_at: now(),
      })
      .eq("id", orderId);
    return { status: terminal ? "failed" : "queued", error: result.error };
  } catch (e) {
    return { status: "queued", error: e instanceof Error ? e.message : "unknown" };
  }
}
