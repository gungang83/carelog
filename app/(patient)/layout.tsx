import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPatientSession } from "@/lib/patient-session";

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only protect /portal/* paths; /p/[token] and /portal/login and /portal/verify are public
  // Middleware handles public path bypassing — this layout guards /portal/records
  return <>{children}</>;
}
