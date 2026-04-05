/** 앱이 기대하는 컬럼 이름입니다. 테이블이 다르면 Supabase에서 맞추거나 코드의 insert/select 필드를 수정하세요. */
export type PatientRow = {
  id: string;
  name: string;
  chart_no: string | null;
  phone: string | null;
  created_at: string;
};

export type ConsultationRow = {
  id: string;
  patient_id: string;
  content: string;
  /** Supabase에서 jsonb 또는 text[] 등으로 저장 가능. 배열로 주고받습니다. */
  image_urls: string[] | null;
  prescriptions: string[] | null;
  created_at: string;
};
