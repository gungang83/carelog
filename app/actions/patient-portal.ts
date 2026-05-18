"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMyInstitution } from "@/lib/auth/institution";
import { sendSms } from "@/lib/sms/solapi";
import { getPatientSession } from "@/lib/patient-session";
import { hashResidentNoForMatching } from "@/lib/rrn-hash";
import { normalizeFullResidentNo } from "@/lib/rrn-core";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { PatientInvitationRow } from "@/lib/types/database";

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits.startsWith("010") || digits.length !== 11) return null;
  return digits;
}

// ─── US1: 직원의 SMS 초대 발송 ───────────────────────────────────────────────

export async function sendPatientInvitation(
  formData: FormData,
): Promise<
  | { ok: true; invitation: PatientInvitationRow }
  | { ok: false; message: string }
> {
  const institutionData = await getMyInstitution();
  if (!institutionData) {
    return { ok: false, message: "로그인이 필요합니다." };
  }

  const consentGiven = formData.get("consent_given");
  if (consentGiven !== "true") {
    return { ok: false, message: "개인정보 제공 동의가 필요합니다." };
  }

  const rawPhone = String(formData.get("phone") ?? "");
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return {
      ok: false,
      message: "올바른 전화번호를 입력해 주세요. (010으로 시작하는 11자리)",
    };
  }

  const patientId = String(formData.get("patient_id") ?? "");
  if (!patientId) {
    return { ok: false, message: "환자 ID가 필요합니다." };
  }

  const admin = createAdminSupabaseClient();
  const { institution, role: _role } = institutionData;

  const supabaseUser = await (async () => {
    const { createServerSupabaseClient } = await import(
      "@/lib/supabase/server"
    );
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    return data.user;
  })();
  if (!supabaseUser) return { ok: false, message: "로그인이 필요합니다." };

  // 기존 미수락 초대 무효화
  await admin
    .from("patient_invitations")
    .update({ expires_at: new Date().toISOString() })
    .eq("patient_id", patientId)
    .is("accepted_at", null);

  // 새 초대 생성
  const { data: invitation, error: insertError } = await admin
    .from("patient_invitations")
    .insert({
      institution_id: institution.id,
      patient_id: patientId,
      phone,
      consent_given: true,
      invited_by: supabaseUser.id,
    })
    .select()
    .single();

  if (insertError || !invitation) {
    return { ok: false, message: "초대 생성에 실패했습니다." };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://carelog-tau.vercel.app";
  const smsText = `[${institution.name}] 상담 내역 확인하기: ${siteUrl}/p/${invitation.token}`;
  const smsResult = await sendSms(phone, smsText);

  if (!smsResult.ok) {
    await admin
      .from("patient_invitations")
      .delete()
      .eq("id", invitation.id);
    return { ok: false, message: `SMS 발송 실패: ${smsResult.message}` };
  }

  return { ok: true, invitation: invitation as PatientInvitationRow };
}

// ─── US2: 환자 OTP 요청 ──────────────────────────────────────────────────────

export async function requestPatientOtp(
  formData: FormData,
): Promise<
  | { ok: true; rrnHash: string }
  | { ok: false; message: string; retryAfterSeconds?: number }
> {
  const rawPhone = String(formData.get("phone") ?? "");
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return {
      ok: false,
      message: "올바른 전화번호를 입력해 주세요. (010으로 시작하는 11자리)",
    };
  }

  const rrnFront = String(formData.get("rrn_front") ?? "").trim();
  const rrnBack = String(formData.get("rrn_back") ?? "").trim();
  if (!/^\d{6}$/.test(rrnFront) || !/^\d{7}$/.test(rrnBack)) {
    return { ok: false, message: "주민등록번호를 올바르게 입력해 주세요." };
  }
  const normalized13 = rrnFront + rrnBack;
  const rrnHash = hashResidentNoForMatching(normalized13);

  const invitationToken = formData.get("invitation_token")
    ? String(formData.get("invitation_token"))
    : null;

  const admin = createAdminSupabaseClient();

  if (invitationToken) {
    const { data: invitation, error } = await admin
      .from("patient_invitations")
      .select("patient_id, expires_at, accepted_at")
      .eq("token", invitationToken)
      .single();

    if (error || !invitation) {
      return { ok: false, message: "초대 링크가 유효하지 않습니다." };
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return {
        ok: false,
        message: "초대 링크가 만료되었습니다. 치과에 재전송을 요청하세요.",
      };
    }
    if (invitation.accepted_at) {
      return { ok: false, message: "이미 사용된 초대 링크입니다." };
    }

    const { data: patient } = await admin
      .from("patient")
      .select("resident_no")
      .eq("id", invitation.patient_id)
      .single();

    if (!patient?.resident_no) {
      return { ok: false, message: "입력 정보가 일치하지 않습니다." };
    }
    const storedNorm = normalizeFullResidentNo(patient.resident_no);
    if (!storedNorm || hashResidentNoForMatching(storedNorm) !== rrnHash) {
      return { ok: false, message: "입력 정보가 일치하지 않습니다." };
    }
  } else {
    const { data: account } = await admin
      .from("patient_accounts")
      .select("id")
      .eq("rrn_hash", rrnHash)
      .maybeSingle();

    if (!account) {
      return {
        ok: false,
        message:
          "가입된 계정이 없습니다. 치과에서 받은 초대 링크로 가입해 주세요.",
      };
    }
  }

  // OTP 잠금 확인 (최근 10분 내 attempt_count >= 3)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: lockedOtp } = await admin
    .from("patient_otps")
    .select("id, created_at")
    .eq("phone", phone)
    .gte("attempt_count", 3)
    .gte("created_at", tenMinutesAgo)
    .maybeSingle();

  if (lockedOtp) {
    const lockExpiry = new Date(
      new Date(lockedOtp.created_at).getTime() + 10 * 60 * 1000,
    );
    const retryAfterSeconds = Math.ceil(
      (lockExpiry.getTime() - Date.now()) / 1000,
    );
    return {
      ok: false,
      message: "OTP 입력 오류 횟수 초과. 잠시 후 다시 시도해 주세요.",
      retryAfterSeconds: Math.max(retryAfterSeconds, 0),
    };
  }

  // 기존 미사용 OTP 무효화
  await admin
    .from("patient_otps")
    .update({ expires_at: new Date().toISOString() })
    .eq("phone", phone)
    .is("verified_at", null);

  // 6자리 OTP 생성
  const code = String(Math.floor(100000 + Math.random() * 900000));

  const { error: otpError } = await admin.from("patient_otps").insert({
    phone,
    code,
  });

  if (otpError) {
    return { ok: false, message: "OTP 생성에 실패했습니다." };
  }

  const smsResult = await sendSms(
    phone,
    `[케어로그] 인증번호: ${code} (5분 이내 입력)`,
  );

  if (!smsResult.ok) {
    return { ok: false, message: `OTP 발송 실패: ${smsResult.message}` };
  }

  return { ok: true, rrnHash };
}

// ─── US2: 환자 OTP 검증 + 세션 생성 ─────────────────────────────────────────

export async function verifyPatientOtp(
  formData: FormData,
): Promise<
  | { ok: true; isNewAccount: boolean }
  | { ok: false; message: string }
> {
  const rawPhone = String(formData.get("phone") ?? "");
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return { ok: false, message: "올바른 전화번호입니다." };
  }

  const code = String(formData.get("code") ?? "").trim();
  const rrnHash = String(formData.get("rrn_hash") ?? "").trim();
  const invitationToken = formData.get("invitation_token")
    ? String(formData.get("invitation_token"))
    : null;

  const admin = createAdminSupabaseClient();

  // 유효한 OTP 조회
  const { data: otp, error: otpError } = await admin
    .from("patient_otps")
    .select("id, code, attempt_count, expires_at")
    .eq("phone", phone)
    .is("verified_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (otpError || !otp) {
    return {
      ok: false,
      message:
        "인증 시간이 초과되었습니다. OTP를 다시 요청해 주세요.",
    };
  }

  // attempt_count 증가
  const newAttemptCount = otp.attempt_count + 1;
  await admin
    .from("patient_otps")
    .update({ attempt_count: newAttemptCount })
    .eq("id", otp.id);

  if (newAttemptCount >= 3 && otp.code !== code) {
    return {
      ok: false,
      message: "OTP 입력 오류 횟수(3회)를 초과했습니다. 10분 후 다시 시도해 주세요.",
    };
  }

  if (otp.code !== code) {
    return {
      ok: false,
      message: `인증번호가 일치하지 않습니다. (${newAttemptCount}/3회)`,
    };
  }

  // OTP 사용 처리
  await admin
    .from("patient_otps")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", otp.id);

  // patient_accounts 조회 또는 생성
  let isNewAccount = false;
  let patientAccountId: string;

  const { data: existing } = await admin
    .from("patient_accounts")
    .select("id")
    .eq("rrn_hash", rrnHash)
    .maybeSingle();

  if (existing) {
    patientAccountId = existing.id;
    await admin
      .from("patient_accounts")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", patientAccountId);
  } else {
    const { data: newAccount, error: accountError } = await admin
      .from("patient_accounts")
      .insert({ rrn_hash: rrnHash })
      .select("id")
      .single();

    if (accountError || !newAccount) {
      return { ok: false, message: "계정 생성에 실패했습니다." };
    }
    patientAccountId = newAccount.id;
    isNewAccount = true;
  }

  // 세션 생성
  const { data: session, error: sessionError } = await admin
    .from("patient_sessions")
    .insert({ patient_account_id: patientAccountId })
    .select("token")
    .single();

  if (sessionError || !session) {
    return { ok: false, message: "세션 생성에 실패했습니다." };
  }

  const cookieStore = await cookies();
  cookieStore.set("patient_session_token", session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  // 초대 토큰 처리
  if (invitationToken) {
    const { data: invitation } = await admin
      .from("patient_invitations")
      .select("id, patient_id, institution_id, expires_at, accepted_at")
      .eq("token", invitationToken)
      .maybeSingle();

    if (
      invitation &&
      !invitation.accepted_at &&
      new Date(invitation.expires_at) > new Date()
    ) {
      try {
        await admin.from("patient_account_links").insert({
          patient_account_id: patientAccountId,
          patient_id: invitation.patient_id,
          institution_id: invitation.institution_id,
        });
      } catch {
        // ON CONFLICT DO NOTHING — duplicate link is fine
      }

      await admin
        .from("patient_invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitation.id);
    }
  }

  return { ok: true, isNewAccount };
}

// ─── US3: 환자 상담 내역 조회 ─────────────────────────────────────────────────

export type PatientRecordItem = {
  consultationId: string;
  institutionName: string;
  date: string;
  content: string;
  imageUrls: string[];
  prescriptions: string[];
  stationName: string | null;
  patientName: string;
};

export async function getPatientRecords(): Promise<
  | { ok: true; records: PatientRecordItem[] }
  | { ok: false; message: string }
> {
  const cookieStore = await cookies();
  const session = await getPatientSession(cookieStore);

  if (!session) {
    return { ok: false, message: "로그인이 필요합니다." };
  }

  const admin = createAdminSupabaseClient();

  const { data: links, error: linksError } = await admin
    .from("patient_account_links")
    .select("patient_id, institution_id")
    .eq("patient_account_id", session.patientAccountId);

  if (linksError) {
    return { ok: false, message: "데이터를 불러오는데 실패했습니다." };
  }
  if (!links || links.length === 0) {
    return { ok: true, records: [] };
  }

  const patientIds = links.map((l) => l.patient_id);
  const institutionIds = [...new Set(links.map((l) => l.institution_id))];

  const [consultResult, instResult, patientResult] = await Promise.all([
    admin
      .from("consultation")
      .select("id, patient_id, institution_id, content, image_urls, prescriptions, created_at")
      .in("patient_id", patientIds)
      .order("created_at", { ascending: false }),
    admin
      .from("institutions")
      .select("id, name")
      .in("id", institutionIds),
    admin
      .from("patient")
      .select("id, name")
      .in("id", patientIds),
  ]);

  if (consultResult.error) {
    return { ok: false, message: "상담 내역을 불러오는데 실패했습니다." };
  }

  const instMap = new Map(
    (instResult.data ?? []).map((i) => [i.id, i.name as string]),
  );
  const patientMap = new Map(
    (patientResult.data ?? []).map((p) => [String(p.id), p.name as string]),
  );

  const records: PatientRecordItem[] = (consultResult.data ?? []).map((c) => ({
    consultationId: String(c.id),
    institutionName: instMap.get(c.institution_id) ?? "알 수 없는 기관",
    date: c.created_at as string,
    content: c.content as string,
    imageUrls: (c.image_urls as string[] | null) ?? [],
    prescriptions: (c.prescriptions as string[] | null) ?? [],
    stationName: null,
    patientName: patientMap.get(String(c.patient_id)) ?? "",
  }));

  return { ok: true, records };
}

// ─── US4: 환자 로그아웃 ──────────────────────────────────────────────────────

export async function patientLogout(_formData?: FormData): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get("patient_session_token")?.value;

  if (token) {
    const admin = createAdminSupabaseClient();
    await admin.from("patient_sessions").delete().eq("token", token);
  }

  cookieStore.delete("patient_session_token");
  redirect("/portal/login");
}

// ─── Google 가입: pending 쿠키 설정 ─────────────────────────────────────────

export async function setCookieForPatientAuth(
  patientAccountId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cookieStore = await cookies();
  const session = await getPatientSession(cookieStore);

  if (!session || session.patientAccountId !== patientAccountId) {
    return { ok: false, message: "인증이 필요합니다." };
  }

  cookieStore.set("pending_patient_account_id", patientAccountId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300, // 5분
    path: "/",
  });

  return { ok: true };
}

// ─── 환자 인증 상태 조회 ──────────────────────────────────────────────────────

export async function getPatientAuthStatus(): Promise<
  | { ok: true; patientAccountId: string; isGoogleLinked: boolean }
  | { ok: false; message: string }
> {
  const cookieStore = await cookies();
  const session = await getPatientSession(cookieStore);

  if (!session) {
    return { ok: false, message: "로그인이 필요합니다." };
  }

  const admin = createAdminSupabaseClient();
  const { data: link } = await admin
    .from("patient_auth_links")
    .select("id")
    .eq("patient_account_id", session.patientAccountId)
    .eq("provider", "google")
    .maybeSingle();

  return {
    ok: true,
    patientAccountId: session.patientAccountId,
    isGoogleLinked: !!link,
  };
}

// ─── 환자 푸시 구독 관리 ──────────────────────────────────────────────────────

type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function subscribePatientPush(
  sub: PushSubscriptionJSON,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cookieStore = await cookies();
  const session = await getPatientSession(cookieStore);

  if (!session) {
    return { ok: false, message: "로그인이 필요합니다." };
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("patient_push_subscriptions").upsert(
    {
      patient_account_id: session.patientAccountId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: "patient_account_id,endpoint" },
  );

  if (error) {
    return { ok: false, message: "구독 등록에 실패했습니다." };
  }

  return { ok: true };
}

export async function unsubscribePatientPush(
  endpoint: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cookieStore = await cookies();
  const session = await getPatientSession(cookieStore);

  if (!session) {
    return { ok: false, message: "로그인이 필요합니다." };
  }

  const admin = createAdminSupabaseClient();
  await admin
    .from("patient_push_subscriptions")
    .delete()
    .eq("patient_account_id", session.patientAccountId)
    .eq("endpoint", endpoint);

  return { ok: true };
}

// ─── 직원 본인 환자 계정 직접 연동 ───────────────────────────────────────────

export async function linkMyPatientAccount(
  rrnFront: string,
  rrnBack: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  // 1. 현재 Supabase staff 세션 확인
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  // 2. 주민번호 형식 검증
  if (!/^\d{6}$/.test(rrnFront) || !/^\d{7}$/.test(rrnBack)) {
    return { ok: false, message: "주민등록번호를 올바르게 입력해 주세요." };
  }
  const rrnHash = hashResidentNoForMatching(rrnFront + rrnBack);

  // 3. 소속 기관의 환자 레코드에서 주민번호 매칭
  const institutionData = await getMyInstitution();
  if (!institutionData) return { ok: false, message: "소속 기관이 없습니다." };
  const { institution } = institutionData;

  const admin = createAdminSupabaseClient();
  const { data: patientsInInstitution } = await admin
    .from("patient")
    .select("id, resident_no")
    .eq("institution_id", institution.id)
    .not("resident_no", "is", null);

  const patientRecord = (patientsInInstitution ?? []).find((p) => {
    const norm = normalizeFullResidentNo(p.resident_no ?? "");
    return norm && hashResidentNoForMatching(norm) === rrnHash;
  }) ?? null;

  if (!patientRecord) {
    return {
      ok: false,
      message:
        "일치하는 환자 정보를 찾을 수 없습니다. 먼저 환자 목록에서 본인 정보를 등록하고 주민번호를 입력해 주세요.",
    };
  }

  // 4. patient_accounts upsert (rrn_hash 기준)
  const { data: existingAccount } = await admin
    .from("patient_accounts")
    .select("id")
    .eq("rrn_hash", rrnHash)
    .maybeSingle();

  let patientAccountId: string;

  if (existingAccount) {
    patientAccountId = existingAccount.id;
  } else {
    const { data: newAccount, error: accountError } = await admin
      .from("patient_accounts")
      .insert({ rrn_hash: rrnHash })
      .select("id")
      .single();
    if (accountError || !newAccount) {
      return { ok: false, message: "환자 계정 생성에 실패했습니다." };
    }
    patientAccountId = newAccount.id;
  }

  // 5. patient_account_links upsert
  await admin
    .from("patient_account_links")
    .upsert(
      {
        patient_account_id: patientAccountId,
        patient_id: patientRecord.id,
        institution_id: institution.id,
      },
      { onConflict: "patient_account_id,patient_id" },
    );

  // 6. patient_auth_links upsert — 현재 Google 계정과 연동
  const { error: linkError } = await admin
    .from("patient_auth_links")
    .upsert(
      {
        auth_user_id: user.id,
        patient_account_id: patientAccountId,
        provider: "google",
      },
      { onConflict: "auth_user_id" },
    );

  if (linkError) {
    return { ok: false, message: "계정 연동에 실패했습니다." };
  }

  return { ok: true };
}

// ─── 직원 환자 계정 연동 상태 조회 ───────────────────────────────────────────

export async function getMyPatientLinkStatus(): Promise<
  | { ok: true; linked: true; patientAccountId: string }
  | { ok: true; linked: false }
  | { ok: false; message: string }
> {
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const admin = createAdminSupabaseClient();
  const { data: link } = await admin
    .from("patient_auth_links")
    .select("patient_account_id")
    .eq("auth_user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();

  if (!link) return { ok: true, linked: false };
  return { ok: true, linked: true, patientAccountId: link.patient_account_id };
}

// ─── 특정 환자에게 푸시 알림 발송 ────────────────────────────────────────────

type PushPayload = { title: string; body: string; url: string };

export async function sendPushToPatient(
  patientAccountId: string,
  payload: PushPayload,
): Promise<void> {
  const admin = createAdminSupabaseClient();

  const { data: subs } = await admin
    .from("patient_push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("patient_account_id", patientAccountId);

  if (!subs || subs.length === 0) return;

  const webpush = await import("web-push");
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const staleEndpoints: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    }),
  );

  if (staleEndpoints.length > 0) {
    await admin
      .from("patient_push_subscriptions")
      .delete()
      .in("endpoint", staleEndpoints)
      .eq("patient_account_id", patientAccountId);
  }
}
