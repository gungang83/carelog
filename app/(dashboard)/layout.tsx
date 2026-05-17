import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/footer";
import { SessionRefresher } from "@/components/layout/session-refresher";
import { getMyInstitutions, getMyInstitutionId } from "@/lib/auth/institution";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [institutions, activeInstitutionId] = await Promise.all([
    getMyInstitutions(),
    getMyInstitutionId(),
  ]);

  const userEmail = user.email ?? "";
  const userMeta = user.user_metadata as Record<string, string> | undefined;
  const userName: string | undefined = userMeta?.full_name ?? userMeta?.name;
  const userAvatarUrl: string | undefined = userMeta?.avatar_url;

  if (institutions.length > 0 && !institutions.some((i) => i.is_active)) {
    return (
      <>
        <Header
          institutions={[]}
          activeInstitutionId=""
          userEmail={userEmail}
          userName={userName}
          userAvatarUrl={userAvatarUrl}
        />
        <main className="flex flex-1 items-center justify-center p-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-slate-700 font-medium">이 기관의 접근 권한이 비활성화되었습니다.</p>
            <p className="mt-1 text-sm text-slate-500">기관 관리자에게 문의하세요.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SessionRefresher />
      <Header
        institutions={institutions}
        activeInstitutionId={activeInstitutionId ?? ""}
        userEmail={userEmail}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
      />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
