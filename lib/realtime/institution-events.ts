import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ChairAuditLogRow } from "@/lib/types/database";

/**
 * 기관 내 실시간 이벤트 구독 (spec 007 — 실시간 알림·소통 기반의 최소 단위).
 *
 * chair_audit_logs INSERT를 institution_id 필터로 구독한다.
 * - 이 테이블엔 진료 본문·환자 식별정보가 없다(체어·작성자·이벤트만) → 전송선에 PII 0 (헌법 I).
 * - 기관 격리는 RLS("staff reads own institution audit logs") + 채널 필터 이중.
 * - 향후 다른 이벤트 타입이 필요하면 이 모듈에 구독 함수를 추가해 확장한다(헌법 IV — 한 곳에).
 */
export type ChairAuditEvent = ChairAuditLogRow;

export function subscribeChairEvents(opts: {
  institutionId: string;
  onEvent: (event: ChairAuditEvent) => void;
  /** 채널이 SUBSCRIBED 상태가 될 때마다 호출(최초·재연결 포함). */
  onSubscribed?: () => void;
}): () => void {
  const supabase = createBrowserSupabaseClient();

  const channel = supabase
    .channel(`institution:${opts.institutionId}:chair-events`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chair_audit_logs",
        filter: `institution_id=eq.${opts.institutionId}`,
      },
      (payload: { new: ChairAuditEvent }) => {
        opts.onEvent(payload.new);
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") opts.onSubscribed?.();
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
