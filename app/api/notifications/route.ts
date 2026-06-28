import { NextResponse } from "next/server";
import { getNotificationContext, getNotifications } from "@/lib/notifications";

// 내 알림 목록(기관 격리 + 대상 필터 + 본인 읽음상태). spec 012.
export async function GET() {
  const ctx = await getNotificationContext();
  if (!ctx) return NextResponse.json({ notifications: [], email: "" });
  const notifications = await getNotifications(ctx);
  return NextResponse.json({ notifications, email: ctx.email });
}
