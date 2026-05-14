const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL ?? "mobys0416@gmail.com";

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return email === SUPER_ADMIN_EMAIL;
}
