"use server";

// spec 038 — 환자용 상담 안내 보내기(직원) · 보기(환자).
//   직원 기록은 그대로 두고, 고른 내용으로 만든 환자용 문서(patient_shares)를 따로 저장해 보낸다.
//   링크 = 초대(patient_invitations.share_id) — 30일 안에 몇 번이든 열 수 있고, 처음이면 등록 번호 인증번호 한 번.

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyAuthorInfo, getMyInstitution, getMyInstitutionId } from "@/lib/auth/institution";
import { getPatientSession } from "@/lib/patient-session";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { deductCredit } from "@/lib/credits";
import { alimtalkReady, sendAlimtalk, sendSms } from "@/lib/sms/solapi";
import { parseConsultSettings } from "@/lib/consult-settings";
import { sendPushToPatient } from "@/app/actions/patient-portal";
import { insertInvitation, institutionSmsSender, koreanMonthDay, patientLinkUrl } from "@/lib/patient-invite";

type Fail = { ok: false; message: string };

const DRAFT_MODEL = "claude-sonnet-4-6";

function normalizePhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.startsWith("010") && digits.length === 11 ? digits : null;
}

async function requireStaff(): Promise<{ ok: true; institutionId: string; userId: string; email: string } | Fail> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return { ok: false, message: "기관 정보를 찾을 수 없습니다." };
  return { ok: true, institutionId, userId: user.id, email: user.email ?? "" };
}

// ── 직원: 보내기 화면 준비 ──────────────────────────────────────────

export type ShareContext = {
  consultationId: string;
  /** 상담 일시(문자 "10월 25일 ○○치과에서 받으신 상담") */
  consultedAt: string;
  content: string;
  prescriptions: string[];
  patient: { id: string; name: string; maskedPhone: string | null };
  /** 이 환자에게 개인정보 제공 동의를 확인한 기록이 있는지(최초 1회) */
  consentDone: boolean;
  /** 병원 대표번호(설정) — 없으면 빈 문자열 */
  contactPhone: string;
  /** 대표번호 넣기 기본 선택(설정) */
  includeContactDefault: boolean;
  /** 이번 발송 경로 — 알림톡 설정이 있으면 알림톡(실패 시 문자) */
  channel: "alimtalk" | "sms";
};

export async function getShareContext(consultationId: string): Promise<{ ok: true; ctx: ShareContext } | Fail> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const supabase = await createServerSupabaseClient();
  const { data: c } = await supabase
    .from("consultation")
    .select("id, content, prescriptions, patient_id, created_at")
    .eq("id", consultationId)
    .eq("institution_id", auth.institutionId)
    .maybeSingle();
  if (!c) return { ok: false, message: "상담 기록을 찾을 수 없습니다." };
  if (!c.patient_id) return { ok: false, message: "환자에게 연결된 기록만 보낼 수 있어요 — 먼저 환자 연결을 해 주세요." };

  const { data: p } = await supabase
    .from("patient")
    .select("id, name, phone")
    .eq("id", c.patient_id)
    .eq("institution_id", auth.institutionId)
    .maybeSingle();
  if (!p) return { ok: false, message: "환자를 찾을 수 없습니다." };

  const admin = createAdminSupabaseClient();
  const { data: instRow } = await admin.from("institutions").select("consult_settings").eq("id", auth.institutionId).maybeSingle();
  const settings = parseConsultSettings(instRow?.consult_settings);
  const { data: consent } = await admin
    .from("patient_invitations")
    .select("id")
    .eq("patient_id", p.id)
    .eq("consent_given", true)
    .limit(1);
  const phone = normalizePhone(p.phone ?? "");
  return {
    ok: true,
    ctx: {
      consultationId: String(c.id),
      consultedAt: (c.created_at as string) ?? new Date().toISOString(),
      content: (c.content as string) ?? "",
      prescriptions: ((c.prescriptions as string[] | null) ?? []).filter(Boolean),
      patient: {
        id: String(p.id),
        name: p.name as string,
        maskedPhone: phone ? `${phone.slice(0, 3)}-****-${phone.slice(-4)}` : null,
      },
      consentDone: (consent ?? []).length > 0,
      contactPhone: settings.contact_phone,
      includeContactDefault: settings.include_contact && !!settings.contact_phone,
      channel: alimtalkReady("share") ? "alimtalk" : "sms",
    },
  };
}

// ── 직원: 쉬운 말 초안(AI) ──────────────────────────────────────────

export async function draftPatientShare(params: {
  consultationId: string;
  selectedText: string;
  prescriptions: string[];
  patientName: string;
}): Promise<{ ok: true; html: string } | Fail> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const text = params.selectedText.trim();
  if (!text) return { ok: false, message: "보낼 내용을 하나 이상 골라 주세요." };
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === "your_anthropic_api_key_here") return { ok: false, message: "AI 키가 설정되지 않았습니다." };
  const inst = await getMyInstitution();

  try {
    const anthropic = new Anthropic({ apiKey: key });
    const message = await anthropic.messages.create({
      model: DRAFT_MODEL,
      max_tokens: 1500,
      system: `당신은 치과가 환자에게 보내는 '상담 안내'를 쓰는 도우미입니다. 병원 직원이 고른 상담 내용만 바탕으로, 환자가 휴대폰으로 읽기 쉬운 안내문을 씁니다.

규칙:
- 존댓말, 짧은 문장, 쉬운 말. 치과 용어는 풀어 쓰고 필요하면 괄호로 원래 용어(예: 충치(우식)). 치아 번호는 "오른쪽 위 첫째 큰어금니(16번)"처럼.
- 고른 내용에 없는 사실·진단·예후·비용을 새로 만들지 않는다. 단정적인 진단 표현 대신 "상담에서 ~로 말씀드렸어요".
- 직원 이름·내부 메모·[이어서 상담] 같은 표시는 넣지 않는다.
- '진료 기록'이라는 말을 쓰지 않는다(이 글은 '상담 안내').
- 구성(내용이 있는 것만): 첫 줄 인사("${params.patientName}님, 오늘 상담 내용을 정리해 드려요.") → <strong>오늘 상담 내용</strong> → <strong>확인된 부분</strong> → <strong>오늘 받으신 처치</strong> → <strong>집에서 관리법</strong>(처방 제품 사용법 포함) → <strong>다음 방문</strong> → 마지막 줄 "궁금한 점은 ${inst?.institution.name ?? "병원"}으로 편하게 연락 주세요."
- 출력은 HTML 조각만: <p>, <ul><li>, <strong>만 사용. 설명·마크다운·코드블록 금지.`,
      messages: [
        {
          role: "user",
          content: `[고른 상담 내용]\n${text.slice(0, 12000)}\n\n[처방 제품]\n${params.prescriptions.join(", ") || "없음"}`,
        },
      ],
    });
    const raw = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .replace(/^```(?:html)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    await deductCredit(auth.institutionId, "patient_share_draft", auth.email, {
      refId: params.consultationId,
      tokensIn: message.usage?.input_tokens ?? 0,
      tokensOut: message.usage?.output_tokens ?? 0,
    });
    return { ok: true, html: sanitizeRichHtml(raw) };
  } catch (e) {
    return { ok: false, message: `초안을 만들지 못했습니다: ${e instanceof Error ? e.message : "원인 미상"}` };
  }
}

// ── 직원: 보내기 ────────────────────────────────────────────────────

export async function sendPatientShare(params: {
  consultationId: string;
  content: string;
  images: string[];
  prescriptions: string[];
  /** 이번에 동의를 확인했는지(최초 1회 필수) */
  consent: boolean;
  /** 이번 문자에 "문의: 병원 대표번호"를 넣을지(기본값 = 병원 설정, 보낼 때 바꿈) */
  includeContact?: boolean;
}): Promise<{ ok: true; shareId: string } | (Fail & { needConsent?: boolean })> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const r = await getShareContext(params.consultationId);
  if (!r.ok) return r;
  const { ctx } = r;
  if (!ctx.consentDone && !params.consent) {
    return { ok: false, message: "처음 보내는 환자예요 — 개인정보 제공 동의를 확인해 주세요.", needConsent: true };
  }

  const supabase = await createServerSupabaseClient();
  const { data: p } = await supabase.from("patient").select("phone").eq("id", ctx.patient.id).maybeSingle();
  const phone = normalizePhone(p?.phone ?? "");
  if (!phone) return { ok: false, message: "환자 휴대폰 번호(010)가 등록되어 있지 않습니다." };

  const imgs = params.images.filter((u) => /^https:\/\//.test(u)).map((u) => `<p><img src="${u.replace(/"/g, "")}" alt=""></p>`);
  const content = sanitizeRichHtml(`${params.content}${imgs.join("")}`);
  if (!content.replace(/<[^>]*>/g, "").trim() && imgs.length === 0) return { ok: false, message: "보낼 내용이 비어 있습니다." };

  const admin = createAdminSupabaseClient();
  const { author_name } = await getMyAuthorInfo().catch(() => ({ author_name: null }));
  const now = new Date().toISOString();
  const { data: share, error } = await admin
    .from("patient_shares")
    .insert({
      institution_id: auth.institutionId,
      patient_id: ctx.patient.id,
      consultation_id: ctx.consultationId,
      title: "상담 안내",
      content,
      prescriptions: params.prescriptions,
      created_by: auth.userId,
      author_name,
      sent_at: now,
    })
    .select("id")
    .single();
  if (error || !share) return { ok: false, message: `저장 실패: ${error?.message ?? "원인 미상"}` };

  const inv = await insertInvitation(admin, {
    institution_id: auth.institutionId,
    patient_id: ctx.patient.id,
    phone,
    consent_given: ctx.consentDone || params.consent,
    invited_by: auth.userId,
    share_id: share.id,
  });
  if (!inv.ok) {
    await admin.from("patient_shares").delete().eq("id", share.id);
    return { ok: false, message: `링크 생성 실패: ${inv.message}` };
  }

  // 언제·어디서 받은 상담인지 + 짧은 링크(+ 고른 경우 병원 대표번호). 알림톡 설정이 있으면 알림톡, 실패하면 문자.
  const inst = await getMyInstitution();
  const instName = inst?.institution.name ?? "케어로그";
  const when = koreanMonthDay(ctx.consultedAt);
  const contact = params.includeContact && ctx.contactPhone ? ctx.contactPhone : "";
  const from = await institutionSmsSender(admin, auth.institutionId);
  const smsText =
    `[${instName}] ${ctx.patient.name}님, ${when ? `${when} ` : ""}${instName}에서 받으신 상담 내용을 정리해 보내 드려요. 아래 링크에서 확인해 주세요.` +
    `\n${patientLinkUrl(inv.token)}${contact ? `\n문의: ${instName} ${contact}` : ""}`;
  let sms: { ok: true } | { ok: false; message: string } = { ok: false, message: "" };
  if (ctx.channel === "alimtalk") {
    // 템플릿 변수 — specs/038 §7 문구와 글자까지 일치해야 한다
    sms = await sendAlimtalk(
      phone,
      "share",
      {
        "#{병원}": instName,
        "#{환자}": ctx.patient.name,
        "#{날짜}": when || "오늘",
        "#{문의}": contact ? `문의: ${instName} ${contact}` : "궁금한 점은 병원으로 편하게 문의해 주세요.",
        "#{링크}": inv.token,
      },
      { from },
    );
  }
  if (!sms.ok) sms = await sendSms(phone, smsText, { from });
  if (!sms.ok) {
    await admin.from("patient_invitations").delete().eq("id", inv.id);
    await admin.from("patient_shares").delete().eq("id", share.id);
    return { ok: false, message: sms.message ?? "문자 발송에 실패했습니다." };
  }

  // 이미 가입·알림 허용한 환자에게는 푸시도(비차단)
  void Promise.resolve(
    admin.from("patient_account_links").select("patient_account_id").eq("patient_id", ctx.patient.id),
  )
    .then((res) => {
      for (const l of res.data ?? []) {
        void sendPushToPatient(l.patient_account_id as string, {
          title: "상담 안내가 도착했어요",
          body: `${inst?.institution.name ?? "병원"}에서 보낸 오늘 상담 안내`,
          url: `/portal/s/${share.id}`,
        }).catch(() => {});
      }
    })
    .catch(() => {});

  // 카드의 기존 '전송됨' 표시와도 맞춘다
  await supabase.from("consultation").update({ sms_sent_at: now }).eq("id", ctx.consultationId);
  revalidatePath(`/patients/${ctx.patient.id}`);
  return { ok: true, shareId: share.id as string };
}

export type ShareStatus = { id: string; sent_at: string | null; first_viewed_at: string | null; view_count: number };

/** 직원 카드 표시용 — 기록별 보낸 안내와 환자 확인 여부 */
export async function getSharesForConsultations(
  ids: string[],
): Promise<Record<string, ShareStatus[]>> {
  const auth = await requireStaff();
  if (!auth.ok || ids.length === 0) return {};
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("patient_shares")
    .select("id, consultation_id, sent_at, first_viewed_at, view_count")
    .eq("institution_id", auth.institutionId)
    .in("consultation_id", ids.slice(0, 200))
    .order("created_at", { ascending: false });
  const map: Record<string, ShareStatus[]> = {};
  for (const r of data ?? []) {
    const k = String(r.consultation_id);
    (map[k] ??= []).push({
      id: r.id as string,
      sent_at: (r.sent_at as string | null) ?? null,
      first_viewed_at: (r.first_viewed_at as string | null) ?? null,
      view_count: (r.view_count as number) ?? 0,
    });
  }
  return map;
}

// ── 환자: 안내 보기 ─────────────────────────────────────────────────

export type PatientShareItem = {
  id: string;
  institutionName: string;
  patientName: string;
  sentAt: string;
  content: string;
  prescriptions: string[];
  viewed: boolean;
};

async function myPatientIds(): Promise<string[] | null> {
  const session = await getPatientSession();
  if (!session) return null;
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("patient_account_links")
    .select("patient_id")
    .eq("patient_account_id", session.patientAccountId);
  return (data ?? []).map((l) => String(l.patient_id));
}

async function toItems(rows: Record<string, unknown>[]): Promise<PatientShareItem[]> {
  if (rows.length === 0) return [];
  const admin = createAdminSupabaseClient();
  const instIds = [...new Set(rows.map((r) => r.institution_id as string))];
  const patIds = [...new Set(rows.map((r) => String(r.patient_id)))];
  const [{ data: insts }, { data: pats }] = await Promise.all([
    admin.from("institutions").select("id, name").in("id", instIds),
    admin.from("patient").select("id, name").in("id", patIds),
  ]);
  const instName = new Map((insts ?? []).map((i) => [i.id as string, i.name as string]));
  const patName = new Map((pats ?? []).map((p) => [String(p.id), p.name as string]));
  return rows.map((r) => ({
    id: r.id as string,
    institutionName: instName.get(r.institution_id as string) ?? "병원",
    patientName: patName.get(String(r.patient_id)) ?? "",
    sentAt: (r.sent_at as string) ?? (r.created_at as string),
    content: (r.content as string) ?? "",
    prescriptions: ((r.prescriptions as string[] | null) ?? []).filter(Boolean),
    viewed: !!r.first_viewed_at,
  }));
}

/** 포털 목록 — 내게(가족 포함 연결된 환자) 온 안내 */
export async function getPatientShares(): Promise<{ ok: true; shares: PatientShareItem[] } | Fail> {
  const ids = await myPatientIds();
  if (!ids) return { ok: false, message: "로그인이 필요합니다." };
  if (ids.length === 0) return { ok: true, shares: [] };
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("patient_shares")
    .select("id, institution_id, patient_id, content, prescriptions, sent_at, created_at, first_viewed_at")
    .in("patient_id", ids)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(100);
  if (error) return { ok: false, message: "상담 안내를 불러오지 못했습니다." };
  return { ok: true, shares: await toItems(data ?? []) };
}

/** 안내 한 건 — 내 것인지 확인하고 열람 기록(직원 카드에 "환자가 확인했어요") */
export async function openPatientShare(id: string): Promise<{ ok: true; share: PatientShareItem } | (Fail & { login?: boolean })> {
  const ids = await myPatientIds();
  if (!ids) return { ok: false, message: "로그인이 필요합니다.", login: true };
  if (!/^[0-9a-f-]{36}$/.test(id)) return { ok: false, message: "찾을 수 없는 안내입니다." };
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("patient_shares")
    .select("id, institution_id, patient_id, content, prescriptions, sent_at, created_at, first_viewed_at, view_count")
    .eq("id", id)
    .maybeSingle();
  if (!data || !ids.includes(String(data.patient_id))) return { ok: false, message: "찾을 수 없는 안내입니다." };
  const now = new Date().toISOString();
  await admin
    .from("patient_shares")
    .update({
      first_viewed_at: data.first_viewed_at ?? now,
      last_viewed_at: now,
      view_count: ((data.view_count as number) ?? 0) + 1,
    })
    .eq("id", id);
  const [share] = await toItems([data]);
  return { ok: true, share };
}
