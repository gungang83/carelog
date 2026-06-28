import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser, getMyInstitutionId } from "@/lib/auth/institution";
import { sendPushToInstitution } from "@/app/actions/push";
import type { NotificationItem } from "@/lib/types/database";

/**
 * 알림함 (spec 012) — 생성/조회/읽음 단일 출처.
 * notifications(broadcast 본문) + notification_reads(유저별 읽음=행 존재) 2테이블.
 * 적재·조회·읽음은 admin client(서버 권위)로 수행. 환자 PII(주민번호 등) 평문 미적재.
 */
type Recipients = "all" | "admins" | string; // 특정 이메일

export type NotificationContext = {
  userId: string;
  email: string;
  role: string;
  institutionId: string;
};

/** 알림 생성 + 기존 푸시 발송 통합. 적재 실패는 비차단(상담 저장·푸시를 막지 않음). */
export async function sendNotification(opts: {
  title: string;
  body: string;
  type: string;
  link: string;
  recipients?: Recipients;
  institutionId: string;
  createdBy?: string | null;
}): Promise<void> {
  const {
    title,
    body,
    type,
    link,
    recipients = "all",
    institutionId,
    createdBy = null,
  } = opts;

  try {
    const admin = createAdminSupabaseClient();
    const { error } = await admin.from("notifications").insert({
      institution_id: institutionId,
      title,
      body,
      type,
      link,
      recipients,
      created_by: createdBy,
    });
    if (error) console.warn("[notifications] insert 실패(비차단):", error.message);
  } catch (e) {
    console.warn("[notifications] insert 예외(비차단):", e);
  }

  // broadcast(all/admins)만 웹푸시 — 특정 이메일 대상은 인앱 알림함만.
  if (recipients === "all" || recipients === "admins") {
    await sendPushToInstitution(institutionId, {
      title,
      body,
      url: link,
      kind: type,
    }).catch(() => {});
  }
}

/** 라우트 공용 — 현재 세션의 사용자·기관·역할 컨텍스트. */
export async function getNotificationContext(): Promise<NotificationContext | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const institutionId = await getMyInstitutionId();
  if (!institutionId) return null;
  const supabase = await createServerSupabaseClient();
  const { data: member } = await supabase
    .from("institution_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  return {
    userId: user.id,
    email: user.email ?? "",
    role: (member?.role as string) ?? "staff",
    institutionId,
  };
}

/** 내가 받을 알림(기관 격리 + 대상 필터 + 본인 읽음상태). 최신순 최대 50건. */
export async function getNotifications(ctx: NotificationContext): Promise<NotificationItem[]> {
  const { userId, email, role, institutionId } = ctx;
  const isAdmin = role === "admin" || role === "owner";
  const admin = createAdminSupabaseClient();

  // 마이그레이션 미적용 등으로 조회 실패 시 빈 목록으로 graceful 처리(앱 깨짐 방지).
  let notifs: Record<string, unknown>[] | null = null;
  let reads: { notification_id: string }[] | null = null;
  try {
    const [r1, r2] = await Promise.all([
      admin
        .from("notifications")
        .select("id, created_at, title, body, type, link, recipients")
        .eq("institution_id", institutionId)
        .order("created_at", { ascending: false })
        .limit(100),
      admin.from("notification_reads").select("notification_id").eq("user_id", userId),
    ]);
    if (r1.error || r2.error) return [];
    notifs = r1.data as Record<string, unknown>[] | null;
    reads = r2.data as { notification_id: string }[] | null;
  } catch {
    return [];
  }

  const readSet = new Set((reads ?? []).map((r) => r.notification_id as string));

  return (notifs ?? [])
    .filter((n) => {
      const rcp = (n.recipients as string) ?? "all";
      if (rcp === "all") return true;
      if (rcp === "admins") return isAdmin;
      return rcp === email; // 특정 이메일 대상
    })
    .map((n) => ({
      id: n.id as string,
      timestamp: n.created_at as string,
      title: (n.title as string) ?? "",
      body: (n.body as string) ?? "",
      type: (n.type as string) ?? "system",
      link: (n.link as string) ?? "/",
      isRead: readSet.has(n.id as string),
    }))
    .slice(0, 50);
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();
    await admin
      .from("notification_reads")
      .upsert({ notification_id: notificationId, user_id: userId }, { onConflict: "notification_id,user_id" });
  } catch {
    /* 비차단 */
  }
}

export async function markNotificationUnread(userId: string, notificationId: string): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();
    await admin
      .from("notification_reads")
      .delete()
      .eq("notification_id", notificationId)
      .eq("user_id", userId);
  } catch {
    /* 비차단 */
  }
}

export async function markAllNotificationsRead(ctx: NotificationContext): Promise<void> {
  try {
    const items = await getNotifications(ctx);
    const unread = items.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    // 중복 id 제거 — 같은 (notification_id,user_id)가 배치에 2개면 onConflict upsert가 전체 실패한다.
    const seen = new Set<string>();
    const rows = unread
      .filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
      .map((n) => ({ notification_id: n.id, user_id: ctx.userId }));
    const admin = createAdminSupabaseClient();
    await admin.from("notification_reads").upsert(rows, { onConflict: "notification_id,user_id" });
  } catch {
    /* 비차단 */
  }
}
