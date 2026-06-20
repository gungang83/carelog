import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

    // 1. 세션 토큰 발급 + 유저 조회를 generateLink 한 번으로 처리.
    //    기존 유저(대부분의 로그인)는 호출 1회로 userId·token을 함께 얻는다.
    //    (이전: createUser를 낙관적으로 먼저 실패시킨 뒤 listUsers({perPage:1000})로
    //     전 유저를 받아 JS find 하던 패턴이 로그인 최대 병목 — 제거.)
    const redirectTo = `${req.nextUrl.origin}/`;
    const genMagicLink = () =>
      admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });

    let userId: string;
    let hashedToken: string | undefined;

    let link = await genMagicLink();
    if (link.data?.user?.id && link.data.properties?.hashed_token) {
      userId = link.data.user.id;
      hashedToken = link.data.properties.hashed_token;
    } else {
      // 유저 미존재 → 생성 후 재발급 (신규 유저만 이 경로)
      console.log("[SSO] user not found, creating:", link.error?.message);
      const { data: createData, error: createError } =
        await admin.auth.admin.createUser({ email, email_confirm: true });
      if (createError || !createData?.user) {
        console.error("[SSO] createUser failed:", createError?.message);
        return NextResponse.redirect(`${EO_APP_URL}?sso_error=user_create`);
      }
      userId = createData.user.id;
      link = await genMagicLink();
      hashedToken = link.data?.properties?.hashed_token;
    }

    if (!hashedToken) {
      console.error("[SSO] generateLink failed:", link.error?.message);
      return NextResponse.redirect(`${EO_APP_URL}?sso_error=magic_link`);
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

    // 2-b. EO 마스터 동기화는 폴링 cron(/api/cron/sync-master, 10분 주기)에 위임한다.
    //      로그인마다 EO fetch + 다건 upsert를 동기 await 하면 로그인을 직접 막으므로 제거.

    // 3. 세션 쿠키를 이 자리서 직접 세팅하고 곧장 '/'로 — /auth/callback 홉 제거(카드 479A).
    //    SSO는 위 2단계에서 멤버십을 보장하므로 callback의 멤버없음(온보딩/초대) 분기가 불필요.
    //    → 서버리스 1홉 + 콜드 1회 + 중복 verifyOtp·멤버조회 제거. 패턴은 기존 callback과 동일.
    const supabase = await createServerSupabaseClient();
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash: hashedToken,
      type: "magiclink",
    });
    if (otpError) {
      console.error("[SSO] verifyOtp error:", otpError.message);
      return NextResponse.redirect(`${EO_APP_URL}?sso_error=verify`);
    }
    console.log("[SSO] session set, redirecting to /");
    return NextResponse.redirect(`${req.nextUrl.origin}/`);
  } catch (e) {
    console.error("[SSO] unhandled error:", e);
    return NextResponse.redirect(`${EO_APP_URL}?sso_error=unexpected`);
  }
}
