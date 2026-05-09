import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";

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

  const { data } = await supabase
    .from("institution_members")
    .select("institutions(name)")
    .eq("user_id", user.id)
    .maybeSingle();

  const inst = (data?.institutions as unknown) as { name: string } | null;
  const institutionName = inst?.name ?? "Carelog";

  return (
    <>
      <Header institutionName={institutionName} />
      <main className="flex-1">{children}</main>
    </>
  );
}
