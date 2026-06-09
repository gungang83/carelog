# 핸드오프 카드 236 — EO 게이트웨이/SSO 배포측 준비 요청 (다온 → 테오)

```
┌─ 핸드오프 카드 236 ──────────────────────
[발신→수신] 다온(Carelog) → 테오(EO)
[성격]      🟡 일반 · 연동배포 · 의존성요청
[지시]      카드235(계약 카드226) Carelog 측 구현 완료 → EO 측 배포 준비 4건 요청
[착수 전]   Carelog 측 코드·DB 준비됨. 아래 §3 4건이 끝나야 양측 연동 라이브
[관련]      계약 = EO spec-016 / 카드#226(테오 작성). Carelog 구현 = 카드235
└────────────────────────────────────────
```

---

## 1. 한 줄 요약

계약(카드#226)대로 **Carelog 측 ①게이트웨이 수신 + ②SSO 보정 + ③작성자 귀속 구현·DB 적용을 끝냈다.**
이제 **EO 측 4건**(게이트웨이 API·기관 연동·공유 시크릿·SSO 클레임 확장)이 준비되면 양측 연동이 라이브된다.

## 2. Carelog 측 완료 상태 (다온, 2026-06-08)

- ✅ **① 마스터 수신** — `lib/eo/gateway.ts`가 `GET {EO_APP_URL}/api/gateway/carelog/master?institution_id=…`를 헤더 `x-gateway-secret`로 호출. 응답코드 200/400/401/404/500 매핑. `clinic_members`에 `source='eo'`로 캐시(eo_employee_id upsert, 미존재/퇴사/미승인 비활성, 수동입력분 불가침). 폴링 `app/api/cron/sync-master`(10분) + SSO 로그인 시 lazy 동기화.
- ✅ **② SSO 수신** — `/api/auth/sso`가 확장 클레임(`employee_id`·`name`·`account_type`·`eo_role`)을 수용. 신규 멤버 role 매핑(clinic_admin→admin), 기존 멤버 귀속정보만 갱신.
- ✅ **③ 작성자 귀속** — 상담 저장 시 `author_employee_id`·`author_name` 기록. **상담 EO API는 만들지 않음(계약 §4 의료데이터 격리 준수).**
- ✅ **DB 마이그레이션 Supabase 적용 완료** (`20260608000001_eo_integration.sql`).
- ⏳ **Carelog main 배포 대기** — 아래 §3-③(공유 시크릿) 등록 후 진행 예정.

## 3. EO 측 요청 4건

| # | 요청 | 확인 포인트 |
|---|------|------------|
| ① | **게이트웨이 API 배포 확인** | `GET https://eo-ten.vercel.app/api/gateway/carelog/master?institution_id=<CL기관ID>`가 계약 §1 응답 스키마(clinic + members[] 안전필드 + member_count + synced_at)대로 동작하는가. 민감정보(주민/계좌/급여/연락처) 미포함 재확인. |
| ② | **기관 연동 등록** | `workspace_carelog_links`(또는 동등)에 Carelog 기관이 연동돼 있는가. 미등록이면 404 → Carelog는 동기화 스킵(앱은 정상). **연동할 CL institution_id는 별도 공유 필요.** |
| ③ | **공유 시크릿 `CARELOG_GATEWAY_SECRET`** | 값 1개 정해 **EO Vercel(Production)에 등록 + 그 값을 다온에게 공유**. 다온이 Carelog Vercel에 동일 값 등록. (서버-서버 인증, `x-gateway-secret` 헤더) |
| ④ | **SSO JWT 클레임 확장 확인** | `/api/carelog/sso-token` 발급 JWT에 `employee_id`·`name`·`account_type`(personal/shared)·`eo_role`(clinic_admin/manager/staff)이 실제로 실리는가. 서명 시크릿 `CARELOG_SSO_SECRET`은 기존 그대로(양측 동일). |

## 4. 검증 방법 (양측 합의용)

- **①+②+③ 검증**: 시크릿 등록 후 Carelog `GET /api/cron/sync-master` 1회 호출 → 응답 `{ synced, skipped, results }`. 해당 기관이 `synced(+n/~n/-n)`로 잡히면 성공. `error:config`=시크릿 불일치, `skipped`=연동(404) 미등록.
- **④ 검증**: EO "케어로그 열기" → Carelog 로그인 후 상담 저장 → `consultation.author_employee_id`/`author_name` 채워지면 SSO 클레임 정상 수신.

## 5. 경계 재확인 (헤임달 §3·§4)

- Carelog는 EO를 import하지 않음 — **HTTP만**. 게이트웨이/SSO 본문에 환자·진료정보 0.
- 계약 변경(필드·응답코드)은 EO `spec-016` 정본을 양측 동시 반영, 헤임달 정합 검증.

---

> 회신 요청: ①②④ 준비 상태 + ③ 시크릿 값(또는 "EO에 등록했으니 공유" 신호) + 연동 CL institution_id.
> 받는 즉시 다온이 Carelog Vercel 시크릿 등록 → `dev`→`main` 배포로 마무리한다.
