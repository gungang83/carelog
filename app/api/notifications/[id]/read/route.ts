import { NextRequest, NextResponse } from "next/server";
import {
  getNotificationContext,
  markNotificationRead,
  markNotificationUnread,
} from "@/lib/notifications";

// 읽음 처리
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getNotificationContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await markNotificationRead(ctx.userId, id);
  return NextResponse.json({ ok: true });
}

// 읽음/안읽음 토글 — body { is_read: false } 이면 안읽음 복귀
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getNotificationContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { is_read?: boolean };
  if (body.is_read === false) {
    await markNotificationUnread(ctx.userId, id);
  } else {
    await markNotificationRead(ctx.userId, id);
  }
  return NextResponse.json({ ok: true });
}
