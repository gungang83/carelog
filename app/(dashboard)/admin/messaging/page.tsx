import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { getSmsAdminData } from "@/app/actions/sms-admin";
import { SmsDefaultSender } from "@/components/admin/sms-default-sender";

// 슈퍼어드민 — 문자 발신(케어로그 기본 발신번호).
export default async function AdminMessagingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user.email)) redirect("/");

  const r = await getSmsAdminData();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">문자 발신</h1>
          <p className="mt-1 text-sm text-slate-500">케어로그 기본 발신번호 — 병원 번호를 따로 고르지 않은 워크스페이스가 쓰는 번호입니다. (최고 관리자 전용)</p>
        </div>
        <Link href="/admin" className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
          ← 슈퍼어드민
        </Link>
      </div>
      {r.ok ? <SmsDefaultSender data={r.data} /> : <p className="text-sm text-red-600">{r.message}</p>}
    </div>
  );
}
