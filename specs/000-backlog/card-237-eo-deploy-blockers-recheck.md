# 핸드오프 카드 237 — EO 연동 라이브 블로커 재점검 (다온 → 테오)

```
┌─ 핸드오프 카드 237 ──────────────────────
[발신→수신] 다온(Carelog) → 테오(EO)
[성격]      🟡 일반 · 연동배포 · 의존성요청(코드 재분석본)
[지시]      카드236 회신 대기 중. Carelog 코드 재분석으로 "정확히 무엇이 필요한지" 코드 레벨로 확정.
[현재상태]  세션18 일반 기능은 main 배포 완료. EO 코드는 작업 브랜치에 보존, 시크릿 회신 후 별도 배포.
[관련]      계약=EO spec-016/카드#226 · Carelog 구현=카드235 · 1차 요청=카드236
└────────────────────────────────────────
```

> **발급 이력**: 2026-06-10 테오에게 발급 완료(다온). 받는 즉시 다온이 `dev`→`main` EO 배포.
>
> **회신 로그 (2026-06-10, 테오 → 다온)**:
> - ✅ **★2 기관 연동** — 연동 CL `institution_id = 0e4e85d6-d839-48ef-a1fb-1915521b9395`(예미안). 다온 교차확인: 세션18에서 중복(`a15efbd8`) 삭제 후 남긴 **예미안 정규 워크스페이스**가 맞음.
> - ✅ **★3 게이트웨이 API** — `/api/gateway/carelog/master` 배포·계약 충족, 민감정보 0 확인.
> - ✅ **★4 호스트** — `EO_APP_URL` 기본값 `https://eo-ten.vercel.app` 그대로(커스텀 도메인 없음).
> - ✅ **★5 SSO 클레임** — `employee_id·name·eo_role·account_type` 적재 확인, `CARELOG_SSO_SECRET` 기존 동일.
> - ⚠️ **★1 시크릿** — EO Vercel엔 3일 전 등록(비노출). **다온 측 확인 결과 Carelog는 미보유**(env·코드·커밋 전수 점검). 양측 값 매칭 불가 → **테오가 새 값 1회 재발급 → 대표 경유 전달 → 다온 등록** 경로로 합의.
>
> **다음 액션**: 테오 재발급 새 시크릿 값 수신 → 다온이 Carelog Vercel 등록 → EO 코드 `dev`→`main` 배포 → `GET /api/cron/sync-master`로 `0e4e85d6…` 동기화 검증.

---

## 0. 왜 또 카드인가

카드236으로 4건 요청했으나 회신 대기 중. 그 사이 **세션18 일반 기능(직원 초대·워크스페이스·직원관리)은 main 배포 완료**했고, EO 코드는 작업 브랜치(`claude/festive-planck-FCghV`)에 분리 보존했다. 이 카드는 **Carelog 코드를 한 줄 한 줄 다시 본 결과**로, 테오가 회신할 때 헷갈리지 않도록 요청을 **코드 타입과 1:1**로 다시 못 박는다. (카드236의 상위호환)

## 1. 지금 막고 있는 단 하나의 실질 블로커

> **`CARELOG_GATEWAY_SECRET` 값** 하나가 전부다. 이게 오면 즉시 배포·검증 가능.

- 서버-서버 공유 시크릿. EO가 값 1개 정해 **EO Vercel(Production)에 등록 + 그 값을 다온에게 공유** → 다온이 Carelog Vercel(Production)에 **동일 값** 등록.
- 코드: `lib/eo/gateway.ts:72` `process.env.CARELOG_GATEWAY_SECRET` → 요청 헤더 `x-gateway-secret`.
- 없으면 `fetchEoMaster()`가 곧장 `{ ok:false, reason:"config" }` 반환 → **모든 동기화 스킵**(앱은 정상, EO 캐시만 0건).

## 2. 테오에게 묻는 것 (우선순위 순)

| # | 묻는 것 | 코드 근거 / 확인 포인트 |
|---|---------|------------------------|
| ★1 | **공유 시크릿 값** `CARELOG_GATEWAY_SECRET` | EO Vercel에 등록한 값 그대로 공유(또는 안전 채널로). 다온이 Carelog Vercel에 동일 등록. |
| ★2 | **연동된 CL `institution_id`** | EO `workspace_carelog_links`(또는 동등)에 **어느 Carelog institution_id ↔ 어느 EO clinic**이 연결됐는지. 미등록이면 게이트웨이 404 → Carelog `reason:"not_linked"`로 스킵. 검증·로그 확인용으로 연동 ID 목록 필요. |
| 3 | **게이트웨이 호스트 확정** | `EO_APP_URL` 코드 기본값 `https://eo-ten.vercel.app`(`gateway.ts:14`, `sso/route.ts:16`). 이게 프로덕션 게이트웨이 호스트가 맞나? 커스텀 도메인이면 다온이 `EO_APP_URL` env로 교체. |
| 4 | **게이트웨이 응답 스키마 일치** | 아래 §3 표대로 필드가 실제로 실리는가(특히 `id`=upsert 키, `eo_role` enum, `active`/`is_draft`). 민감정보 0건 재확인. |
| 5 | **SSO 클레임 확장 + 시크릿** | EO `/api/carelog/sso-token` JWT에 `employee_id`·`name`·`account_type`(personal/shared)·`eo_role`이 실리는가. 서명키 `CARELOG_SSO_SECRET` 양측 동일(기존 그대로). Carelog 수신 경로 = `GET /api/auth/sso?token=<jwt>`(HMAC-SHA256 검증, `sso/route.ts`). |

## 3. 게이트웨이 응답 — Carelog가 기대하는 정확한 형태

`GET {EO_APP_URL}/api/gateway/carelog/master?institution_id=<CL기관ID>`
헤더 `x-gateway-secret: <CARELOG_GATEWAY_SECRET>` → 응답(`EoMasterResponse`, `lib/eo/gateway.ts:45`):

```jsonc
{
  "institution_id": "…",
  "clinic":   { "id":"…", "name":"…", "slug":"…", "clinic_type":null, "plan":"free|pro" },
  "members":  [ /* EoMasterMember[] — 아래 표 */ ],
  "member_count": 0,
  "synced_at": "ISO8601"
}
```

**`members[]` 항목** (`EoMasterMember`, `gateway.ts:18`) — Carelog가 `clinic_members`에 `source='eo'`로 캐시:

| 필드 | 캐시? | 의미 / 제약 |
|------|------|------------|
| `id` (string, EO employee uuid) | ✅ **upsert 키** | **이메일이 바뀌어도 불변**이어야 함(`eo_employee_id`로 저장, `sync-master.ts:36`) |
| `email`, `name`, `position` | ✅ | 표시용 |
| `eo_role` | ✅ | `"clinic_admin"｜"manager"｜"staff"`. SSO에서 `clinic_admin→admin`, 그 외 `staff`로 매핑 |
| `active` (bool) | ✅ 판정 | 재직 여부 |
| `is_draft` (bool) | ✅ 판정 | 미승인(초안) 직원 |
| `resign_date` | — | 이력용(선택) |
| `job_category`·`employment_type`·`work_type`·`hire_date` | ✖ | 타입엔 있으나 **캐시 안 함**. 누락돼도 무방, 존재 여부만 확인 |

- **활성 판정**: `is_active = active && !is_draft` (퇴사·미승인은 비활성 보존, `sync-master.ts:45`).
- **삭제 반영**: 응답에 없는 EO-source 행은 자동 `is_active=false`. `source='manual'`(수동추가)은 **절대 안 건드림**(`sync-master.ts:7`).
- **응답코드 계약**: `200` 정상 / `400` bad_request / `401`(시크릿 불일치→config) / `404`(미연동→스킵) / `500`(재시도). (`gateway.ts:98`)
- **민감정보(주민/계좌/급여/연락처) 응답 본문에 0건** — 헤임달 §3·§4.

## 4. 시크릿 받은 직후 다온이 할 일 (배포·검증)

1. Carelog Vercel(Production)에 `CARELOG_GATEWAY_SECRET` 등록 (+ 필요시 `EO_APP_URL`, 선택 `CRON_SECRET`).
2. 작업 브랜치 EO 코드를 `dev`→`main` 배포(cherry-pick 분리분과 충돌 없음 — 일반분은 이미 main).
3. **검증 ①②③**: `GET /api/cron/sync-master` 1회 → `{ ok, synced, skipped, results }`. 해당 기관이 `synced(+n/~n/-n)`이면 성공. `error:"config"`=시크릿 불일치, `skipped`=404 미연동.
4. **검증 ④⑤(SSO)**: EO "케어로그 열기" → 로그인 → 상담 저장 → `consultation.author_employee_id`/`author_name` 채워지면 SSO 클레임 정상.

## 5. 경계 재확인

- Carelog는 EO를 **import 안 함 — HTTP만**. 게이트웨이/SSO 본문에 환자·진료정보 0.
- 상담 EO API는 **만들지 않음**(계약 §4 의료데이터 격리). 작성자 귀속만 내부 저장.
- 계약 필드·응답코드 변경은 EO `spec-016` 정본을 양측 동시 반영.

---

> 회신 요청: **★1 시크릿 값 + ★2 연동 CL institution_id** (이 둘이 진짜 블로커). 3·4·5는 확인/검증.
> 받는 즉시 다온이 Vercel 등록 → `dev`→`main` 배포로 EO 연동 라이브.
