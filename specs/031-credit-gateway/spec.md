# spec 031 — EO 크레딧 게이트웨이 수렴 (카드 #1099)

> 상태: ✅ **발효 완료 (2026-08-14).** 테오 EP(#1098) 배포 + 잔액 이관(#1105: 예미안 -73 상계+200 지급→1,017 ·
> 강남점 -20 상계+200 지급→750) → `EO_CREDIT_GATEWAY=on` → 검증 통과(전사 1회 → EO 차감, 로컬 캐시 1,015 동기화·로컬 원장 신규 0).
> 이후 크레딧 정본 = **EO 단일 원장**. 충전도 EO에서(Carelog /admin 수동 충전은 사용 중단 — §4 후속).
> 정본 계약: EO `docs/bridge-credit-gateway-contract-v0.md` (v1, 헤임달 #1002).

## 1. 목표

EO 코어+위성이 **하나의 크레딧 지갑(EO spec-089 lot 원장)** 을 공유. Carelog는 차감을
로컬 `deduct_credit` RPC 대신 **EO 게이트웨이 HTTP**로 보낸다(단일 원장, 이중기록 0).

## 2. 구현 (Carelog)

| 파일 | 내용 |
|---|---|
| `lib/eo/credit-gateway.ts` | 게이트웨이 클라이언트 — `POST /api/gateway/credit/deduct`(§2-1: product=carelog, `allow_overage:true`, `idempotency_key`, 4s 타임아웃 + 같은 멱등키 1회 재시도) · `GET …/balance`(§2-3). **절대 throw 안 함.** 인증은 마스터 게이트웨이와 동일한 `x-gateway-secret`(`CARELOG_GATEWAY_SECRET` 재사용, 계약 열린결정 3). |
| `lib/credits.ts` | `deductCredit`: 게이트웨이 on이면 EO로 차감 → 성공 시 **로컬 차감 중단**, `institution_credits`는 응답 balance로 **표시 캐시만 동기화**. 실패 시 **fail-open 로컬 폴백**(memo `[gateway-degraded]` 마커 — 정산 대조용). `getCreditBalance`: 게이트웨이 우선, 실패 시 로컬 캐시 폴백. |

- **스위치**: `EO_CREDIT_GATEWAY=on` (Vercel env). 기본 off = 현행 로컬 시뮬레이션 그대로 — 배포 자체는 무해.
- **never-block 유지**: 스위치 상태·게이트웨이 생사와 무관하게 상담/전사/통역 흐름은 절대 안 막힘(계약 §5.5·§6 준수).

## 3. 스위치 켜는 절차 (순서 고정 — 이중기록 0)

1. 테오 EP(#1098) EO main 배포 확인 (`/api/gateway/credit/deduct`·`/balance`).
2. **잔액 이관**: Carelog `institution_credits` 현 잔액 → EO `credit_grant(p_idem='carelog-migrate-<institution_id>')` 1회 충전(멱등). 현 시점 이관 대상은 사실상 예미안 1건.
3. Vercel(Carelog)에 `EO_CREDIT_GATEWAY=on` 설정 → 재배포 시점부터 로컬 차감 중단.
4. 검증: 전사 1회 → EO `workspace_credit_spends`에 `carelog:<feature>` 기록 + Carelog `credit_log`에 신규 행 **없음**.

## 4. 미결 (계약 §8 대응 — 회신)

- **잔액 이관 방식**(§8-5): 위 3-2안(현 잔액 → credit_grant 멱등 1회)으로 제안 — 테오 협의.
- **레이트카드 SSOT**(§8-2): Carelog 현행 단가 = `lib/credits.ts CREDIT_PRICES` (basic 2 · quick 1 · detailed 3 · dental 3 · multilingual 3 · comparison 5 · chunk 구간1+요약2 · interpret_realtime 분당1). EO 서버 재검증 레이트카드에 그대로 등재 요청.
- **reserve→settle 2단계**(§2-2): v1 미사용(전부 즉시 차감). 실시간 통역(분 단위 장시간)이 자연 후보 — 후속.
- **충전 경로**: 스위치 on 이후 Carelog `/admin` 수동 충전(grantCredit)은 정본과 발산 → on 시점에 /admin 충전 비활성(또는 EO로 안내) 처리 예정.

## 5. 소진 정책과의 관계 (spec 030 §3)

- 소프트 차단 게이트(`getCreditBalance ≤ 0`)는 게이트웨이 모드에서 **EO 잔액 기준**으로 자동 전환됨(같은 함수).
- overage 응답(잔량 부족 차감)은 never-block 원칙 그대로 — 게이트에서만 다음 시작을 막는다.
