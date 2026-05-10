# Server Action Contracts: 환자 포털

**File**: `app/actions/patient-portal.ts`  
**File**: `app/actions/sms.ts`

모든 액션은 `"use server"` 지시어 포함.  
모든 뮤테이션 액션은 `{ ok: true, ... } | { ok: false, message: string }` 반환.

---

## 직원 측 액션

### `sendPatientInvitation`

직원이 환자에게 케어로그 가입 초대 문자를 발송한다.

```typescript
sendPatientInvitation(formData: FormData): Promise<
  | { ok: true; invitation: PatientInvitationRow }
  | { ok: false; message: string }
>

// formData 필드:
// - patient_id: string (bigint ID)
// - phone: string (전화번호, 하이픈 포함/미포함 모두 허용)
// - consent_given: "true" (개인정보 제공 동의)
```

**처리 순서**:
1. 로그인 직원 확인 (`getMyInstitutionId`)
2. `consent_given === "true"` 검증
3. 전화번호 정규화 (하이픈 제거, 010으로 시작 검증)
4. 기존 미수락 초대 무효화 (`expires_at = now()`)
5. `patient_invitations` INSERT (admin client)
6. Solapi SMS 발송: `"[기관명] 상담 내역 확인하기: {URL}/p/{token}"`
7. SMS 발송 실패 시 초대 레코드 삭제 후 오류 반환

---

## 환자 측 액션

### `requestPatientOtp`

주민번호 해시로 본인을 확인한 뒤 입력된 전화번호로 OTP를 발송한다.

```typescript
requestPatientOtp(formData: FormData): Promise<
  | { ok: true }
  | { ok: false; message: string; retryAfterSeconds?: number }
>

// formData 필드:
// - rrn_front: string   (주민번호 앞 6자리)
// - rrn_back: string    (주민번호 뒤 7자리)
// - phone: string       (OTP 수신 전화번호)
// - invitation_token?: string (초대 링크에서 왔을 때 — 본인 확인 기준)
```

**처리 순서**:
1. 전화번호 정규화 및 형식 검증
2. `rrn_front + rrn_back` → `hashResidentNoForMatching()` → `rrnHash`
3. `invitation_token` 있을 때:
   - 초대 레코드 조회 → `patient_id` 확인
   - `patient.resident_no_hash === rrnHash` 검증 → 불일치 시 오류 ("입력 정보가 일치하지 않습니다")
4. `invitation_token` 없을 때 (재방문 로그인):
   - `patient_accounts` WHERE `rrn_hash = rrnHash` 조회 → 없으면 오류 ("가입된 계정이 없습니다")
5. 최근 10분 내 `attempt_count >= 3` 인 OTP 존재 시 잠금 오류 반환
6. 기존 미사용 OTP 무효화
7. 6자리 랜덤 숫자 코드 생성
8. `patient_otps` INSERT (phone, code, admin client)
9. Solapi SMS: `"[케어로그] 인증번호: {code} (5분 이내 입력)"`

---

### `verifyPatientOtp`

OTP를 검증하고 세션을 생성한다. 계정 생성 및 환자-계정 연결도 처리.

```typescript
verifyPatientOtp(formData: FormData): Promise<
  | { ok: true; isNewAccount: boolean }
  | { ok: false; message: string }
>

// formData 필드:
// - phone: string
// - code: string (6자리)
// - rrn_hash: string (requestPatientOtp에서 계산된 해시, hidden field로 전달)
// - invitation_token?: string
```

**처리 순서**:
1. 유효한 OTP 조회 (`phone`, `expires_at > now()`, `verified_at IS NULL`)
2. `attempt_count` 증가, `attempt_count >= 3` 시 잠금 오류
3. code 불일치 시 오류 반환
4. OTP `verified_at = now()` 업데이트
5. `patient_accounts` WHERE `rrn_hash` 조회 → 없으면 INSERT (신규 계정)
6. `patient_sessions` 생성 → `patient_session_token` 쿠키 설정 (30일, HttpOnly, Secure)
7. `invitation_token` 있으면:
   - 초대 유효성 재검증 (만료/수락 여부)
   - `patient_account_links` INSERT ON CONFLICT DO NOTHING
   - `patient_invitations.accepted_at = now()`

---

### `getPatientRecords`

로그인한 환자의 모든 상담 내역을 반환한다.

```typescript
getPatientRecords(): Promise<
  | { ok: true; records: PatientRecordItem[] }
  | { ok: false; message: string }
>

// PatientRecordItem:
// {
//   consultationId: string,
//   institutionName: string,
//   date: string,          // ISO 8601
//   content: string,
//   imageUrls: string[],
//   prescriptions: string[],
//   stationName: string | null,
//   patientName: string,
// }
```

**처리 순서**:
1. 쿠키에서 `patient_session_token` 읽기
2. `patient_sessions` 조회 → 만료 또는 없으면 오류
3. `patient_account_links`에서 연결된 `patient_id` 목록 조회
4. 각 patient_id에 연결된 `consultation` 조회 (institution_id 포함)
5. `institutions.name` JOIN
6. 전체 결과 최신순 정렬 후 반환

---

### `patientLogout`

환자 세션을 종료한다.

```typescript
patientLogout(_formData?: FormData): Promise<void>
// 쿠키 삭제 + patient_sessions 레코드 삭제 + /portal/login 리다이렉트
```

---

## SMS 발송 유틸

**File**: `lib/sms/solapi.ts`

```typescript
sendSms(to: string, text: string): Promise<{ ok: true } | { ok: false; message: string }>
// to: 수신 번호 (01012345678 형식)
// text: 발송할 메시지 (90바이트 이내 단문, 초과 시 장문 자동)
```

---

## 미들웨어 확장

`lib/supabase/middleware.ts`의 `updateSession` 내 공개 경로에 추가:

```typescript
const isPublicPath =
  pathname.startsWith("/login") ||
  pathname.startsWith("/signup") ||
  pathname.startsWith("/invite") ||
  pathname.startsWith("/auth/callback") ||
  pathname.startsWith("/p/") ||           // 환자 초대 링크
  pathname.startsWith("/portal/login") || // 환자 로그인
  pathname.startsWith("/portal/verify");  // OTP 입력
```

`/portal/records` 등 보호 경로는 `patient_session_token` 쿠키 검증 로직 추가.
