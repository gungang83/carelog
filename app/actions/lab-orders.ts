"use server";

// spec 035 — 기공지 작성(Carelog) → EO 전송 서버 액션 (카드 #1957/#1959).
// 가드: 기관 멤버십(위생사 포함 전 직원 — 현장 작성 주체가 위생사). 테이블은 RLS 정책 0 + admin 경유.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitutionId, getMyAuthorInfo } from "@/lib/auth/institution";
import { gatewayFetchLabs, labGatewayEnabled } from "@/lib/eo/lab-gateway";
import { sendLabOrderById, labBucket } from "@/lib/lab-order-sender";
import {
  DEFAULT_LAB_FORM_DEF,
  DEFAULT_LAB_FORM_NAME,
  LAB_ATTACH_LIMITS,
  buildFormDisplay,
  type EoLab,
  type LabAttachmentKind,
  type LabAttachmentMeta,
  type LabDisplayRow,
  type LabOrderFormDef,
  type LabOrderFormRow,
} from "@/lib/lab-orders";

type Fail = { ok: false; message: string };

async function requireMember(): Promise<
  { ok: true; institutionId: string; email: string; authorName: string | null } | Fail
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };
  const { author_name } = await getMyAuthorInfo().catch(() => ({ author_name: null }));
  return { ok: true, institutionId, email: user.email ?? "", authorName: author_name ?? null };
}

// ── 컨텍스트: 기공소 목록(EO 정본) + 양식 ────────────────────

export type LabOrderContext = {
  labs: EoLab[] | null; // null = 게이트웨이 미발효(기공소명 직접 입력 폴백)
  gatewayOn: boolean;
  forms: LabOrderFormRow[];
};

export async function getLabOrderContext(): Promise<{ ok: true; ctx: LabOrderContext } | Fail> {
  const auth = await requireMember();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const fetchForms = () =>
    admin
      .from("lab_order_forms")
      .select("id, institution_id, lab_name, name, version, def, active")
      .or(`institution_id.is.null,institution_id.eq.${auth.institutionId}`)
      .eq("active", true)
      .order("created_at", { ascending: true });

  let { data: forms } = await fetchForms();
  if (!forms || forms.length === 0) {
    // 첫 진입 — 전역 기본 양식 시드(지플란트 실물 기반). 데이터 정의라 이후 내용 수정은 코드 무관.
    await admin.from("lab_order_forms").insert({
      institution_id: null,
      lab_name: null,
      name: DEFAULT_LAB_FORM_NAME,
      def: DEFAULT_LAB_FORM_DEF,
      created_by: auth.email,
    });
    ({ data: forms } = await fetchForms());
  }

  const labs = await gatewayFetchLabs(auth.institutionId);
  return {
    ok: true,
    ctx: {
      labs,
      gatewayOn: labGatewayEnabled(),
      forms: (forms ?? []) as LabOrderFormRow[],
    },
  };
}

// ── 첨부 업로드(서명 업로드 URL — 동영상 50MB는 서버 액션 한도(25MB) 우회) ──

export async function createLabAttachmentUpload(
  orderId: string,
  filename: string,
  kind: LabAttachmentKind,
  bytes: number,
): Promise<{ ok: true; path: string; token: string } | Fail> {
  const auth = await requireMember();
  if (!auth.ok) return auth;
  if (!/^[0-9a-f-]{36}$/.test(orderId)) return { ok: false, message: "잘못된 의뢰 ID입니다." };

  const limit =
    kind === "video" ? LAB_ATTACH_LIMITS.video : kind === "sketch" ? LAB_ATTACH_LIMITS.sketch : LAB_ATTACH_LIMITS.photo;
  if (bytes > limit) {
    return {
      ok: false,
      message: `용량 초과 — ${kind === "video" ? "동영상 50MB" : "사진 5MB"} 이하로 올려주세요.`,
    };
  }

  const safeName = filename.replace(/[^\w.\-가-힣]/g, "_").slice(0, 80) || "file";
  const path = `${auth.institutionId}/${orderId}/${Date.now()}_${safeName}`;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.storage.from(labBucket).createSignedUploadUrl(path);
  if (error || !data?.token) {
    return { ok: false, message: `업로드 준비 실패: ${error?.message ?? "원인 미상"}` };
  }
  return { ok: true, path, token: data.token };
}

// ── 의뢰 제출 ────────────────────────────────────────────────

export type SubmitLabOrderInput = {
  orderId: string; // 클라 생성 uuid = carelog_order_id(멱등 키)
  labName: string;
  consultationId?: number | null;
  patientId?: number | null;
  patientName: string;
  chartNo?: string;
  doctor?: string;
  hygienist?: string;
  tooth: string[];
  prosthesis: string;
  material?: string;
  shadeSystem?: string;
  shade?: string;
  dueDate: string; // YYYY-MM-DD
  orderType: "의뢰" | "수정" | "재제작";
  remakeReason?: string;
  formId: string;
  values: Record<string, unknown>;
  instructions?: string;
  attachments: LabAttachmentMeta[];
};

export async function submitLabOrder(
  input: SubmitLabOrderInput,
): Promise<{ ok: true; status: "sent" | "queued" | "failed"; message: string } | Fail> {
  const auth = await requireMember();
  if (!auth.ok) return auth;
  if (!/^[0-9a-f-]{36}$/.test(input.orderId)) return { ok: false, message: "잘못된 의뢰 ID입니다." };

  const labName = input.labName.trim();
  const patientName = input.patientName.trim();
  const prosthesis = input.prosthesis.trim();
  if (!labName) return { ok: false, message: "기공소를 선택(입력)해 주세요." };
  if (!patientName) return { ok: false, message: "환자를 선택해 주세요." };
  if (!prosthesis) return { ok: false, message: "보철 종류를 선택해 주세요." };
  if (!input.dueDate) return { ok: false, message: "완료(납기)일을 입력해 주세요." };
  if (input.orderType === "재제작" && !input.remakeReason?.trim()) {
    return { ok: false, message: "재제작 사유를 입력해 주세요." };
  }
  const totalBytes = input.attachments.reduce((s, a) => s + (a.bytes || 0), 0);
  if (totalBytes > LAB_ATTACH_LIMITS.total) {
    return { ok: false, message: "첨부 합계가 100MB를 초과합니다 — 일부를 빼 주세요." };
  }
  // 경로 위조 방지 — 내 기관·이 의뢰의 업로드만 허용
  const prefix = `${auth.institutionId}/${input.orderId}/`;
  if (input.attachments.some((a) => !a.path.startsWith(prefix))) {
    return { ok: false, message: "첨부 경로가 올바르지 않습니다." };
  }

  const admin = createAdminSupabaseClient();

  // 양식 조회 + display 스냅샷(사람용 — EO·기공소는 이것만 렌더, 카드 #1957 제안)
  const { data: form } = await admin
    .from("lab_order_forms")
    .select("id, name, version, def")
    .eq("id", input.formId)
    .maybeSingle();
  const def = (form?.def ?? DEFAULT_LAB_FORM_DEF) as LabOrderFormDef;
  const display: LabDisplayRow[] = buildFormDisplay(def, input.values ?? {});

  // share 정책(계약 §2-1): ✗ 필드는 애초에 보내지 않는다. 목록 미발효 시 보수 기본값.
  const labs = await gatewayFetchLabs(auth.institutionId);
  const share = labs?.find((l) => l.lab_name === labName)?.share ?? {
    patient_name: true,
    chart_no: false,
    doctor: true,
  };

  const payload = {
    institution_id: auth.institutionId,
    carelog_order_id: input.orderId,
    lab_name: labName,
    patient: {
      ...(share.patient_name ? { name: patientName } : { name: "(비공개)" }),
      ...(share.chart_no && input.chartNo?.trim() ? { chart_no: input.chartNo.trim() } : {}),
    },
    ...(share.doctor && input.doctor?.trim() ? { doctor: input.doctor.trim() } : {}),
    ...(input.hygienist?.trim() ? { hygienist: input.hygienist.trim() } : {}),
    tooth: input.tooth,
    prosthesis,
    ...(input.material?.trim() ? { material: input.material.trim() } : {}),
    ...(input.shade?.trim()
      ? { shade: { system: input.shadeSystem?.trim() || null, values: input.shade.trim() } }
      : {}),
    due_date: input.dueDate,
    order_type: input.orderType,
    ...(input.remakeReason?.trim() ? { remake_reason: input.remakeReason.trim() } : {}),
    form: {
      key: def.key,
      version: form?.version ?? 1,
      values: input.values ?? {},
      display,
    },
    ...(input.instructions?.trim() ? { instructions: input.instructions.trim() } : {}),
    attachments: input.attachments, // path 보관 — 전송기에서 서명 URL로 치환
  };

  const { error } = await admin.from("lab_orders").upsert(
    {
      id: input.orderId,
      institution_id: auth.institutionId,
      consultation_id: input.consultationId ?? null,
      patient_id: input.patientId ?? null,
      lab_name: labName,
      form_id: form?.id ?? null,
      payload,
      status: "queued",
      created_by: auth.authorName ?? auth.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) return { ok: false, message: `기공지 저장 실패: ${error.message}` };

  // 즉시 전송 시도 — 실패해도 큐에 남아 cron이 재전송(기공지는 유실되지 않는다)
  const sent = await sendLabOrderById(input.orderId);
  const message =
    sent.status === "sent"
      ? "기공소로 전송했습니다."
      : sent.status === "queued"
        ? `기공지는 저장됐고 전송 대기열에 있습니다 — 자동으로 재전송됩니다. (${sent.error ?? ""})`
        : `전송이 거절됐습니다: ${sent.error ?? "원인 미상"}`;
  return { ok: true, status: sent.status, message };
}

// ── 목록·재전송 ──────────────────────────────────────────────

export type LabOrderListRow = {
  id: string;
  lab_name: string;
  patient_name: string;
  tooth: string[];
  prosthesis: string;
  due_date: string;
  status: string;
  eo_order_id: string | null;
  error: string | null;
  attempts: number;
  created_by: string | null;
  created_at: string;
};

export async function getMyLabOrders(): Promise<{ ok: true; rows: LabOrderListRow[] } | Fail> {
  const auth = await requireMember();
  if (!auth.ok) return auth;
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("lab_orders")
    .select("id, lab_name, payload, status, eo_order_id, error, attempts, created_by, created_at")
    .eq("institution_id", auth.institutionId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return { ok: false, message: "목록 조회에 실패했습니다." };
  return {
    ok: true,
    rows: (data ?? []).map((r) => {
      const p = (r.payload ?? {}) as {
        patient?: { name?: string };
        tooth?: string[];
        prosthesis?: string;
        due_date?: string;
      };
      return {
        id: r.id as string,
        lab_name: r.lab_name as string,
        patient_name: p.patient?.name ?? "(미상)",
        tooth: p.tooth ?? [],
        prosthesis: p.prosthesis ?? "",
        due_date: p.due_date ?? "",
        status: r.status as string,
        eo_order_id: (r.eo_order_id as string | null) ?? null,
        error: (r.error as string | null) ?? null,
        attempts: (r.attempts as number) ?? 0,
        created_by: (r.created_by as string | null) ?? null,
        created_at: r.created_at as string,
      };
    }),
  };
}

export async function retryLabOrder(
  orderId: string,
): Promise<{ ok: true; status: "sent" | "queued" | "failed"; message: string } | Fail> {
  const auth = await requireMember();
  if (!auth.ok) return auth;
  const admin = createAdminSupabaseClient();
  const { data: order } = await admin
    .from("lab_orders")
    .select("id, institution_id, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.institution_id !== auth.institutionId) {
    return { ok: false, message: "의뢰를 찾을 수 없습니다." };
  }
  // failed(영구)도 수동 재시도는 허용 — attempts 리셋으로 큐 복귀
  await admin
    .from("lab_orders")
    .update({ status: "queued", attempts: 0, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  const sent = await sendLabOrderById(orderId);
  return {
    ok: true,
    status: sent.status,
    message:
      sent.status === "sent" ? "전송 완료" : sent.status === "queued" ? "대기열 보관(자동 재전송)" : `거절: ${sent.error}`,
  };
}
