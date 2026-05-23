import { getPatientSession } from "@/lib/patient-session";
import { PatientHeader } from "@/components/patient/patient-header";
import { Footer } from "@/components/footer";

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPatientSession();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PatientHeader isLoggedIn={!!session} />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </div>
  );
}
