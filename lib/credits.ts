// spec 013 — 크레딧(시뮬레이션) 횡단 인프라. AI 유료기능 사용량 과금/관측.
//   실결제 아님(별도 빌링 후속). 지금은 슈퍼어드민 부여(가짜 충전) + 차감 로그 + 통계.
//   ★차단 안 함: 잔액 부족해도 전사를 막지 않는다(임상 안정성). deductCredit은 절대 throw하지 않는다.
// spec 031(카드 #1099) — EO 크레딧 게이트웨이 수렴: EO_CREDIT_GATEWAY=on 이면 차감을
//   EO 단일 원장으로 보낸다(로컬 차감 중단·잔액은 표시 캐시로 강등). 게이트웨이 실패 시
//   로컬 폴백(fail-open, memo 마커로 식별 — 이관 정산 시 대조). 기본 off = 현행 유지.
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  creditGatewayEnabled,
  gatewayDeductCredit,
  gatewayCreditBalance,
} from "@/lib/eo/credit-gateway";

// 기능별 단가(크레딧). AI 전사 엔진(lib/transcribe/engines.ts) 및 부가 호출에 대응.
export const CREDIT_PRICES = {
  transcribe_basic: 2, // 기본모델(전사 + 요약)
  transcribe_quick: 1, // 빠른 메모(전사만)
  transcribe_detailed: 3, // 상세 요약(구조화)
  transcribe_dental: 3, // 용어 보정(치과 용어 교정 + 요약)
  transcribe_multilingual: 3, // 다국어(감지 + 번역 + 요약)
  transcribe_comparison: 5, // 비교(basic + multilingual 동시)
  transcribe_chunk_segment: 1, // 청크 구간 1개 전사
  summarize_chunk: 2, // 청크 전체 요약 1회
  interpret_realtime: 1, // 실시간 통역 1분 (spec 030 — units=경과 분으로 정산)
} as const;
export type CreditFeature = keyof typeof CREDIT_PRICES;

export const FEATURE_LABEL: Record<string, string> = {
  transcribe_basic: "기본모델 전사·요약",
  transcribe_quick: "빠른 메모",
  transcribe_detailed: "상세 요약",
  transcribe_dental: "용어 보정",
  transcribe_multilingual: "다국어 통역",
  transcribe_comparison: "엔진 비교",
  transcribe_chunk_segment: "긴 상담 구간 전사",
  summarize_chunk: "긴 상담 요약",
  interpret_realtime: "실시간 통역(분당)",
  grant: "크레딧 충전",
};
export function featureLabel(feature: string): string {
  return FEATURE_LABEL[feature] ?? feature;
}

export async function getCreditBalance(institutionId: string): Promise<number> {
  try {
    // 게이트웨이 모드: EO 단일 원장이 정본 — 실패 시 로컬 캐시 폴백(degraded).
    if (creditGatewayEnabled()) {
      const remote = await gatewayCreditBalance(institutionId);
      if (remote !== null) return remote;
    }
    const admin = createAdminSupabaseClient();
    const { data } = await admin
      .from("institution_credits")
      .select("balance")
      .eq("institution_id", institutionId)
      .maybeSingle();
    return Number(data?.balance ?? 0);
  } catch {
    return 0;
  }
}

/**
 * 사용량 차감 기록. ★비차단·비throw — 전사 hot path에서 호출되므로
 * 어떤 실패도 상담 흐름을 막지 않는다(잔액 음수 허용, 관측/과금 목적).
 * tokensIn/Out: Claude 응답 usage 실토큰(있으면 기록, 없으면 0).
 * units: 단가 × 수량 정산(spec 030 실시간 통역 = 경과 분). 기본 1.
 */
export async function deductCredit(
  institutionId: string,
  feature: CreditFeature,
  byEmail: string,
  opts?: { refId?: string | null; memo?: string; tokensIn?: number; tokensOut?: number; units?: number },
): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();
    const price = CREDIT_PRICES[feature] * Math.max(1, Math.round(opts?.units ?? 1));

    // ── 게이트웨이 모드(spec 031) — EO 단일 원장으로 차감, 로컬 차감 중단(이중기록 0) ──
    let degraded = false;
    if (creditGatewayEnabled()) {
      const r = await gatewayDeductCredit({
        institutionId,
        feature,
        amount: price,
        idempotencyKey: crypto.randomUUID(),
        refId: opts?.refId ?? null,
      });
      if (r.ok) {
        // 로컬 잔액은 표시 캐시로만 동기화(원장 기록 없음 — 정본은 EO).
        await admin
          .from("institution_credits")
          .upsert(
            { institution_id: institutionId, balance: r.balance, updated_at: new Date().toISOString() },
            { onConflict: "institution_id" },
          );
        return;
      }
      degraded = true; // fail-open — 아래 로컬 차감으로 유예(마커), 이관 정산 시 대조
    }

    await admin.rpc("deduct_credit", {
      p_institution_id: institutionId,
      p_amount: price,
      p_feature: feature,
      p_ref_id: opts?.refId ?? null,
      p_by: byEmail,
      p_memo: degraded ? `[gateway-degraded] ${opts?.memo ?? ""}`.trim() : (opts?.memo ?? null),
      p_tokens_in: Math.max(0, Math.round(opts?.tokensIn ?? 0)),
      p_tokens_out: Math.max(0, Math.round(opts?.tokensOut ?? 0)),
    });
  } catch {
    /* 통계/과금 실패는 무시(노이즈 방지) — 상담 데이터·전사 흐름 불변 */
  }
}

/** 충전(시뮬레이션 — 슈퍼어드민 부여). 충전 후 잔액 반환. */
export async function grantCredit(
  institutionId: string,
  amount: number,
  byEmail: string,
  memo?: string,
): Promise<number> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("grant_credit", {
    p_institution_id: institutionId,
    p_amount: amount,
    p_by: byEmail,
    p_memo: memo ?? null,
  });
  if (error) throw new Error(`크레딧 충전 실패: ${error.message}`);
  return Number(data ?? 0);
}
