/** 앱이 기대하는 컬럼 이름입니다. 테이블이 다르면 Supabase에서 맞추거나 코드의 insert/select 필드를 수정하세요. */
export type PatientRow = {
  id: string;
  name: string;
  chart_no: string | null;
  phone: string | null;
  /** 13자리 숫자 문자열(하이픈 없음). 클라이언트 표시는 반드시 마스킹. */
  resident_no: string | null;
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
