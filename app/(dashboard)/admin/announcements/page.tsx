import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { listAllAnnouncements } from "@/app/actions/announcements";
import { AnnouncementManager } from "@/components/admin/announcement-manager";

// spec 022 — 공지·업데이트 발행/관리 (슈퍼어드민 전용, 중앙 발행).
export default async function AdminAnnouncementsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user.email)) redirect("/");

  const items = await listAllAnnouncements();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">공지 · 업데이트 발행</h1>
          <p className="mt-1 text-sm text-slate-500">
            여기서 발행한 공지는 모든 워크스페이스 홈 상단 티커에 흐릅니다. (최고 관리자 전용)
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          ← 슈퍼어드민
        </Link>
      </div>

      <AnnouncementManager initialItems={items} />
    </div>
  );
}
