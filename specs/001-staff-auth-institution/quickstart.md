# 구현 퀵스타트: 직원 로그인 및 의료기관 계정 구조

**Phase 1 산출물** | 작성일: 2026-05-08

---

## 구현 전 체크리스트

- [ ] `SUPABASE_SERVICE_ROLE_KEY` 환경변수 확인 (Supabase 대시보드 → Settings → API)
- [ ] Supabase 이메일 발송 설정 확인 (Authentication → Email Templates)
- [ ] DB 백업 (Supabase 대시보드 → Database → Backups)

---

## 구현 순서 (의존성 순)

### 1단계: DB 마이그레이션 (Supabase 대시보드에서 직접 실행)

`data-model.md`의 마이그레이션 SQL을 Supabase SQL Editor에서 단계별로 실행.
각 Step 후 데이터 확인 권장.

---

### 2단계: 미들웨어 + 라우트 구조

```
app/
├── middleware.ts                    ← 새로 생성
├── (auth)/
│   ├── login/
│   │   └── page.tsx                ← 새로 생성
│   ├── signup/
│   │   └── page.tsx                ← 새로 생성
│   └── invite/
│       └── [token]/
│           └── page.tsx            ← 새로 생성
└── (dashboard)/
    ├── layout.tsx                  ← 새로 생성 (인증 체크)
    ├── page.tsx                    ← 기존 app/page.tsx 이동
    ├── patients/                   ← 기존 app/patients/ 이동
    └── view/                       ← 기존 app/view/ 이동
```

**주의**: Route Group 이동 시 URL 경로 변경 없음 (`/`, `/patients/[id]` 유지).

---

### 3단계: lib 파일

```
lib/
├── supabase/
│   └── middleware.ts    ← updateSession() 헬퍼 (Supabase 공식 패턴)
└── auth/
    └── institution.ts   ← getMyInstitutionId() cache 함수
```

---

### 4단계: Server Actions

```
app/actions/
├── auth.ts              ← signUp, signIn, signOut
└── institutions.ts      ← inviteStaff, acceptInvitation, getMyInstitution
```

---

### 5단계: UI 컴포넌트

```
components/
├── auth/
│   ├── login-form.tsx
│   ├── signup-form.tsx
│   └── invite-form.tsx
└── layout/
    └── header.tsx       ← 기관명 + 로그아웃 버튼
```

---

## 기존 Server Actions 수정 포인트

모든 기존 액션에서 `institution_id` 필터 추가 필요:

```ts
// 수정 전
const { data } = await supabase.from('patient').select(...)

// 수정 후
const institutionId = await getMyInstitutionId();
const { data } = await supabase
  .from('patient')
  .select(...)
  .eq('institution_id', institutionId)
```

**영향받는 파일**:
- `app/actions/patients.ts` — searchPatients, getPatientById, createPatient, updatePatient
- `app/actions/consultations.ts` — 모든 함수

---

## 구현 후 검증 시나리오

1. `/signup` → 이메일+비밀번호+기관명 → 대시보드 진입, 기관명 헤더 표시
2. `/login` → 로그인 → 기존 환자 데이터 정상 조회
3. 로그아웃 → `/login` 리다이렉트
4. 직원 초대 → 이메일 수신 → 초대 링크 클릭 → 비밀번호 설정 → 로그인 → 환자 데이터 접근
5. 미인증 상태에서 `/` 접근 → `/login` 자동 리다이렉트
