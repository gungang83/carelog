export type PatientRow = {
  id: string;
  institution_id: string;
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
  institution_id: string;
  content: string;
  /** Supabase에서 jsonb 또는 text[] 등으로 저장 가능. 배열로 주고받습니다. */
  image_urls: string[] | null;
  prescriptions: string[] | null;
  created_at: string;
};

export type InstitutionRow = {
  id: string;
  name: string;
  type: string;
  created_at: string;
};

export type InstitutionMemberRow = {
  id: string;
  institution_id: string;
  user_id: string;
  role: "owner" | "admin" | "staff";
  invited_by: string | null;
  joined_at: string;
  is_active: boolean;
};

export type InstitutionInvitationRow = {
  id: string;
  institution_id: string;
  email: string;
  role: "owner" | "admin" | "staff";
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type PatientInvitationRow = {
  id: string;
  institution_id: string;
  patient_id: string;
  phone: string;
  token: string;
  consent_given: boolean;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type PatientAccountRow = {
  id: string;
  rrn_hash: string;
  created_at: string;
  last_login_at: string | null;
};

export type PatientOtpRow = {
  id: string;
  phone: string;
  code: string;
  expires_at: string;
  verified_at: string | null;
  attempt_count: number;
  created_at: string;
};

export type PatientSessionRow = {
  id: string;
  patient_account_id: string;
  token: string;
  expires_at: string;
  created_at: string;
};

export type PatientAccountLinkRow = {
  id: string;
  patient_account_id: string;
  patient_id: string;
  institution_id: string;
  linked_at: string;
};
