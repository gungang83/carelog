# Research: Carelog 환자 앱 — 기술 결정 사항

**Feature**: 005-patient-app  
**Date**: 2026-05-17  
**Status**: Complete

---

## Decision 1: Patient OAuth Callback — 별도 라우트 사용

**Decision**: `/auth/patient-callback` 라우트를 직원용 `/auth/callback`과 분리해 새로 생성한다.

**Rationale**: 동일한 Google OAuth provider를 사용하더라도 직원 로그인과 환자 로그인은 완전히 다른 후처리가 필요하다. 직원은 `institution_members` 체크 → `/` 리디렉션, 환자는 `patient_auth_links` 연결 → `/portal/records` 리디렉션. 하나의 콜백 라우트에 두 역할을 혼합하면 `state` 파라미터 파싱 복잡도가 올라가고 디버깅이 어려워진다. 분리된 콜백 URL을 `signInWithOAuth({ redirectTo: '…/auth/patient-callback' })`에 명시하는 것으로 두 흐름을 완전히 독립 유지한다.

**Alternatives considered**:
- 기존 `/auth/callback` 재사용 + `state` 파라미터로 흐름 분기 → 콜백 로직이 복잡해짐, 거부
- `/portal/google-callback` 사용 → proxy.ts 매처 변경 필요, 불필요한 변경 증가, 거부

---

## Decision 2: patient_account_id OAuth 전달 — httpOnly 쿠키 사용

**Decision**: Google OAuth 리디렉션 직전에 `pending_patient_account_id` httpOnly 쿠키를 설정하고, `/auth/patient-callback`에서 이를 읽어 `patient_auth_links`에 INSERT한다.

**Rationale**: Supabase OAuth `state` 파라미터를 커스터마이즈하려면 `supabase.auth.signInWithOAuth({ options: { queryParams: { state: '...' } } })`를 쓸 수 있지만, Supabase가 PKCE에서 `state`를 자체적으로 사용하므로 콜리전 가능성이 있다. httpOnly 쿠키는 안전하고, 브라우저가 OAuth 리디렉션을 거치는 동안에도 유지되며, 서버에서만 읽힌다. 쿠키 만료는 5분으로 짧게 설정해 탈취 위험을 최소화한다.

**Alternatives considered**:
- OAuth `state` 파라미터에 patient_account_id 포함 → Supabase PKCE 내부 state와 혼용 위험, 거부
- `next` URL 파라미터에 포함 → client-side 노출, 거부
- localStorage → OAuth 리디렉션 후 다른 탭에서 접근 불가, 거부

---

## Decision 3: 환자 포털 인증 — Supabase 세션 우선, OTP 쿠키 폴백

**Decision**: `getPatientSession()` 함수가 다음 순서로 인증을 시도한다:
1. `patient_session_token` httpOnly 쿠키 (기존 OTP 세션)
2. Supabase 세션 (`auth.uid()`) → `patient_auth_links` 조회

**Rationale**: 기존 OTP 기반 환자 세션을 완전 유지하면서(하위 호환성), Google OAuth로 가입한 환자는 Supabase 세션으로 접근할 수 있게 한다. 두 인증 방식이 공존해야 하므로 순차적 폴백 방식을 채택한다. OTP 쿠키를 우선 체크하는 이유: OTP는 30일 세션이고 대부분의 기존 환자가 이 방식으로 로그인하기 때문.

**Alternatives considered**:
- Supabase 세션만 사용 (OTP 세션 폐기) → 기존 환자 접근 중단, 거부
- 완전히 분리된 인증 계층 → 코드 중복, 거부

---

## Decision 4: 환자 푸시 구독 — 별도 테이블 (`patient_push_subscriptions`)

**Decision**: 기존 `push_subscriptions` (직원용, institution_id 포함)과 별도로 `patient_push_subscriptions` 테이블을 신설한다. 키는 `patient_account_id`이다.

**Rationale**: 직원 푸시는 기관 단위(institution_id)로 묶여 `sendPushToInstitution()`이 일괄 발송한다. 환자 푸시는 개인 단위(`patient_account_id`)이고 새 상담 기록이 저장될 때 해당 환자에게만 발송한다. 두 도메인의 비즈니스 로직이 다르므로 테이블 분리가 맞다. 기존 `push_subscriptions` RLS 정책(`user_id = auth.uid()`)은 OTP 세션만 있는 환자(auth.uid() 없음)에는 적용할 수 없다.

**Alternatives considered**:
- `push_subscriptions`에 `patient_account_id` 컬럼 추가 → nullable 컬럼 증가, RLS 복잡화, 거부
- `push_subscriptions`의 `user_id`에 환자 auth user id 사용 → Google 가입 환자만 지원, OTP 세션 환자 제외, 거부

---

## Decision 5: 이중 역할 전환 — 헤더에 "내 진료 기록" 링크

**Decision**: 직원 대시보드 헤더에 "내 진료 기록" 링크를 추가한다. 클릭 시:
1. Google OAuth 흐름 시작 (redirectTo: `/auth/patient-callback`)
2. 콜백에서 `patient_auth_links` 체크 → 연결 있으면 `/portal/records` 리디렉션
3. 연결 없으면 → `/portal/verify-link` 페이지에서 OTP 인증 후 계정 연결 안내

단, `/portal/records`는 Supabase 세션 체크로 접근하므로 직원 Google 계정으로 로그인 완료 후 곧바로 환자 기록이 보인다.

**Alternatives considered**:
- 별도 계정 전환 API → 세션 관리 복잡도 증가, 거부
- 직원 계정에서 직접 환자 기록 URL 노출 → 보안 레이어 우회 가능성, 거부

---

## Decision 6: Google OAuth 인증 흐름 — Supabase `signInWithOAuth`

**Decision**: 기존 직원 Google 로그인과 동일한 Supabase OAuth provider를 사용한다. 환자용 Google 로그인은 `lib/supabase/client.ts`의 브라우저 클라이언트에서 `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '/auth/patient-callback' } })`를 호출한다.

**Rationale**: 별도 Google OAuth 앱 등록 없이 기존 Supabase 설정을 재사용할 수 있다. Supabase Auth가 PKCE 흐름과 세션 관리를 담당하므로 구현이 단순하다.

**Alternatives considered**:
- Google OAuth SDK 직접 사용 → 추가 설정 비용, 거부
- Kakao OAuth 동시 구현 → v1 범위 초과, spec에 따라 추후 추가

---

## Next.js 16 주의사항

- `proxy.ts`의 matcher 배열에 `/auth/patient-callback` 경로가 포함되어야 세션 갱신이 동작한다 (현재 `/auth/callback`만 제외 처리 — patient-callback은 세션 처리가 필요하므로 매처에 포함).
- `app/(patient)/` 라우트 그룹은 Supabase 미들웨어가 세션을 주입하지 않는 경로이므로, 환자 포털에서 Supabase 서버 클라이언트를 사용할 때는 `createServerSupabaseClient()`가 쿠키 컨텍스트를 올바르게 읽는지 확인 필요.
- `app/manifest.ts`는 이미 구현되어 있어 PWA 지원은 기존 코드 활용.
