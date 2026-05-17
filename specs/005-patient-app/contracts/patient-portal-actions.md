# Contract: Patient Portal Server Actions

**File**: `app/actions/patient-portal.ts` (기존 파일 확장)  
**Convention**: 모든 Server Action은 `{ ok: true, ... } | { ok: false, message: string }` 반환

---

## 기존 Actions (변경 없음)

- `sendPatientInvitation(formData)` — 직원이 환자에게 SMS 초대 발송
- `requestPatientOtp(formData)` — OTP 요청
- `verifyPatientOtp(formData)` — OTP 검증 + patient_session 생성
- `getPatientRecords()` — 연결된 모든 기관 상담 기록 조회
- `patientLogout()` — 환자 세션 삭제 + 리디렉션

---

## 신규 Actions

### `initiatePatientGoogleSignup(patientAccountId: string): Promise<{ ok: true; url: string } | { ok: false; message: string }>`

**목적**: Google OAuth URL을 생성하고 `pending_patient_account_id` 쿠키를 설정한다.

**입력**:
- `patientAccountId`: OTP 인증 완료된 patient_accounts.id

**처리**:
1. `patient_accounts` 조회로 patientAccountId 유효성 확인
2. `pending_patient_account_id` httpOnly 쿠키 설정 (5분 만료)
3. `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '/auth/patient-callback' } })` 호출
4. OAuth URL 반환

**반환**:
```typescript
{ ok: true; url: string }       // Google OAuth URL로 클라이언트가 리디렉션
{ ok: false; message: string }  // 오류
```

---

### `getPatientAuthStatus(): Promise<{ ok: true; patientAccountId: string; isGoogleLinked: boolean } | { ok: false; message: string }>`

**목적**: 현재 세션(OTP 쿠키 또는 Supabase 세션)에서 환자 인증 상태 확인.

**처리**:
1. `patient_session_token` 쿠키 → `patient_sessions` 조회
2. 없으면 Supabase `auth.uid()` → `patient_auth_links` 조회
3. `patient_auth_links`에 이 patientAccountId와 'google' provider가 있는지 확인

**반환**:
```typescript
{
  ok: true;
  patientAccountId: string;
  isGoogleLinked: boolean;  // Google 계정 연결 여부
}
{ ok: false; message: string }  // 미인증
```

---

### `subscribePatientPush(sub: PushSubscriptionJSON): Promise<{ ok: true } | { ok: false; message: string }>`

**목적**: 현재 환자 세션의 patient_account_id로 `patient_push_subscriptions`에 구독 등록.

**입력**: `PushSubscriptionJSON` (endpoint, keys.p256dh, keys.auth)

**처리**:
1. 현재 환자 세션 확인 (OTP 쿠키 또는 Supabase 세션)
2. `patient_push_subscriptions` UPSERT (patient_account_id, endpoint)

---

### `unsubscribePatientPush(endpoint: string): Promise<{ ok: true } | { ok: false; message: string }>`

**목적**: 현재 환자의 특정 endpoint 구독 삭제.

---

### `sendPushToPatient(patientAccountId: string, payload: PushPayload): Promise<void>`

**목적**: 특정 환자의 모든 등록 기기에 푸시 알림 발송. `saveConsultation()` Server Action 내에서 fire-and-forget으로 호출.

**입력**:
- `patientAccountId`: 알림 수신 대상
- `payload`: `{ title: string; body: string; url: string }`

**처리**:
1. `patient_push_subscriptions` WHERE patient_account_id = patientAccountId (admin client)
2. 각 구독에 `web-push.sendNotification()` 호출
3. 410/404 응답 시 해당 구독 자동 삭제

**호출 위치**: `app/actions/consultations.ts` — 상담 저장 성공 후 (await 없이)

---

## 타입 정의 (lib/types/database.ts에 추가)

```typescript
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
```
