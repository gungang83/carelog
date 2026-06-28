import { NextResponse } from "next/server";
import { getNotificationContext, markAllNotificationsRead } from "@/lib/notifications";

// 전체 읽음
export async function POST() {
  const ctx = await getNotificationContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await markAllNotificationsRead(ctx);
  return NextResponse.json({ ok: true });
}
