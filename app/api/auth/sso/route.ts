import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { syncEoMaster } from "@/lib/eo/sync-master";

/**
 * EO eo_role → Carelog institution_members.role 매핑.
 * 과도한 권한 승격 방지: clinic_admin만 admin으로, 나머지는 staff.
 * (직원 개별 RBAC는 후속 — 계약 §2)
 */
function mapEoRole(eoRole?: string): "admin" | "staff" {
  return eoRole === "clinic_admin" ? "admin" : "staff";
}

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
const EO_APP_URL = stripBom(
  process.env.EO_APP_URL ?? "https://eo-ten.vercel.app",
);

async function verifyJwt(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, sig] = parts;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const padded = sig.replace(/-/g, "+").replace(/_/g, "/");
  const sigBytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  if (!valid) return null;

  const paddedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = JSON.parse(atob(paddedPayload));
  if (decoded.exp < Math.floor(Date.now() / 1000)) return null;

  return decoded;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const secret = stripBom(process.env.CARELOG_SSO_SECRET ?? "");

    console.log("[SSO] token present:", !!token, "secret present:", !!secret);

    if (!token || !secret) {
      console.error("[SSO] missing token or secret", { tokenLen: token?.length, secretLen: secret.length });
      return NextResponse.redirect(`${EO_APP_URL}?sso_error=missing`);
    }

    const payload = await verifyJwt(token, secret).catch((e) => {
      console.error("[SSO] verifyJwt threw:", e);
      return null;
    });

    console.log("[SSO] payload valid:", !!payload);

    if (!payload) {
      return NextResponse.redirect(`${EO_APP_URL}?sso_error=invalid_token`);
    }

    // 카드#226에서 확장된 클레임(employee_id·name·account_type·eo_role) 수용.
    // 기존 클레임(email·institution_id)은 그대로 유지.
    const {
      email,
      institution_id,
      employee_id = null,
      name = null,
      account_type = null,
      eo_role,
    } = payload as {
      email: string;
      institution_id: string;
      employee_id?: string | null;
      name?: string | null;
      account_type?: "personal" | "shared" | null;
      eo_role?: "clinic_admin" | "manager" | "staff";
    };

    console.log(
      "[SSO] email:", email,
      "institution_id:", institution_id,
      "employee_id:", employee_id,
      "account_type:", account_type,
      "eo_role:", eo_role,
    );

    let admin;
    try {
      admin = createAdminSupabaseClient();
    } catch (e) {
      console.error("[SSO] createAdminSupabaseClient failed:", e);
      return NextResponse.redirect(`${EO_APP_URL}?sso_error=server_config`);
    }

    // 1. Supabase 사용자 조회 또는 생성
    let userId: string;
    const { data: createData, error: createError } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      });

    if (createError) {
      console.log("[SSO] createUser error (likely already exists):", createError.message);
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existing = users.find((u) => u.email === email);
      if (!existing) {
        console.error("[SSO] user not found after listUsers");
        return NextResponse.redirect(`${EO_APP_URL}?sso_error=user_lookup`);
      }
      userId = existing.id;
    } else {
      userId = createData.user.id;
    }

    console.log("[SSO] userId:", userId);

    // 2. institution_members 멤버십 + 작성자 귀속 정보(eo_employee_id·display_name).
    //    신규는 매핑된 role로 추가, 기존은 role을 건드리지 않고 귀속 정보만 갱신
    //    (수동으로 조정한 권한을 SSO가 덮어쓰지 않도록).
    const { data: member } = await admin
      .from("institution_members")
      .select("id")
      .eq("user_id", userId)
      .eq("institution_id", institution_id)
      .maybeSingle();

    if (!member) {
      const { error: insertError } = await admin.from("institution_members").insert({
        user_id: userId,
        institution_id,
        role: mapEoRole(eo_role),
        eo_employee_id: employee_id,
        display_name: name,
      });
      if (insertError) {
        console.warn("[SSO] institution_members insert error (non-fatal):", insertError.message);
      }
    } else if (employee_id || name) {
      const { error: updateError } = await admin
        .from("institution_members")
        .update({ eo_employee_id: employee_id, display_name: name })
        .eq("id", member.id);
      if (updateError) {
        console.warn("[SSO] institution_members update error (non-fatal):", updateError.message);
      }
    }

    // 2-b. EO 마스터 lazy 동기화(이 기관) — best-effort, 로그인 흐름을 막지 않음.
    //      미연동(404)·시크릿 미설정이면 조용히 스킵된다(폴링 cron이 본 경로).
    try {
      const syncResult = await syncEoMaster(institution_id);
      if (syncResult.ok) {
        console.log(
          "[SSO] EO master synced:",
          `+${syncResult.inserted}/~${syncResult.updated}/-${syncResult.deactivated}`,
        );
      } else if (syncResult.reason !== "not_linked" && syncResult.reason !== "config") {
        console.warn("[SSO] EO master sync skipped:", syncResult.reason);
      }
    } catch (e) {
      console.warn("[SSO] EO master sync threw (non-fatal):", e);
    }

    // 3. OTP 토큰 발급 → /auth/callback으로 token_hash 직접 전달 (PKCE 우회)
    console.log("[SSO] generating link for:", email);

    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${req.nextUrl.origin}/` },
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("[SSO] generateLink error:", linkError?.message, "props:", JSON.stringify(linkData?.properties));
      return NextResponse.redirect(`${EO_APP_URL}?sso_error=magic_link`);
    }

    // PKCE code verifier 없이 서버에서 직접 OTP 검증할 수 있게 token_hash 전달
    const callbackUrl = new URL(`${req.nextUrl.origin}/auth/callback`);
    callbackUrl.searchParams.set("token_hash", linkData.properties.hashed_token);
    callbackUrl.searchParams.set("type", "magiclink");
    console.log("[SSO] redirecting to callback with token_hash");
    return NextResponse.redirect(callbackUrl.toString());
  } catch (e) {
    console.error("[SSO] unhandled error:", e);
    return NextResponse.redirect(`${EO_APP_URL}?sso_error=unexpected`);
  }
}
