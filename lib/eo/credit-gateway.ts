/**
 * EO 크레딧-차감 게이트웨이 클라이언트 (헤임달 계약 v1 §2 — 카드 #1099).
 *
 * EO 코어+위성이 단일 크레딧 지갑을 공유할 때, Carelog가 크레딧을 깎는 유일 통로.
 * 인증 = 마스터 게이트웨이와 동일한 서버-서버 시크릿(x-gateway-secret, CARELOG_GATEWAY_SECRET).
 *
 * ★스위치: EO_CREDIT_GATEWAY=on 일 때만 사용(기본 off = 로컬 시뮬레이션 유지).
 *   선행: 테오 EP(#1098) 배포 + 잔액 이관(계약 §7-4) 완료 후 대표/테오가 env로 켠다.
 * ★never-block(계약 §5.5): 이 모듈은 절대 throw 하지 않는다 — 실패는 {ok:false}로
 *   반환하고 호출측(deductCredit)이 로컬 폴백(fail-open, 계약 §6 degraded)한다.
 */

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

const EO_APP_URL = stripBom(process.env.EO_APP_URL ?? "https://eo-ten.vercel.app");

function secret(): string {
  return stripBom(process.env.CARELOG_GATEWAY_SECRET ?? "");
}

/** 크레딧 게이트웨이 사용 여부 — env 스위치 + 시크릿 존재. */
export function creditGatewayEnabled(): boolean {
  return (process.env.EO_CREDIT_GATEWAY ?? "").trim().toLowerCase() === "on" && !!secret();
}

export type GatewayDeductResult =
  | { ok: true; balance: number; deducted: number; duplicate?: boolean; overage?: boolean }
  | { ok: false };

/**
 * 즉시 차감(계약 §2-1). allow_overage=true 고정 — 잔량 부족해도 진료를 막지 않는다.
 * 같은 idempotencyKey 재시도는 EO가 no-op(duplicate:true) 보장 — 내부 1회 재시도.
 */
export async function gatewayDeductCredit(args: {
  institutionId: string;
  feature: string;
  amount: number;
  idempotencyKey: string;
  refId?: string | null;
}): Promise<GatewayDeductResult> {
  if (!creditGatewayEnabled()) return { ok: false };
  const body = JSON.stringify({
    institution_id: args.institutionId,
    product: "carelog",
    feature: args.feature,
    amount: args.amount,
    idempotency_key: args.idempotencyKey,
    ref_id: args.refId ?? null,
    allow_overage: true,
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${EO_APP_URL}/api/gateway/credit/deduct`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-gateway-secret": secret() },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      if (res.status === 200) {
        const d = (await res.json()) as {
          ok: boolean;
          balance?: number;
          deducted?: number;
          duplicate?: boolean;
          overage?: boolean;
        };
        if (d.ok) {
          return {
            ok: true,
            balance: Number(d.balance ?? 0),
            deducted: Number(d.deducted ?? 0),
            duplicate: d.duplicate,
            overage: d.overage,
          };
        }
        return { ok: false };
      }
      // 402(INSUFFICIENT)는 allow_overage=true라 정상 흐름에선 안 옴 — 오면 정책 불일치, fail-open.
      // 401/404/400/5xx — 재시도해도 같은 결과인 4xx는 즉시 중단.
      if (res.status >= 400 && res.status < 500) return { ok: false };
    } catch {
      /* 네트워크/타임아웃 — 같은 멱등키로 1회 재시도(이중차감 없음, 계약 §3) */
    }
  }
  return { ok: false };
}

/** 잔액 조회(계약 §2-3) — 실패 시 null(호출측이 로컬 캐시 폴백). */
export async function gatewayCreditBalance(institutionId: string): Promise<number | null> {
  if (!creditGatewayEnabled()) return null;
  try {
    const res = await fetch(
      `${EO_APP_URL}/api/gateway/credit/balance?institution_id=${encodeURIComponent(institutionId)}`,
      {
        headers: { "x-gateway-secret": secret() },
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      },
    );
    if (res.status !== 200) return null;
    const d = (await res.json()) as { balance?: number };
    return typeof d.balance === "number" ? d.balance : null;
  } catch {
    return null;
  }
}
