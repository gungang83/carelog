/**
 * EO ↔ Carelog 마스터 게이트웨이 클라이언트 (계약 §1).
 *
 * EO = 직원·클리닉 마스터(SSOT). Carelog는 서버-서버 시크릿(x-gateway-secret)으로
 * 안전 필드만 받아 로컬 캐시(clinic_members)를 갱신한다.
 * 민감정보(주민/계좌/급여/연락처)는 응답에 포함되지 않는다.
 *
 * 강결합 금지(헤임달 §3): EO 코드를 import하지 않고 HTTP로만 통신한다.
 */

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

const EO_APP_URL = stripBom(
  process.env.EO_APP_URL ?? "https://eo-ten.vercel.app",
);

/** 게이트웨이 응답의 직원 마스터(안전 필드만 — 계약 §1). */
export type EoMasterMember = {
  /** EO employee uuid — 캐시 upsert 키(이메일이 바뀌어도 불변). */
  id: string;
  email: string;
  name: string;
  position: string | null;
  job_category: string | null;
  employment_type: string | null;
  work_type: string | null;
  eo_role: "clinic_admin" | "manager" | "staff";
  hire_date: string | null;
  /** 재직 여부(false = 퇴사). */
  active: boolean;
  resign_date: string | null;
  /** 승인대기(초안) 직원. */
  is_draft: boolean;
};

/** 게이트웨이 응답의 클리닉 마스터(안전 필드). */
export type EoMasterClinic = {
  id: string;
  name: string;
  slug: string;
  clinic_type: string | null;
  plan: "free" | "pro";
};

export type EoMasterResponse = {
  institution_id: string;
  clinic: EoMasterClinic;
  members: EoMasterMember[];
  member_count: number;
  /** 이 응답 생성 시각(캐시 기준). */
  synced_at: string;
};

export type FetchEoMasterResult =
  | { ok: true; data: EoMasterResponse }
  /** 연동 안 된 institution_id(404) — 동기화 대상 아님(스킵). */
  | { ok: false; reason: "not_linked" }
  /** 시크릿 미설정/불일치(401) 또는 설정 누락 — 설정 점검 필요. */
  | { ok: false; reason: "config" }
  /** 잘못된 요청(400). */
  | { ok: false; reason: "bad_request" }
  /** 게이트웨이 서버오류(500) 또는 네트워크 실패 — 재시도. */
  | { ok: false; reason: "server_error"; message: string };

/**
 * EO 마스터 게이트웨이에서 한 기관의 직원·클리닉 마스터를 받아온다.
 * 사용자 세션 무관 — 서버-서버 공유 시크릿(CARELOG_GATEWAY_SECRET) 사용.
 */
export async function fetchEoMaster(
  institutionId: string,
): Promise<FetchEoMasterResult> {
  const secret = stripBom(process.env.CARELOG_GATEWAY_SECRET ?? "");
  if (!secret) {
    return { ok: false, reason: "config" };
  }
  if (!institutionId) {
    return { ok: false, reason: "bad_request" };
  }

  const url = `${EO_APP_URL}/api/gateway/carelog/master?institution_id=${encodeURIComponent(institutionId)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { "x-gateway-secret": secret },
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      reason: "server_error",
      message: e instanceof Error ? e.message : "네트워크 오류",
    };
  }

  // 응답 코드 매핑(계약 §1)
  switch (res.status) {
    case 200:
      break;
    case 400:
      return { ok: false, reason: "bad_request" };
    case 401:
      return { ok: false, reason: "config" }; // 시크릿 불일치 → 설정 점검
    case 404:
      return { ok: false, reason: "not_linked" };
    default:
      return {
        ok: false,
        reason: "server_error",
        message: `gateway responded ${res.status}`,
      };
  }

  try {
    const data = (await res.json()) as EoMasterResponse;
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      reason: "server_error",
      message: e instanceof Error ? e.message : "응답 파싱 실패",
    };
  }
}
