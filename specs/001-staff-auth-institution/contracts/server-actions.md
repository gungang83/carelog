# Server Action Contracts: 직원 로그인 및 의료기관 계정 구조

**Phase 1 산출물** | 작성일: 2026-05-08

모든 Server Actions는 `{ ok: true, ... } | { ok: false; message: string }` 형태 반환 (Constitution III).

---

## `app/actions/auth.ts`

### `signUp(formData: FormData)`

회원가입 + 기관 등록 (첫 오너 계정 생성)

**입력**: `email`, `password`, `institution_name`  
**처리 순서**:
1. Supabase `auth.signUp()` 호출
2. `institutions` 레코드 INSERT
3. `institution_members` 레코드 INSERT (role: 'owner')
4. `/` 로 redirect

**반환**:
```ts
{ ok: true; user: User; institution: InstitutionRow }
| { ok: false; message: string }
```

---

### `signIn(formData: FormData)`

이메일+비밀번호 로그인

**입력**: `email`, `password`  
**처리**: Supabase `auth.signInWithPassword()` → 성공 시 `/` redirect  
**반환**:
```ts
{ ok: true }
| { ok: false; message: string }
// 예: "이메일 또는 비밀번호가 올바르지 않습니다."
```

---

### `signOut()`

로그아웃

**처리**: Supabase `auth.signOut()` → `/login` redirect  
**반환**: `{ ok: true }`

---

## `app/actions/institutions.ts`

### `inviteStaff(formData: FormData)`

직원 이메일 초대 (owner/admin만 호출 가능)

**입력**: `email`, `role` ('staff' | 'admin')  
**처리 순서**:
1. 호출자 권한 확인 (owner/admin 아니면 거부)
2. 중복 초대 확인 (이미 수락된 초대 있으면 안내)
3. `institution_invitations` INSERT
4. Supabase `auth.admin.inviteUserByEmail()` 호출 (redirect_to: `/invite/[token]`)

**반환**:
```ts
{ ok: true; invitation: InstitutionInvitationRow }
| { ok: false; message: string }
```

---

### `acceptInvitation(formData: FormData)`

초대 수락 (비밀번호 설정 + 기관 가입)

**입력**: `token`, `password`  
**처리 순서**:
1. `institution_invitations`에서 token 조회
2. 만료 여부 확인 (`expires_at < now()`)
3. 이미 수락 여부 확인 (`accepted_at IS NOT NULL`)
4. Supabase 세션에서 `auth.user` 확인 (초대 이메일로 이미 인증된 상태)
5. `institution_members` INSERT
6. `institution_invitations.accepted_at` 업데이트
7. `/` redirect

**반환**:
```ts
{ ok: true }
| { ok: false; message: string }
// 예: "초대 링크가 만료되었습니다.", "이미 사용된 초대입니다."
```

---

### `getMyInstitution()`

현재 로그인 사용자의 기관 정보 조회

**처리**: `institution_members` → `institutions` JOIN  
**반환**:
```ts
{ ok: true; institution: InstitutionRow; role: 'owner' | 'admin' | 'staff' }
| { ok: false; message: string }
```

---

## `middleware.ts` (Next.js 미들웨어)

**역할**: 모든 요청에서 Supabase 세션 갱신  
**인증 필요 경로**: `/`, `/patients/*`, `/view/*`  
**공개 경로**: `/login`, `/signup`, `/invite/*`  
**미인증 접근 시**: `/login?redirect=[원래 경로]` 로 리다이렉트

---

## 환경변수 추가 필요

```env
# Service Role Key (직원 초대 이메일 발송용, 서버 전용)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> `NEXT_PUBLIC_` 접두사 없이 선언 — 클라이언트에 절대 노출 금지
