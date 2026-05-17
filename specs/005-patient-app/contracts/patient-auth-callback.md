# Contract: GET /auth/patient-callback

**Type**: Next.js Route Handler  
**File**: `app/auth/patient-callback/route.ts`  
**Purpose**: Google OAuth 완료 후 환자 계정 연결 및 포털 리디렉션

---

## Request

```
GET /auth/patient-callback?code=<oauth_code>&next=<optional_path>
```

| 파라미터 | 필수 | 설명 |
|----------|------|------|
| `code`   | 예   | Supabase OAuth PKCE 코드 |
| `next`   | 아니오 | 로그인 후 리디렉션 경로 (기본: `/portal/records`) |

쿠키 (서버에서 읽음):
- `pending_patient_account_id` (httpOnly, 5분 만료) — OTP 세션에서 넘어온 patient_account_id. 있으면 신규 연결, 없으면 기존 연결 조회.

---

## 처리 흐름

```
1. supabase.auth.exchangeCodeForSession(code)
   └─ 실패 → redirect /portal/login?error=auth_failed

2. auth_user_id = data.user.id

3. pending = cookie('pending_patient_account_id')

4a. pending 있음 (신규 가입):
    └─ patient_auth_links INSERT (auth_user_id, pending, 'google')
       ├─ UNIQUE 충돌 → 이미 연결됨, 무시하고 계속
       └─ 성공 → pending 쿠키 삭제

4b. pending 없음 (재로그인):
    └─ patient_auth_links SELECT WHERE auth_user_id = auth_user_id
       └─ 없음 → redirect /portal/link-account (계정 연결 안내)

5. redirect /portal/records
```

---

## Response

| 조건 | 리디렉션 대상 |
|------|--------------|
| 성공 (신규 연결) | `/portal/records` |
| 성공 (기존 연결) | `/portal/records` |
| 연결된 계정 없음 | `/portal/link-account` |
| OAuth 오류 | `/portal/login?error=auth_failed` |

---

## 보안

- `code`는 서버에서 한 번만 교환 (PKCE)
- `pending_patient_account_id` 쿠키: httpOnly, Secure, SameSite=Lax, maxAge=300 (5분)
- 콜백 완료 후 `pending_patient_account_id` 쿠키 즉시 삭제
