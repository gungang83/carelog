-- patient_auth_links: Supabase auth user ↔ patient account (Google OAuth 가입 연결)
CREATE TABLE IF NOT EXISTS public.patient_auth_links (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_account_id  uuid NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  provider            text NOT NULL DEFAULT 'google',
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(auth_user_id),
  UNIQUE(patient_account_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_pal_auth_user ON public.patient_auth_links(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_pal_patient_account ON public.patient_auth_links(patient_account_id);

ALTER TABLE public.patient_auth_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient can read own auth link"
  ON public.patient_auth_links FOR SELECT
  USING (auth_user_id = auth.uid());

-- patient_push_subscriptions: 환자 전용 Web Push 구독 (patient_account_id 기준)
CREATE TABLE IF NOT EXISTS public.patient_push_subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_account_id  uuid NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  endpoint            text NOT NULL,
  p256dh              text NOT NULL,
  auth                text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_account_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_pps_account ON public.patient_push_subscriptions(patient_account_id);

ALTER TABLE public.patient_push_subscriptions ENABLE ROW LEVEL SECURITY;
-- 환자는 Server Action(admin client)을 통해서만 접근 — 클라이언트 직접 접근 차단
