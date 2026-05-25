import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const EO_APP_URL =
  process.env.EO_APP_URL ?? "https://eo-ten.vercel.app";

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
  const token = req.nextUrl.searchParams.get("token");
  const secret = process.env.CARELOG_SSO_SECRET;

  if (!token || !secret) {
    return NextResponse.redirect(`${EO_APP_URL}?sso_error=missing`);
  }

  const payload = await verifyJwt(token, secret).catch(() => null);
  if (!payload) {
    return NextResponse.redirect(`${EO_APP_URL}?sso_error=invalid_token`);
  }

  const { email, institution_id } = payload as {
    email: string;
    institution_id: string;
  };

  const admin = createAdminSupabaseClient();

  // 1. Supabase 사용자 조회 또는 생성
  let userId: string;
  const { data: createData, error: createError } =
    await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });

  if (createError) {
    // 이미 존재하는 경우 listUsers로 찾기
    const { data: { users } } = await admin.auth.admin.listUsers();
    const existing = users.find((u) => u.email === email);
    if (!existing) {
      return NextResponse.redirect(`${EO_APP_URL}?sso_error=user_lookup`);
    }
    userId = existing.id;
  } else {
    userId = createData.user.id;
  }

  // 2. institution_members에 없으면 추가
  const { data: member } = await admin
    .from("institution_members")
    .select("id")
    .eq("user_id", userId)
    .eq("institution_id", institution_id)
    .maybeSingle();

  if (!member) {
    await admin.from("institution_members").insert({
      user_id: userId,
      institution_id,
      role: "staff",
    });
  }

  // 3. magic link 발급 → 기존 /auth/callback으로 리다이렉트
  const redirectTo = `${req.nextUrl.origin}/auth/callback`;
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.redirect(`${EO_APP_URL}?sso_error=magic_link`);
  }

  return NextResponse.redirect(linkData.properties.action_link);
}
