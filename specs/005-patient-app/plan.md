# Implementation Plan: Carelog 환자 앱

**Branch**: `main` | **Date**: 2026-05-17 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/005-patient-app/spec.md`

---

## Summary

SMS 초대 링크 → OTP 인증 → 상담 내역 확인 → Google OAuth 가입의 흐름을 구현한다. Google 가입 완료 후에는 `patient_auth_links` 테이블로 Supabase auth user와 patient_accounts를 연결해 영구 환자 계정을 생성한다. 이후 방문 시 Google 로그인만으로 `/portal/records`에 접근할 수 있다. 동일 Google 계정으로 직원과 환자 역할을 동시에 수행할 수 있으며(이중 역할), 환자 전용 푸시 알림은 `patient_push_subscriptions` 테이블을 신설해 기관 단위 직원 푸시와 분리 운영한다.

---

## Technical Context

**Language/Version**: TypeScript 5 strict / Next.js 16.2.2 App Router  
**Primary Dependencies**: Supabase Auth (Google OAuth), web-push (VAPID), Tailwind CSS v4  
**Storage**: Supabase PostgreSQL — 신규 테이블 2개 (patient_auth_links, patient_push_subscriptions)  
**Testing**: 브라우저 + Supabase 대시보드 수동 테스트 (unit test 범위 외)  
**Target Platform**: Vercel Edge/Serverless + 모바일 브라우저 (PWA)  
**Project Type**: Web application (Next.js Full Stack)  
**Performance Goals**: 가입 완료 → 기록 표시 30초 이내, 재로그인 10초 이내, 푸시 5초 이내  
**Constraints**: Vercel 함수 실행시간 < 10s, TypeScript strict 준수, 기존 OTP 흐름 하위 호환 유지  
**Scale/Scope**: 환자 수백 명 규모 (치과 단일 기관 기준)

---

## Constitution Check

- [X] **I. Patient Privacy First** — patient_auth_links에 `rrn_hash`를 저장하지 않는다. auth_user_id(UUID) 만 저장. /portal/records 화면에서도 주민번호 표시 없음. pending_patient_account_id 쿠키는 UUID만 포함, httpOnly/Secure 설정.
- [X] **II. Server-Side Data Authority** — patient_auth_links INSERT, patient_push_subscriptions UPSERT 모두 Server Action 또는 Route Handler에서만 발생. 클라이언트 컴포넌트는 Google OAuth URL 리디렉션만 트리거.
- [X] **III. Clinical Reliability** — 모든 신규 Server Action은 `{ ok, message }` 반환. 상담 저장 후 patient push는 fire-and-forget (실패 시 상담 저장에 영향 없음). 마이그레이션 파일 필수.
- [X] **IV. Simplicity Over Abstraction** — getPatientSession() 하나에 OTP+Supabase 세션 폴백 통합 (별도 함수 추가 없음). patient_auth_links 연결 로직은 /auth/patient-callback route handler에 인라인.
- [X] **V. Spec-Driven Development** — specs/005-patient-app/spec.md 존재하고 requirements.md 체크리스트 전부 통과.
- [X] **VI. Documentation as Living Artifact** — 마무리 시 project_status.md, docs/architecture.md, docs/database.md, supabase/schema.sql 업데이트 필수.

---

## Project Structure

### Documentation (this feature)

```text
specs/005-patient-app/
├── plan.md              # 이 파일
├── research.md          # 기술 결정 사항
├── data-model.md        # 신규 테이블 스키마
├── quickstart.md        # 테스트 시나리오
├── contracts/
│   ├── patient-auth-callback.md   # /auth/patient-callback 라우트
│   └── patient-portal-actions.md  # 환자 Server Actions
└── tasks.md             # /speckit-tasks 출력 (미생성)
```

### Source Code Changes

```text
app/
├── auth/
│   └── patient-callback/
│       └── route.ts              # 신규: Google OAuth 환자 콜백 라우트
├── (patient)/
│   └── portal/
│       ├── login/
│       │   └── page.tsx          # 수정: Google 로그인 버튼 추가
│       ├── records/
│       │   └── page.tsx          # 수정: Supabase 세션 인증 지원
│       ├── signup-cta/
│       │   └── page.tsx          # 신규: OTP 후 Google 가입 유도 화면
│       └── link-account/
│           └── page.tsx          # 신규: Google 로그인 후 계정 연결 안내
└── actions/
    └── patient-portal.ts         # 수정: initiatePatientGoogleSignup, getPatientAuthStatus,
                                  #        subscribePatientPush, unsubscribePatientPush, sendPushToPatient

components/
└── patient/
    ├── patient-otp-form.tsx      # 수정: isNewAccount에 따라 signup-cta로 리디렉션
    ├── patient-login-form.tsx    # 수정: Google 로그인 버튼 추가
    ├── patient-signup-cta.tsx    # 신규: Google 가입 CTA 버튼 (Client Component)
    └── patient-push-banner.tsx   # 신규: 환자용 푸시 알림 구독 배너

lib/
├── patient-session.ts            # 수정: Supabase 세션 폴백 추가
└── types/database.ts             # 수정: PatientAuthLinkRow, PatientPushSubscriptionRow 추가

supabase/
├── migrations/
│   └── 20260517000002_patient_auth_links.sql  # 신규: 2개 테이블
└── schema.sql                    # 동기화

(dashboard)/
└── layout.tsx or header.tsx      # 수정: "내 진료 기록" 링크 추가 (이중 역할 US4)
```

---

## Implementation Strategy

### Phase 1 — Foundation (차단 없음, 즉시 시작)
DB 마이그레이션 + 타입 정의. 이후 모든 US의 전제조건.

### Phase 2 — User Story 1 (P1): SMS → Google 가입 완료
`/auth/patient-callback` 라우트 + `initiatePatientGoogleSignup` action + `/portal/signup-cta` 페이지 + `patient-signup-cta` 컴포넌트 + `getPatientSession()` 업데이트.

### Phase 3 — User Story 2 (P2): 환자 앱 전체 진료 이력
`/portal/records` 페이지 Supabase 세션 인증 지원 + `/portal/login` Google 로그인 버튼.

### Phase 4 — User Story 3 (P3): 새 상담 → 환자 푸시 알림
`patient_push_subscriptions` 테이블 활용 + `sendPushToPatient` action + `consultations.ts` 연동 + `patient-push-banner.tsx` 컴포넌트.

### Phase 5 — User Story 4 (P4): 이중 역할
직원 헤더에 "내 진료 기록" 링크 + `/portal/records`에 "직원 화면으로" 링크.

### Phase 6 — Polish
docs 업데이트, 빌드 검증, 마무리 프로토콜.

---

## Key Integration Points

### `/auth/patient-callback` route handler 핵심 로직

```
code → supabase.auth.exchangeCodeForSession(code)
     → auth_user_id = session.user.id
     → pending_cookie = cookies().get('pending_patient_account_id')
     → if pending:
         patient_auth_links INSERT (auth_user_id, pending, 'google')
         delete pending cookie
         redirect /portal/records
       else:
         patient_auth_links SELECT WHERE auth_user_id
         if found → redirect /portal/records
         else → redirect /portal/link-account
```

### `getPatientSession()` 업데이트 로직

```typescript
// 1단계: OTP 쿠키
const token = cookies.get('patient_session_token')?.value
if (token) { /* 기존 patient_sessions 조회 */ }

// 2단계: Supabase 세션 (선택적 인자)
if (supabaseClient) {
  const { data } = await supabaseClient.auth.getUser()
  if (data.user) {
    const link = await admin.from('patient_auth_links')
      .select('patient_account_id')
      .eq('auth_user_id', data.user.id).maybeSingle()
    if (link) return { patientAccountId: link.patient_account_id }
  }
}
return null
```

### consultations.ts 환자 푸시 연동 (fire-and-forget)

```typescript
// 상담 저장 성공 후:
const links = await admin.from('patient_account_links')
  .select('patient_account_id')
  .eq('patient_id', patientId)
  .maybeSingle()
if (links?.patient_account_id) {
  sendPushToPatient(links.patient_account_id, {
    title: '새 진료 기록',
    body: `${patientName} — ${preview}`,
    url: `/portal/records`,
  }).catch(() => {})
}
```

---

## Complexity Tracking

| 항목 | 이유 | 단순화 대안이 부족한 이유 |
|------|------|--------------------------|
| `/auth/patient-callback` 별도 라우트 | 직원·환자 OAuth 후처리 완전히 다름 | 단일 콜백에 분기하면 상태 관리 복잡도 상승 |
| `getPatientSession()` 이중 인증 | OTP 환자와 Google 환자 동시 지원 필요 | 기존 OTP 환자를 강제 마이그레이션 불가 |
