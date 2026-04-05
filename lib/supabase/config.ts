/** Supabase Table Editor / SQL에서 쓰는 테이블 이름과 동일하게 맞추세요. (PostgreSQL은 따옴표 없이 만들면 소문자로 저장되는 경우가 많습니다.) */
export const patientTable =
  (process.env.NEXT_PUBLIC_SUPABASE_PATIENT_TABLE ?? "patient").toLowerCase();
export const consultationTable =
  (process.env.NEXT_PUBLIC_SUPABASE_CONSULTATION_TABLE ?? "consultation").toLowerCase();

export const consultationBucket =
  process.env.NEXT_PUBLIC_SUPABASE_CONSULTATION_BUCKET ?? "consultation-images";
