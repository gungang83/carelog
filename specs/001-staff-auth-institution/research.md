# Research: 직원 로그인 및 의료기관 계정 구조

**Phase 0 산출물** | 작성일: 2026-05-08

---

## 결정 1: Supabase Auth 통합 방식

**Decision**: `@supabase/ssr` 패키지 기반 쿠키 세션 방식 (이미 설치됨)

**Rationale**:
- 현재 `lib/supabase/server.ts`가 이미 `createServerClient`를 쿠키 기반으로 구현
- Next.js App Router의 Server Components/Actions와 완전 호환
- 별도 패키지 추가 없이 `supabase.auth.signInWithPassword()`, `signUp()`, `signOut()` 즉시 사용 가능
- `middleware.ts` 추가로 세션 갱신 자동화

**Alternatives considered**:
- NextAuth.js: 유연하지만 Supabase RLS와 통합 복잡도 높음, 추가 의존성
- 자체 JWT: 보안 구현 부담, 불필요

**구현 패턴**:
```
app/middleware.ts          ← 모든 요청마다 세션 토큰 갱신
lib/supabase/middleware.ts ← updateSession() 헬퍼
(auth)/login/page.tsx      ← 로그인 UI
app/actions/auth.ts        ← signIn/signUp/signOut Server Actions
```

---

## 결정 2: Institution Context 조회 방식

**Decision**: 요청마다 `institution_members` 테이블 조회 + React `cache()` 메모이제이션

**Rationale**:
- Supabase JWT custom claims 방식은 Edge Function 또는 DB hook 설정 필요 → 복잡도 높음
- 단일 기관 운영 클리닉에서 쿼리 1회는 무시할 수준
- `React.cache()`로 한 요청 내 중복 쿼리 방지 가능
- 나중에 JWT claims 방식으로 마이그레이션 가능

**구현 패턴**:
```ts
// lib/auth/institution.ts
export const getMyInstitutionId = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('institution_members')
    .select('institution_id, role')
    .eq('user_id', user.id)
    .single();
  return data;
});
```

---

## 결정 3: 직원 초대 방식

**Decision**: 자체 invitation 토큰 테이블 + Supabase Auth `inviteUserByEmail()` 병행

**Rationale**:
- Supabase `inviteUserByEmail()`은 Service Role Key 필요 → `SUPABASE_SERVICE_ROLE_KEY` 환경변수 서버에만 노출
- 자체 `institution_invitations` 테이블로 기관별 초대 토큰 관리
- 초대 수락 시 토큰 검증 → Supabase Auth 회원가입 → institution_members 등록 순서

**보안 고려사항**:
- `SUPABASE_SERVICE_ROLE_KEY`는 Server Actions에서만 사용, 클라이언트 미노출
- 초대 토큰 만료 24시간, 단일 사용(accepted_at 설정 후 재사용 불가)

---

## 결정 4: RLS 격리 전략

**Decision**: DB 함수 `get_my_institution_id()` + 각 테이블 RLS 정책

**Rationale**:
- 인라인 서브쿼리보다 함수로 분리하면 정책 변경 시 한 곳만 수정
- `SECURITY DEFINER` + `STABLE`로 성능 최적화
- 기존 "전체 허용" 정책은 DROP 후 새 정책으로 교체

**RLS 함수**:
```sql
create or replace function get_my_institution_id()
returns uuid language sql security definer stable as $$
  select institution_id
  from public.institution_members
  where user_id = auth.uid()
  limit 1;
$$;
```

---

## 결정 5: 기존 데이터 마이그레이션 전략

**Decision**: 단일 "시드 기관" 생성 → 기존 레코드 일괄 귀속 → NOT NULL 제약 추가

**Rationale**:
- 현재 운영 중인 데이터를 보존하면서 새 구조로 전환하는 가장 안전한 방법
- 시드 기관 UUID를 고정값으로 사용해 멱등성(idempotent) 보장
- 마이그레이션 실행 전 백업 권고

**단계**:
1. `institutions` 테이블 생성
2. 시드 기관 INSERT (고정 UUID)
3. 기존 patient, consultation에 institution_id 컬럼 추가
4. 기존 레코드 시드 기관으로 UPDATE
5. institution_id NOT NULL 제약 추가
6. RLS 정책 교체

**롤백 계획**: NOT NULL 추가 전까지는 언제든 롤백 가능. 실행 전 Supabase 대시보드에서 DB 백업 권장.

---

## 결정 6: 라우트 구조

**Decision**: Next.js Route Groups — `(auth)` 공개 / `(dashboard)` 인증 필요

**Rationale**:
- Route Groups는 URL 경로에 영향 없이 레이아웃 분리 가능
- `(dashboard)/layout.tsx`에서 미인증 시 `/login` 리다이렉트 처리
- 기존 `/`, `/patients`, `/view` 경로는 `(dashboard)` 그룹으로 이동

**URL 구조 변경 없음**: 기존 `/, /patients/[id], /view/[id]` 경로 유지
