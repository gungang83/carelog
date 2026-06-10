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
  patient_id: number | null;
  institution_id: string;
  content: string;
  /** Supabase에서 jsonb 또는 text[] 등으로 저장 가능. 배열로 주고받습니다. */
  image_urls: string[] | null;
  prescriptions: string[] | null;
  station_name: string | null;
  status: "draft" | "confirmed";
  sms_sent_at: string | null;
  created_at: string;
  chair_id: string | null;
  linked_at: string | null;
  linked_by: string | null;
  participants: Participant[];
  /** 작성자 귀속(계약 §2.3) — EO 직원 id(있으면)와 표시명. */
  author_employee_id: string | null;
  author_name: string | null;
};

export type ChairRow = {
  id: string;
  institution_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

export type ClinicMemberRow = {
  id: string;
  institution_id: string;
  name: string;
  /** 예: 원장 / 직원 / 위생사 (선택). EO source는 position을 우선 노출. */
  role: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  // EO 마스터 캐시 필드 (migration: 20260608000001_eo_integration.sql)
  /** EO members[].id — upsert 키(불변). manual 행은 null. */
  eo_employee_id: string | null;
  email: string | null;
  /** clinic_admin | manager | staff */
  eo_role: string | null;
  position: string | null;
  /** 'manual'(수동 추가) | 'eo'(게이트웨이 동기화) */
  source: "manual" | "eo";
  synced_at: string | null;
};

/** 상담 기록에 저장되는 참여자 스냅샷(기록 시점 값 보존) */
export type Participant = {
  id: string;
  name: string;
  role: string | null;
};

export type ChairAuditLogRow = {
  id: string;
  institution_id: string;
  chair_id: string | null;
  consultation_id: string | null;
  event_type:
    | "record_created"
    | "record_transcribed"
    | "record_edited"
    | "patient_linked"
    | "record_deleted";
  actor_user_id: string;
  patient_id_before: number | null;
  patient_id_after: number | null;
  metadata: Record<string, unknown>;
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
  // EO SSO 작성자 귀속 (migration: 20260608000001_eo_integration.sql)
  /** SSO JWT employee_id — 공용계정이면 null. */
  eo_employee_id: string | null;
  /** SSO JWT name — 작성자 표시명. */
  display_name: string | null;
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

export type PatientAuthLinkRow = {
  id: string;
  auth_user_id: string;
  patient_account_id: string;
  provider: string;
  created_at: string;
};

export type PatientPushSubscriptionRow = {
  id: string;
  patient_account_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};
