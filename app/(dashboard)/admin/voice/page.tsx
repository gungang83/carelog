import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { getVoiceAdminData } from "@/app/actions/voice-admin";
import { VoiceSettings } from "@/components/admin/voice-settings";

// 슈퍼어드민 — 말로 기록 보정(spec 040 §17-2).
export default async function AdminVoicePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user.email)) redirect("/");
  const r = await getVoiceAdminData();
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">말로 기록 보정</h1>
          <p className="mt-1 text-sm text-slate-500">잇몸 기록 [🎙 말로 기록]의 전사 모델 · 용어 힌트 · 보정 낱말 (최고 관리자 전용)</p>
        </div>
        <Link href="/admin" className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
          ← 슈퍼어드민
        </Link>
      </div>
      {r.ok ? <VoiceSettings data={r.data} /> : <p className="text-sm text-red-600">{r.message}</p>}
    </div>
  );
}
