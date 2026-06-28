import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/institution";
import { isSuperAdmin } from "@/lib/admin";
import { grantCredit } from "@/lib/credits";

// spec 013 §B — 크레딧 충전(시뮬레이션). 슈퍼어드민 전용.
//   body { institutionId, amount, memo? }. 실결제 아님(부여 로그만).

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSuperAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let institutionId = "";
  let amount = 0;
  let memo: string | undefined;
  try {
    const body = await req.json();
    institutionId = String(body?.institutionId ?? "");
    amount = Math.floor(Number(body?.amount ?? 0));
    memo = body?.memo ? String(body.memo) : undefined;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!institutionId || !Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  try {
    const balance = await grantCredit(institutionId, amount, user.email, memo);
    return NextResponse.json({ ok: true, balance });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "grant_failed" },
      { status: 500 },
    );
  }
}
