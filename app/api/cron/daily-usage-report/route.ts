import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/institution";
import { isSuperAdmin, SUPER_ADMIN_EMAIL } from "@/lib/admin";
import { sendNotification } from "@/lib/notifications";
import { sendPushToUser } from "@/app/actions/push";
import {
  buildDailyReport,
  persistDailyReport,
  reportHeadline,
  shiftKstDate,
  kstToday,
  type DailyReport,
} from "@/lib/usage/daily-report";

// spec 014 — 일일 사용 리포트 발행(매일 08:00 KST = 0 23 * * * UTC).
//   어제(KST 0~24시) 전체 워크스페이스 집계 → usage_reports 저장 → 슈퍼어드민 알림함+웹푸시.
//   인증: CRON_SECRET Bearer(자동) 또는 슈퍼어드민 세션(수동 트리거·테스트).
//   ?date=YYYY-MM-DD 로 특정 일자 재발행 가능(멱등).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

async function authorize(req: NextRequest): Promise<boolean> {
  const cronSecret = stripBom(process.env.CRON_SECRET ?? "");
  if (cronSecret) {
    // 시크릿 설정 시: Vercel cron(Bearer) 또는 수동 트리거(슈퍼어드민 세션)만 허용.
    if (req.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
    const user = await getSessionUser().catch(() => null);
    return isSuperAdmin(user?.email);
  }
  // 시크릿 미설정: 기존 cron(sync-master·prune-audio)과 동일하게 통과(권장: CRON_SECRET 설정).
  return true;
}

/** 슈퍼어드민 user_id 조회(auth users 페이지네이션). 소규모라 일1회 cron엔 충분. */
async function findSuperAdminUserId(
  admin: ReturnType<typeof createAdminSupabaseClient>,
): Promise<string | null> {
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    const found = data.users.find((u) => u.email === SUPER_ADMIN_EMAIL);
    if (found) return found.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

/** 슈퍼어드민에게 리포트 알림 + 푸시. 인앱 카드는 본인 소속 기관(들)에 recipients=email로 적재. */
async function deliverToSuperAdmin(report: DailyReport): Promise<{ inApp: number; pushed: boolean }> {
  const admin = createAdminSupabaseClient();
  const title = `📊 일일 사용 리포트 (${report.date})`;
  const body = reportHeadline(report);
  const link = `/admin/usage/report/${report.date}`;

  const uid = await findSuperAdminUserId(admin);
  let institutionIds: string[] = [];
  if (uid) {
    const { data: members } = await admin
      .from("institution_members")
      .select("institution_id")
      .eq("user_id", uid);
    institutionIds = [...new Set((members ?? []).map((m) => m.institution_id as string))];
  }

  // 인앱 알림함: 슈퍼어드민 소속 기관마다 본인 전용(recipients=email)으로 적재
  for (const institutionId of institutionIds) {
    await sendNotification({
      title,
      body,
      type: "daily_report",
      link,
      recipients: SUPER_ADMIN_EMAIL,
      institutionId,
      createdBy: null,
    });
  }

  // 웹푸시: 슈퍼어드민 본인 기기로 직접(기관 무관)
  let pushed = false;
  if (uid) {
    await sendPushToUser(uid, { title, body, url: link, kind: "daily_report" }).catch(() => {});
    pushed = true;
  }

  return { inApp: institutionIds.length, pushed };
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 기본: 어제(KST). ?date= 로 특정 일자 재발행.
  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam || shiftKstDate(kstToday(), -1);

  try {
    const report = await buildDailyReport({ date, scope: "all" });
    await persistDailyReport(report);
    const delivery = await deliverToSuperAdmin(report);
    return NextResponse.json({
      ok: true,
      date,
      summary: report.summary,
      delivery,
    });
  } catch (e) {
    console.error("[daily-usage-report] 실패:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "report_failed" },
      { status: 500 },
    );
  }
}
