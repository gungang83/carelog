"use server";

import webpush from "web-push";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

// VAPID 설정은 지연 초기화한다. 모듈 로드 시점에 setVapidDetails를 호출하면
// 환경변수가 없는 환경(예: Vercel Preview 빌드)에서 빌드 자체가 깨진다.
let vapidConfigured: boolean | null = null;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured !== null) return vapidConfigured;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    console.warn("[push] VAPID 환경변수 미설정 — 푸시 알림을 건너뜁니다.");
    vapidConfigured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export type PushResult = { ok: true } | { ok: false; message: string };

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  icon?: string;
  /** 알림 종류(선택). 예: "chair-record" — sw.js가 포커스 시 OS 알림 생략(FR-010). */
  kind?: string;
};

export async function subscribePush(
  sub: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<PushResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const { data: member } = await supabase
    .from("institution_members")
    .select("institution_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!member) return { ok: false, message: "소속 기관을 찾을 수 없습니다." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      institution_id: member.institution_id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function unsubscribePush(endpoint: string): Promise<PushResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function sendPushToInstitution(
  institutionId: string,
  payload: PushPayload
): Promise<void> {
  if (!ensureVapidConfigured()) return;

  // Service role bypasses RLS to read all subscriptions for the institution
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: subs } = await adminClient
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("institution_id", institutionId);

  if (!subs?.length) return;

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    icon: payload.icon ?? "/icons/icon-192.png",
    kind: payload.kind,
  });

  const staleEndpoints: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          pushPayload
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  if (staleEndpoints.length > 0) {
    await adminClient
      .from("push_subscriptions")
      .delete()
      .in("endpoint", staleEndpoints);
  }
}
