import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";
import { DentalLibrary } from "@/components/dental/dental-library";

// 치아 도식 라이브러리 보관함 (슈퍼어드민 전용) — 방향·치식 범위·색을 바꿔 보고 편집용 SVG로 내려받는다.
// 원본 = lib/dental/teeth.ts · 고정 파일 = public/dental-svg/ (scripts/export-dental-svg.mts로 생성)
export default async function AdminDentalPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user.email)) redirect("/");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">치아 도식 라이브러리</h1>
          <p className="mt-1 text-sm text-slate-500">
            Carelog가 직접 그린 해부학적 치아 SVG입니다. 색을 바꿔 내려받아 상담자료에 쓰세요. 치아마다 치식 번호(FDI)가 붙어 있어
            일러스트레이터·피그마에서 치아별로 골라 고칠 수 있습니다. (최고 관리자 전용)
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          ← 슈퍼어드민
        </Link>
      </div>

      <DentalLibrary />
    </div>
  );
}
