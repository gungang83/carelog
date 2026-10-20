// spec 035 — 기공지 전송기(세션 무관). 서버 액션(즉시 전송)과 cron 재전송 큐가 공용.
// never-throw: 결과는 lab_orders 행 상태로 남는다(queued 재시도 / sent / failed 영구).

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { gatewaySubmitLabOrder } from "@/lib/eo/lab-gateway";
import type { LabAttachmentMeta } from "@/lib/lab-orders";

export const labBucket = "lab-orders";
// 계약 ⓒ(헤임달): 만료 ≤15분. 발급은 큐 적재가 아니라 ★전송 직전(이 함수 안)이므로 15분이면 충분하고,
// pull 실패 시 URL 재사용 없이 재전송마다 새로 발급된다. URL은 큐·로그·행 어디에도 저장하지 않는다.
const SIGNED_URL_TTL = 15 * 60;
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
    // ★전송 페이로드 키는 signed_url(EO 구현 정본 main@d0620a58) — URL은 이 요청에만 쓰고 버린다.
    const metas = (payload.attachments ?? []) as LabAttachmentMeta[];
    const attachments: { kind: string; name: string; bytes: number; signed_url: string }[] = [];
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
      // EO가 받는 kind는 photo|video|drawing(정본) — Carelog 내부 'sketch'(손그림)는 wire에서 drawing으로
      const wireKind = a.kind === "sketch" ? "drawing" : a.kind;
      attachments.push({ kind: wireKind, name: a.name, bytes: a.bytes, signed_url: signed.signedUrl });
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
