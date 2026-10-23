"use server";

// spec 035 — 기공지 작성(Carelog) → EO 전송 서버 액션 (카드 #1957/#1959).
// 가드: 기관 멤버십(위생사 포함 전 직원 — 현장 작성 주체가 위생사). 테이블은 RLS 정책 0 + admin 경유.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitutionId, getMyAuthorInfo } from "@/lib/auth/institution";
import { gatewayFetchLabs, labGatewayEnabled } from "@/lib/eo/lab-gateway";
import { sendLabOrderById, labBucket } from "@/lib/lab-order-sender";
import { getClinicMembers } from "@/app/actions/clinic-members";
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
  recentLabs: string[]; // 우리가 거래해 본 기공소(보낸 기공지에서 추출, 최근순) — 선택 편의
  staff: { name: string; role: string | null }[]; // 구성원(설정 '우리 병원 사람들') — Dr./담당자 선택 편의
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

  // 거래해 본 기공소(최근순 distinct) — EO 목록 미발효에도 쉽게 재선택
  const { data: recent } = await admin
    .from("lab_orders")
    .select("lab_name, created_at")
    .eq("institution_id", auth.institutionId)
    .order("created_at", { ascending: false })
    .limit(100);
  const recentLabs = [...new Set((recent ?? []).map((r) => r.lab_name as string))].slice(0, 10);

  const [labs, members] = await Promise.all([
    gatewayFetchLabs(auth.institutionId),
    getClinicMembers().catch(() => []),
  ]);
  return {
    ok: true,
    ctx: {
      labs,
      gatewayOn: labGatewayEnabled(),
      forms: (forms ?? []) as LabOrderFormRow[],
      recentLabs,
      staff: members.map((m) => ({ name: m.name, role: m.role ?? null })),
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

/** 작성 화면 첨부 미리보기용 단기 서명 URL(10분). 화면 표시에만 쓰고 저장하지 않는다(만료 링크를 남기지 않는 원칙). */
export async function getLabAttachmentPreviewUrls(
  paths: string[],
): Promise<{ ok: true; urls: Record<string, string> } | Fail> {
  const auth = await requireMember();
  if (!auth.ok) return auth;
  // 우리 기관 경로만
  const mine = paths.filter((p) => p.startsWith(`${auth.institutionId}/`)).slice(0, 50);
  if (mine.length === 0) return { ok: true, urls: {} };
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.storage.from(labBucket).createSignedUrls(mine, 600);
  if (error) return { ok: false, message: `미리보기를 불러오지 못했습니다: ${error.message}` };
  const urls: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
  return { ok: true, urls };
}

// ── 의뢰 제출 (세트 — 기공물 여러 개를 한 번에, 장마다 1행) ──

export type LabOrderItemInput = {
  orderId: string; // 장별 uuid = carelog_order_id(멱등 키 — 수정 시 유지)
  tooth: string[];
  prosthesis: string;
  material?: string;
  shadeSystem?: string;
  shade?: string;
  values: Record<string, unknown>;
};

export type SubmitLabOrderSetInput = {
  setId: string; // 세트 uuid — 첨부 업로드 경로·묶음 식별
  labName: string;
  consultationId?: number | null;
  patientId?: number | null;
  patientName: string;
  chartNo?: string;
  doctor?: string;
  hygienist?: string;
  orderDate: string; // 의뢰일(기본 오늘)
  dueDate: string; // 완료 희망(납기)일
  orderType: "의뢰" | "수정" | "재제작";
  remakeReason?: string;
  formId: string;
  instructions?: string;
  attachments: LabAttachmentMeta[]; // 세트 공통 첨부
  items: LabOrderItemInput[];
};

export async function submitLabOrderSet(
  input: SubmitLabOrderSetInput,
): Promise<
  | { ok: true; status: "sent" | "queued" | "failed"; message: string }
  | Fail
> {
  const auth = await requireMember();
  if (!auth.ok) return auth;
  const uuidRe = /^[0-9a-f-]{36}$/;
  if (!uuidRe.test(input.setId)) return { ok: false, message: "잘못된 세트 ID입니다." };

  // 카드 #1968 ② — lab_name은 선택한 목록 문자열 ★원문 그대로(EO 매칭 키, 변형 금지)
  const labName = input.labName;
  const patientName = input.patientName.trim();
  if (!labName.trim()) return { ok: false, message: "기공소를 선택(입력)해 주세요." };
  if (!patientName) return { ok: false, message: "환자를 선택해 주세요." };
  if (!input.dueDate) return { ok: false, message: "완료 희망(납기)일을 입력해 주세요." };
  if (input.orderType === "재제작" && !input.remakeReason?.trim()) {
    return { ok: false, message: "재제작 사유를 입력해 주세요." };
  }
  const items = (input.items ?? []).filter((it) => uuidRe.test(it.orderId));
  if (items.length === 0) return { ok: false, message: "기공물을 1개 이상 입력해 주세요." };
  for (const [i, it] of items.entries()) {
    if (!it.prosthesis.trim()) return { ok: false, message: `기공물 ${i + 1}의 보철 종류를 선택해 주세요.` };
  }
  const totalBytes = input.attachments.reduce((s, a) => s + (a.bytes || 0), 0);
  if (totalBytes > LAB_ATTACH_LIMITS.total) {
    return { ok: false, message: "첨부 합계가 100MB를 초과합니다 — 일부를 빼 주세요." };
  }
  // 경로 위조 방지 — 내 기관 업로드만 허용(세트 간 재사용 허용: 수정·재제작이 기존 첨부를 승계)
  const prefix = `${auth.institutionId}/`;
  if (input.attachments.some((a) => !a.path.startsWith(prefix))) {
    return { ok: false, message: "첨부 경로가 올바르지 않습니다." };
  }

  const admin = createAdminSupabaseClient();

  const { data: form } = await admin
    .from("lab_order_forms")
    .select("id, name, version, def")
    .eq("id", input.formId)
    .maybeSingle();
  const def = (form?.def ?? DEFAULT_LAB_FORM_DEF) as LabOrderFormDef;

  // share 정책(계약 §2-1 + ⓐ free_text·attachments): ✗ 필드는 애초에 보내지 않는다.
  // 목록 미발효 시 보수 기본값(free_text·attachments는 계약 기본 ON).
  const labs = await gatewayFetchLabs(auth.institutionId);
  const share = labs?.find((l) => l.lab_name === labName)?.share ?? {
    patient_name: true,
    chart_no: false,
    doctor: true,
    free_text: true,
    attachments: true,
  };
  const shareFree = share.free_text !== false;
  const shareAtt = share.attachments !== false;
  const sendAttachments = shareAtt ? input.attachments : []; // ⓐ — ✗면 첨부를 아예 안 보낸다

  // 수정 감지 — 기존 행의 revision·edit_log를 승계(접수·제작 후 수정 식별용)
  const { data: existingRows } = await admin
    .from("lab_orders")
    .select("id, institution_id, status, portal_status, revision, edit_log")
    .in("id", items.map((it) => it.orderId));
  const existingMap = new Map((existingRows ?? []).map((r) => [r.id as string, r]));
  for (const row of existingRows ?? []) {
    if (row.institution_id !== auth.institutionId) {
      return { ok: false, message: "수정 권한이 없는 의뢰가 포함돼 있습니다." };
    }
  }

  const editor = auth.authorName ?? auth.email;
  const now = new Date().toISOString();
  const outcomes: ("sent" | "queued" | "failed")[] = [];
  let lastError = "";
  let anyUpdated = false; // 200 {updated:true} — 수정 반영(🔄)
  let allIdempotent = true; // 전부 {idempotent:true} — 변경 없음
  let conflictStatus: string | null = null; // 409 portal_status
  let isRevision = false;

  for (const [index, it] of items.entries()) {
    const existing = existingMap.get(it.orderId);
    const revision = existing ? ((existing.revision as number) ?? 1) + 1 : 1;
    const editLog = existing
      ? [
          ...(((existing.edit_log as unknown[]) ?? []) as object[]),
          {
            at: now,
            by: editor,
            status_before: existing.status, // sent 이후 수정이면 여기 'sent'가 남는다
            portal_status_before: existing.portal_status ?? null,
          },
        ]
      : [];

    const display: LabDisplayRow[] = buildFormDisplay(def, it.values ?? {});
    const payload = {
      institution_id: auth.institutionId,
      carelog_order_id: it.orderId,
      lab_name: labName,
      patient: {
        ...(share.patient_name ? { name: patientName } : { name: "(비공개)" }),
        ...(share.chart_no && input.chartNo?.trim() ? { chart_no: input.chartNo.trim() } : {}),
      },
      ...(share.doctor && input.doctor?.trim() ? { doctor: input.doctor.trim() } : {}),
      ...(input.hygienist?.trim() ? { hygienist: input.hygienist.trim() } : {}),
      tooth: it.tooth,
      prosthesis: it.prosthesis.trim(),
      ...(it.material?.trim() ? { material: it.material.trim() } : {}),
      ...(it.shade?.trim()
        ? { shade: { system: it.shadeSystem?.trim() || null, values: it.shade.trim() } }
        : {}),
      order_date: input.orderDate,
      due_date: input.dueDate,
      order_type: input.orderType,
      ...(input.remakeReason?.trim() ? { remake_reason: input.remakeReason.trim() } : {}),
      form: { key: def.key, version: form?.version ?? 1, values: it.values ?? {}, display },
      ...(shareFree && input.instructions?.trim() ? { instructions: input.instructions.trim() } : {}),
      attachments: sendAttachments, // 세트 공통 — 전송기에서 전송 직전 15분 서명 URL로 치환(ⓒ)
      // 세트 묶음(additive — EO는 무해석·표시만) + 수정 회차(같은 id의 더 높은 revision = 업데이트)
      set: { id: input.setId, index: index + 1, total: items.length },
      revision,
    };

    const { error } = await admin.from("lab_orders").upsert(
      {
        id: it.orderId,
        set_id: input.setId,
        institution_id: auth.institutionId,
        consultation_id: input.consultationId ?? null,
        patient_id: input.patientId ?? null,
        lab_name: labName,
        form_id: form?.id ?? null,
        payload,
        status: "queued", // 수정이면 재전송 대상으로 복귀
        revision,
        edit_log: editLog,
        attempts: 0,
        error: null,
        created_by: existing ? undefined : editor,
        updated_at: now,
      },
      { onConflict: "id" },
    );
    if (error) return { ok: false, message: `기공지 저장 실패: ${error.message}` };

    if (revision > 1) isRevision = true;
    const sent = await sendLabOrderById(it.orderId);
    outcomes.push(sent.status);
    if (sent.error) lastError = sent.error;
    if (sent.updated) anyUpdated = true;
    if (!sent.idempotent) allIdempotent = false;
    if (sent.conflict) conflictStatus = sent.portalStatus ?? "completed";
  }

  const status = outcomes.every((s) => s === "sent")
    ? "sent"
    : outcomes.some((s) => s === "failed")
      ? "failed"
      : "queued";
  // 카드 #1983 — 200 두 종류·409 포탈 상태로 문구 분기
  const message =
    status === "sent"
      ? isRevision && anyUpdated
        ? `수정이 기공소로 전달됐습니다 — 기공소 화면에 🔄 수정 표시가 뜹니다.`
        : isRevision && allIdempotent
          ? `변경된 내용이 없어 기공소에는 이미 반영된 그대로입니다.`
          : `기공소로 전송했습니다 (기공물 ${items.length}건).`
      : status === "queued"
        ? `기공지 ${items.length}건이 저장됐고 전송 대기열에 있습니다 — 자동으로 재전송됩니다. (${lastError})`
        : conflictStatus
          ? conflictStatus === "billed"
            ? `청구까지 완료된 의뢰라 수정할 수 없습니다 — 목록의 [재제작으로 보내기]로 이어가세요.`
            : `이미 완료된 의뢰라 수정할 수 없습니다 — 목록의 [재제작으로 보내기]로 이어가세요.`
          : `일부 전송이 거절됐습니다: ${lastError}`;
  return { ok: true, status, message };
}

// ── 수정용 조회 — 세트 전체를 컴포저 초기값으로 ─────────────

export type LabOrderSetSnapshot = {
  setId: string;
  labName: string;
  patientId: number | null;
  patientName: string;
  chartNo: string;
  doctor: string;
  hygienist: string;
  orderDate: string;
  dueDate: string;
  orderType: "의뢰" | "수정" | "재제작";
  remakeReason: string;
  formId: string;
  instructions: string;
  attachments: LabAttachmentMeta[];
  anySent: boolean; // 전송(접수) 이후 수정 여부 안내용
  items: LabOrderItemInput[];
};

export async function getLabOrderSet(
  orderId: string,
): Promise<{ ok: true; snapshot: LabOrderSetSnapshot } | Fail> {
  const auth = await requireMember();
  if (!auth.ok) return auth;
  const admin = createAdminSupabaseClient();

  const { data: base } = await admin
    .from("lab_orders")
    .select("id, set_id, institution_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!base || base.institution_id !== auth.institutionId) {
    return { ok: false, message: "의뢰를 찾을 수 없습니다." };
  }

  const query = admin
    .from("lab_orders")
    .select("id, set_id, patient_id, lab_name, form_id, payload, status, created_at")
    .eq("institution_id", auth.institutionId);
  const { data: rows } = base.set_id
    ? await query.eq("set_id", base.set_id).order("created_at", { ascending: true })
    : await query.eq("id", orderId);
  if (!rows || rows.length === 0) return { ok: false, message: "의뢰를 찾을 수 없습니다." };

  type P = {
    patient?: { name?: string; chart_no?: string };
    doctor?: string;
    hygienist?: string;
    tooth?: string[];
    prosthesis?: string;
    material?: string;
    shade?: { system?: string | null; values?: string };
    order_date?: string;
    due_date?: string;
    order_type?: string;
    remake_reason?: string;
    instructions?: string;
    form?: { values?: Record<string, unknown> };
    attachments?: LabAttachmentMeta[];
  };
  const first = (rows[0].payload ?? {}) as P;
  return {
    ok: true,
    snapshot: {
      setId: (rows[0].set_id as string) ?? orderId,
      labName: rows[0].lab_name as string,
      patientId: (rows[0].patient_id as number | null) ?? null,
      patientName: first.patient?.name ?? "",
      chartNo: first.patient?.chart_no ?? "",
      doctor: first.doctor ?? "",
      hygienist: first.hygienist ?? "",
      orderDate: first.order_date ?? "",
      dueDate: first.due_date ?? "",
      orderType: (first.order_type as "의뢰" | "수정" | "재제작") ?? "의뢰",
      remakeReason: first.remake_reason ?? "",
      formId: (rows[0].form_id as string) ?? "",
      instructions: first.instructions ?? "",
      attachments: first.attachments ?? [],
      anySent: rows.some((r) => r.status === "sent"),
      items: rows.map((r) => {
        const p = (r.payload ?? {}) as P;
        return {
          orderId: r.id as string,
          tooth: p.tooth ?? [],
          prosthesis: p.prosthesis ?? "",
          material: p.material ?? "",
          shadeSystem: p.shade?.system ?? "",
          shade: p.shade?.values ?? "",
          values: p.form?.values ?? {},
        };
      }),
    },
  };
}

// ── 목록·재전송 ──────────────────────────────────────────────

export type LabOrderListRow = {
  id: string;
  set_id: string | null;
  lab_name: string;
  patient_name: string;
  tooth: string[];
  prosthesis: string;
  order_date: string;
  due_date: string;
  status: string;
  eo_order_id: string | null;
  error: string | null;
  attempts: number;
  revision: number;
  last_edit: { at: string; by: string; after_sent: boolean } | null;
  created_by: string | null;
  created_at: string;
};

export async function getMyLabOrders(): Promise<{ ok: true; rows: LabOrderListRow[] } | Fail> {
  const auth = await requireMember();
  if (!auth.ok) return auth;
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("lab_orders")
    .select(
      "id, set_id, lab_name, payload, status, eo_order_id, error, attempts, revision, edit_log, created_by, created_at",
    )
    .eq("institution_id", auth.institutionId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return { ok: false, message: "목록 조회에 실패했습니다." };
  return {
    ok: true,
    rows: (data ?? []).map((r) => {
      const p = (r.payload ?? {}) as {
        patient?: { name?: string };
        tooth?: string[];
        prosthesis?: string;
        order_date?: string;
        due_date?: string;
      };
      const log = ((r.edit_log as unknown[]) ?? []) as {
        at?: string;
        by?: string;
        status_before?: string;
      }[];
      const last = log.length > 0 ? log[log.length - 1] : null;
      return {
        id: r.id as string,
        set_id: (r.set_id as string | null) ?? null,
        lab_name: r.lab_name as string,
        patient_name: p.patient?.name ?? "(미상)",
        tooth: p.tooth ?? [],
        prosthesis: p.prosthesis ?? "",
        order_date: p.order_date ?? "",
        due_date: p.due_date ?? "",
        status: r.status as string,
        eo_order_id: (r.eo_order_id as string | null) ?? null,
        error: (r.error as string | null) ?? null,
        attempts: (r.attempts as number) ?? 0,
        revision: (r.revision as number) ?? 1,
        last_edit: last
          ? {
              at: last.at ?? "",
              by: last.by ?? "",
              after_sent: last.status_before === "sent", // 전송(접수) 이후 수정 — 명확 표시용
            }
          : null,
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
      sent.status === "sent"
        ? sent.updated
          ? "수정이 기공소로 전달됐습니다 (🔄)"
          : sent.idempotent
            ? "이미 반영된 내용입니다 (변경 없음)"
            : "전송 완료"
        : sent.status === "queued"
          ? "대기열 보관(자동 재전송)"
          : sent.conflict
            ? `${sent.portalStatus === "billed" ? "청구까지 완료된" : "이미 완료된"} 의뢰라 수정할 수 없습니다 — [재제작으로 보내기]로 이어가세요.`
            : `거절: ${sent.error}`,
  };
}
