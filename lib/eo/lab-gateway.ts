// spec 035 — EO 기공 게이트웨이 클라이언트 (EO spec-138 계약 §2-1·§2-2 · 카드 #1957/#1959).
// 크레딧 게이트웨이(spec 031)와 같은 패턴: 서버-서버 시크릿(x-gateway-secret), never-throw.
// ★EO측 EP는 테오가 병행 구축 중(#1959) — 미발효 동안 fetchLabs는 null, 전송은 큐에 보관됐다가
//   cron 재전송이 발효 시점에 자동으로 흘려보낸다(fail-safe).

import type { EoLab } from "@/lib/lab-orders";

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

const EO_APP_URL = stripBom(process.env.EO_APP_URL ?? "https://eo-ten.vercel.app");

function secret(): string {
  return stripBom(process.env.CARELOG_GATEWAY_SECRET ?? "");
}

/** 기공 게이트웨이 사용 여부 — env 스위치(EO_LAB_GATEWAY=on) + 시크릿 존재. */
export function labGatewayEnabled(): boolean {
  return (process.env.EO_LAB_GATEWAY ?? "").trim().toLowerCase() === "on" && !!secret();
}

/** §2-1 기공소 목록(읽기) — EO 거래처가 정본. 실패·미발효 = null(호출측 폴백). */
export async function gatewayFetchLabs(institutionId: string): Promise<EoLab[] | null> {
  if (!labGatewayEnabled()) return null;
  try {
    const res = await fetch(
      `${EO_APP_URL}/api/gateway/dental-labs?institution_id=${encodeURIComponent(institutionId)}`,
      {
        headers: { "x-gateway-secret": secret() },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (res.status !== 200) return null;
    const data = (await res.json()) as { labs?: EoLab[] } | EoLab[];
    const labs = Array.isArray(data) ? data : (data.labs ?? []);
    return labs.filter((l) => l && typeof l.lab_name === "string");
  } catch {
    return null;
  }
}

export type GatewaySubmitResult =
  | { ok: true; eo_order_id: string; portal_status?: string }
  | { ok: false; retryable: boolean; error: string };

/**
 * §2-2 의뢰 생성(단방향·멱등) — carelog_order_id가 멱등 키라 재전송 안전(내부 1회 재시도).
 * EO 실제 구현(main@d0620a58) 정본: 성공 = 201(신규)·200(멱등 중복, idempotent:true),
 * 실패 = { error: "사람이 읽는 사유" } (계약 ⓓ). 설정 미비·첨부 pull 실패는 재시도 대상.
 */
export async function gatewaySubmitLabOrder(
  payload: Record<string, unknown>,
): Promise<GatewaySubmitResult> {
  if (!labGatewayEnabled()) {
    return { ok: false, retryable: true, error: "게이트웨이 미발효(EO_LAB_GATEWAY off) — 발효 시 자동 전송" };
  }
  const body = JSON.stringify(payload);
  let lastError = "unknown";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${EO_APP_URL}/api/gateway/dental-lab/orders`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-gateway-secret": secret() },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(40000), // EO가 첨부를 pull(건당 30s 상한)한 뒤 응답 — 넉넉히
      });
      if (res.ok) {
        // 201 = 신규 · 200 = 멱등 중복(idempotent:true) — 둘 다 성공
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          eo_order_id?: string;
          portal_status?: string;
        } | null;
        if (data?.eo_order_id) {
          return { ok: true, eo_order_id: data.eo_order_id, portal_status: data.portal_status };
        }
        lastError = "응답에 eo_order_id 없음";
      } else {
        // 계약 ⓓ — 실패 본문은 { error } 단일 키(사람이 읽는 사유)
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        const reason = data?.error ?? `EO 응답 ${res.status}`;
        if (res.status >= 400 && res.status < 500) {
          // 4xx 중에서도 일시 상태는 재시도: 첨부 pull 실패("다시 보내 주세요" — 서명 URL은
          // 전송마다 새로 발급되므로 재전송이 곧 복구)는 영구 거절이 아니다(계약 ⓒ-1).
          const transient = reason.includes("다시 보내 주세요");
          return { ok: false, retryable: transient, error: `EO 거절(${res.status}): ${reason}` };
        }
        // 5xx(503 = 설정 미비 등 아직 준비 안 된 상태 — 계약 ⓓ 보강) — 재시도
        lastError = `EO(${res.status}): ${reason}`;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "network error";
    }
  }
  return { ok: false, retryable: true, error: lastError };
}
