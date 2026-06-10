# 핸드오프 카드 235 — EO↔Carelog 연동 (게이트웨이 마스터 ① + SSO 보정 ② + 작성자 귀속 ③)

> **이 문서 하나로 새 세션이 맥락 재설명 없이 착수할 수 있게 작성됨.**
> 새 세션은 carelog 스코프라 EO 레포(`specs/016-carelog-integration/contracts/eo-gateway-and-sso.md`)를 못 본다 → **계약 전문을 이 카드 §5에 임베드**한다.

```
┌─ 핸드오프 카드 235 ──────────────────────
[발신→수신] 다온 → 다온 (새 세션)
[성격]      🟡 일반 · 신규기능 · 큰기능
[지시]      specs/000-backlog/card-235-eo-gateway-sso.md 읽고, §6 구현계획 ①부터 착수
[착수 전]   설계 확정됨(아래) — 미결 없음. 환경변수 CARELOG_GATEWAY_SECRET 양쪽 Vercel 등록은 배포 시
[브랜치]    claude/dreamy-cerf-7LI1q (또는 새 세션 배정 브랜치) → dev → main
└────────────────────────────────────────
```

---

## 1. 한 줄 요약

EO가 직원·클리닉 **마스터(SSOT)**. Carelog는 **HTTP로 받아 캐시**(읽기 사본)하고, EO SSO로 로그인된 세션에서 상담을 **Carelog 내부에** 작성·열람한다. **의료데이터는 게이트웨이로 절대 안 나간다.**

## 2. 지금까지 진행 (2026-06-08 세션 16)

- ✅ **계약 수신**(카드226, 테오 작성, 빌 경유 전달). 전문 §5.
- ✅ **완료분 배포 완료** — 참여자 선택 + 이미지 줌/팬(#2) + 홈 카피(#1). `clinic_members` 마이그레이션 Supabase 적용 확인 후 `main` 배포. 커밋 `0095d87` (main·dev·작업브랜치 정렬).
- ⏭️ **카드 235 미착수** — 이 카드대로 구현 시작하면 됨.

## 3. 확정된 설계 결정 (대표님 + 빌 확인)

| 항목 | 결정 |
|---|---|
| ① 마스터 캐시 저장소 | **`clinic_members` 재활용** (신규 테이블 X). EO 컬럼 추가 + `source`로 수동/EO 구분 |
| ③ 상담 EO API | **만들지 않음** (계약 §4 의료데이터 격리 — 만들면 계약 위반) |
| 게이트웨이 인증 | `sso-token` 재사용 ❌ → **별도 서버-서버 시크릿** `CARELOG_GATEWAY_SECRET`을 `x-gateway-secret` 헤더로 |
| 배포 순서 | 완료분 먼저 배포(✅ 완료), 235는 별도 |

## 4. 빌이 정정한 내 사전 추측 (틀렸던 것)

- ❌ "게이트웨이가 `sso-token` 재사용" → ✅ 별도 `CARELOG_GATEWAY_SECRET` / `x-gateway-secret` 헤더
- ❌ "③ 상담도 게이트웨이 경유 EO API 구현" → ✅ 상담 EO API 없음. SSO 로그인 후 Carelog 내부에서만 작성·열람. 작성자만 귀속
- ② SSO는 이미 라이브 맞음 → 다만 JWT 클레임이 확장됨(`employee_id`·`name`·`eo_role`·`account_type`·`scope`)

---

## 5. 계약서 전문 (정본 — EO `specs/016-carelog-integration/contracts/eo-gateway-and-sso.md`, 테오 작성 카드226)

```markdown
# EO ↔ Carelog 연동 계약 (게이트웨이 마스터 + SSO)

> 작성: 테오(EO) · 카드#226 · 2026-06-08
> 수신: 다온(Carelog 구현) · 헤임달(브릿지 정합 검증)
> 원칙: EO = 직원·클리닉 마스터의 SSOT. Carelog는 받아 캐시(읽기 사본). 민감정보 0. 느슨한 결합(HTTP).

---

## 0. 큰 그림

직원·클리닉 원본 ──(① 마스터 게이트웨이 / 풀+캐시)──▶ Carelog 로컬 캐시(institution_members 등)
   (EO = SSOT)                                          └ EO에서 입퇴사·정보변경 → CL 자동 최신

EO 로그인 세션 ──(② SSO 토큰 / 60초)──▶ Carelog 자동로그인 → 환자상담 작성·열람

- EO에서만 직원/클리닉을 관리한다. Carelog는 자체 마스터를 두지 않고 게이트웨이로 받아 캐시.
- 민감정보(주민번호·계좌·급여·연락처)는 게이트웨이로 절대 나가지 않는다(EO spec-048 / 헤임달 §2 "안전한 것만 통과").

---

## 1. ① 마스터 게이트웨이 (Carelog가 EO에서 받아감)

### 요청
GET https://eo-ten.vercel.app/api/gateway/carelog/master?institution_id=<CL기관ID>
Header: x-gateway-secret: <CARELOG_GATEWAY_SECRET>   # EO·CL 양쪽 Vercel에 동일 등록(서버-서버)

- 사용자 세션 무관. 서버-서버 공유 시크릿. Carelog 서버가 주기적으로 폴링(권장 5~15분) 또는 필요 시 호출해 로컬 캐시 갱신.

### 응답 200
{
  "institution_id": "<요청값>",
  "clinic": {                       // 클리닉 마스터(안전 필드)
    "id": "<workspace uuid>",
    "name": "수치과병원",
    "slug": "wan",
    "clinic_type": "치과의원" | null,
    "plan": "free" | "pro"
  },
  "members": [                      // 직원 마스터(★안전 필드만)
    {
      "id": "<employee uuid>",      // ★ 안정적 식별자(이메일 변경돼도 불변) — 캐시 upsert 키 권장
      "email": "user@x.com",
      "name": "홍길동",
      "position": "치과위생사" | null,
      "job_category": "위생사" | null,
      "employment_type": "정규직" | null,
      "work_type": "regular" | null,
      "eo_role": "clinic_admin" | "manager" | "staff",
      "hire_date": "2026-01-01" | null,
      "active": true,               // 재직 여부(false=퇴사)
      "resign_date": "2026-05-31" | null,
      "is_draft": false             // 승인대기(초안) 직원
    }
  ],
  "member_count": 12,
  "synced_at": "2026-06-08T10:00:00.000Z"   // 이 응답 생성 시각(캐시 기준)
}

### 응답 코드
| 코드 | 의미 | CL 처리 |
|------|------|--------|
| 200 | 정상 | 캐시 갱신(전체 교체 또는 id upsert + 응답에 없는 id는 비활성/삭제) |
| 400 | institution_id 누락 | 요청 수정 |
| 401 | 시크릿 불일치 | 설정 점검(폐기) |
| 404 | 연동 안 된 institution_id | 연동(workspace_carelog_links) 먼저 |
| 500 | 게이트웨이 미설정/서버오류 | 재시도 |

### ★제외(절대 안 나감)
resident_no(주민) · bank_*(계좌) · salary(급여) · phone/address(연락처) — 환자상담 도메인 불필요 + EO 암호화 정책. 필요해지면 별도 계약·근거 재논의.

### 캐시 동기화 권장
- id(employee uuid)를 키로 upsert. 응답에 없는 멤버 = EO에서 삭제됨 → CL도 비활성 처리.
- active:false는 퇴사자(이력 보존하되 비활성). is_draft:true는 미승인(노출 보류 권장).

---

## 2. ② SSO 토큰 (EO 로그인 → Carelog 상담 작성·열람)

### EO 측(기존, 카드#226에서 클레임 확장)
POST https://eo-ten.vercel.app/api/carelog/sso-token        # EO 로그인 세션 필요
→ 200 { token, carelog_url }
- carelog_url = <CARELOG_APP_URL>/api/auth/sso?token=<JWT> (EO가 만들어 줌; "케어로그 열기" 버튼이 이 URL로 이동).

### 토큰(JWT, HS256, 공유 CARELOG_SSO_SECRET) 클레임
{
  "email": "user@x.com",
  "workspace_id": "<EO workspace uuid>",
  "institution_id": "<CL 기관ID>",
  "employee_id": "<employee uuid>" | null,   // 직원이면 마스터 id와 동일(상담 작성자 귀속 키)
  "name": "홍길동",                           // 작성자 표시명(공용계정은 세션 표시명)
  "eo_role": "clinic_admin"|"manager"|"staff",
  "account_type": "personal" | "shared",      // 직원=personal / 공용계정=shared
  "scope": "carelog:read carelog:write",
  "iat": 1700000000,
  "exp": 1700000060                            // 발급 +60초(단명)
}

### Carelog 측(다온 구현) — GET /api/auth/sso?token=...
1. JWT 서명 검증(공유 시크릿) + exp 확인(만료/재사용 거부).
2. institution_id로 기관 식별 → 해당 기관 Carelog 세션 생성.
3. 작성자 귀속: employee_id(있으면) 또는 email을 상담 레코드 작성자로 기록. account_type:"shared"(공용 PC 공용계정)도 동일하게 동작(현 수준 직원 개별 추적은 선택 — name 표기까지).
4. 세션 후 Carelog 자체 세션 유지(이후 상담 작성·열람은 Carelog 내부 권한).

> 현재 수준: 링크된 기관이면 작성·열람 허용(직원 개별 RBAC는 후속). eo_role은 향후 관리자/일반 구분에 사용.

---

## 3. 환경변수 (양쪽 Vercel)
| 변수 | EO | Carelog | 용도 |
|------|----|---------|------|
| CARELOG_GATEWAY_SECRET | ✅ | ✅(호출 시 헤더) | ① 마스터 게이트웨이 서버-서버 인증 |
| CARELOG_SSO_SECRET | ✅ | ✅(검증) | ② SSO JWT 서명/검증 |
| CARELOG_APP_URL | ✅ | — | EO가 만드는 carelog_url 베이스 |

## 4. 경계(헤임달 §3·§4)
- 외부 레포(Carelog)는 EO를 import 안 함 — HTTP만. 강결합 금지.
- 게이트웨이/SSO 본문에 환자·진료정보 금지(EO는 의료데이터 격리). EO→CL은 직원/클리닉 마스터 + 로그인만.
- 계약 변경(필드 추가/응답코드)은 이 문서를 정본으로 양측 동시 반영. 헤임달이 정합 검증.
```

---

## 6. 구현 계획 (Carelog 측 — 이 순서로)

### ① 마스터 캐시 — `clinic_members` 재활용
**마이그레이션** `supabase/migrations/20260608000001_eo_integration.sql`:
- `clinic_members`에 컬럼 추가:
  - `eo_employee_id uuid` (EO `members[].id`, upsert 키) — `unique(institution_id, eo_employee_id)` 부분 인덱스
  - `email text`, `eo_role text`, `position text`
  - `source text not null default 'manual'` — `'manual'` | `'eo'`
  - `synced_at timestamptz`
  - (기존 `unique(institution_id, name)` 제약은 EO 동명이인 대비 **완화 검토** — EO source는 eo_employee_id로 유일성 보장하므로 name unique가 충돌할 수 있음. 마이그레이션에서 제약 재설계)
- **동기화 규칙(계약 §1)**: EO 응답의 `members`를 `eo_employee_id` 키로 upsert(`source='eo'`). 응답에 없는 **EO-source** 행은 `is_active=false`. **`source='manual'` 행은 절대 건드리지 않음**(수동 추가분 보호). `active:false`/`is_draft:true`는 비활성 또는 노출 보류.

**게이트웨이 클라이언트** `lib/eo/gateway.ts`:
- `fetchEoMaster(institutionId)` — `GET ${EO_APP_URL}/api/gateway/carelog/master?institution_id=...`, 헤더 `x-gateway-secret: process.env.CARELOG_GATEWAY_SECRET`. 응답코드 매핑(401/404/500 처리). `EO_APP_URL` 기본값 `https://eo-ten.vercel.app`(기존 sso route와 동일 패턴, `stripBom`).

**동기화 실행 경로**:
- `lib/eo/sync-master.ts` (admin supabase client로 upsert — RLS 우회 필요).
- 폴링: `app/api/cron/sync-master/route.ts` (Vercel Cron, 5~15분). 또는 SSO 로그인 시 lazy 갱신(institution_id 기준)도 병행 고려.

### ② SSO 보정 — `app/api/auth/sso/route.ts`
- 확장 클레임 파싱: `employee_id`·`name`·`account_type`·`eo_role` 추가 수용(기존 `email`·`institution_id` 유지).
- `institution_members`에 `eo_employee_id`·`display_name` 저장(마이그레이션에서 컬럼 추가). insert/update 모두 반영 → **작성자 귀속 체인의 토대**.
- `eo_role` → `institution_members.role` 매핑(`clinic_admin`→`admin` 등) 검토(과도한 권한 승격 주의).

### ③ 작성자 귀속 — `consultation`
**마이그레이션**(위 같은 파일): `consultation`에 `author_employee_id uuid`, `author_name text` 추가.
- `app/actions/consultations.ts`의 `saveConsultation`(insert 지점 L146)에서 현재 세션 user의 `institution_members` 행을 읽어 `author_employee_id`·`author_name` 자동 기록.
- `saveChairRecord`(체어 즉시기록)도 동일 적용 — `app/actions/` 내 체어 저장 액션 확인.
- 공용계정(`account_type='shared'`)도 `name`은 남김(개별 추적은 후속).
- ⚠️ **EO 상담 API는 만들지 않음.** 상담은 Carelog 내부에만 저장.

---

## 7. 현재 코드 상태 (착수 전 읽을 파일)

- `app/api/auth/sso/route.ts` — 라이브 SSO. `email`+`institution_id`만 사용. JWT 검증(HS256, `CARELOG_SSO_SECRET`)·magiclink 발급 로직 있음. 확장 클레임 수용·`eo_employee_id` 저장만 추가하면 됨.
- `app/actions/clinic-members.ts` — `getClinicMembers`(is_active·display_order)·`upsertClinicMember`(admin/owner). 캐시 동기화 시 EO-source 처리 추가 지점.
- `app/actions/consultations.ts` — `saveConsultation` 외 draft/confirm/SMS. insert 지점에 author 컬럼 추가.
- `supabase/schema.sql` — `clinic_members`(L135), `consultation`(L69), `institution_members`(L23) 정의. 마이그레이션과 **동기화 필수**.
- `lib/types/database.ts` — `ClinicMemberRow` 타입(L39). 컬럼 추가 시 갱신.
- `lib/supabase/admin.ts` — `createAdminSupabaseClient`(RLS 우회, 동기화·SSO에서 사용).
- `docs/eo-carelog-integration.md` — 이전 통합 기획(브리지 계약 초안 등 배경).

## 8. 착수 전 미결 / 확인

- ✅ 설계 확정 — 미결 없음.
- ⚠️ **환경변수**: `CARELOG_GATEWAY_SECRET`를 Carelog Vercel + EO Vercel에 **동일 값** 등록해야 ① 동작(배포 시). EO 측은 테오가 등록. 로컬/프리뷰 테스트는 EO와 협의된 값 필요.
- ⚠️ **EO 게이트웨이 구현 상태**: 빌 확인 — `src/app/api/gateway/carelog/master/route.ts` EO에 이미 구현됨. 실제 응답 스키마는 계약 §1 기준. 연동 테스트 시 `workspace_carelog_links`로 institution_id 연결 선행 필요(404 방지).
- 마무리 시: `project_status.md` + `docs/architecture.md`(새 파일 `lib/eo/`) + `docs/database.md`(스키마 변경) + `supabase/schema.sql` 동기화.

## 9. 문서 정책 (CLAUDE.md)

기능 구현 = 문서 업데이트 포함. 마무리 신호 시 5단계 프로토콜(문서 현행화 → `npm run build` → `[다온]` 커밋 → 배포 → Vercel 안내).
> 참고: 이 원격 컨테이너는 Supabase env 미설정 → `npm run build`가 `/admin` prerender에서 멈춤. placeholder env(`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`)로 빌드하면 통과(코드 이상 아님).
