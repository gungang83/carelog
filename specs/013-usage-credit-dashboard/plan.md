# Implementation Plan: 사용량 · 크레딧 대시보드

**Branch**: `013-usage-credit-dashboard` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)
**Input**: spec.md + EO 벤치마크(읽기전용 교차검증: `src/app/superadmin/menu-usage/*`, `src/app/api/menu-usage/*`, `src/lib/credits.ts`, `supabase/migrations/{20260621_spec075_menu_usage,20260606_spec011_credits}.sql`)

## Summary

EO의 메뉴 사용량(spec-075)·크레딧(spec-011)을 케어로그 멀티테넌트로 포팅 + 통합 대시보드.

- **메뉴 사용량**: `menu_usage_daily` 일별 카운트 + `increment_menu_usage` RPC. 클라 `RouteTracker`(sendBeacon) → `track` API(세션 신뢰원) → summary API(슈퍼어드민).
- **크레딧**: `institution_credits`(잔액) + `credit_log`(차감/충전 원장) + `deduct_credit`(★비차단)·`grant_credit` RPC. `lib/credits.ts`로 단일화. 전사 액션(`transcribe.ts`)에 비차단 배선.
- **격리**: 세 테이블 RLS 켜고 정책 0개 → 클라 전면 차단, service_role만 접근. 기관 격리는 조회 필터.

## Technical Context

**Language/Version**: TypeScript strict · Next.js 16.2.2 App Router · React 19
**Primary Dependencies**: Supabase(Postgres·RPC), 기존 세션(`getSessionUser`·`getMyInstitutionId`)·admin client·`isSuperAdmin`. **신규 외부 의존성 0.**
**Storage**: 신규 테이블 3(`menu_usage_daily`·`institution_credits`·`credit_log`) + RPC 3(`increment_menu_usage`·`deduct_credit`·`grant_credit`). schema.sql·database.md 동반.
**Testing**: `npm run build`(TS·compile) 그린 + 예미안 수동 검증.
**Target Platform**: Web PWA. **Project Type**: Next.js 풀스택(RSC + Route Handler + client tracker).
**Constraints**: 기관 격리·서버 권위·환자 PII 미적재·전사/네비 회귀 0·비차단(임상 안정성).

## Constitution Check

- [x] **I. Patient Privacy First** — 사용량 테이블에 환자 PII 0(직원 이메일·메뉴·기능만). 슈퍼어드민만 열람.
- [x] **II. Server-Side Data Authority** — 수집·집계·충전 모두 Route Handler/service_role. 클라는 표시·필터. RLS 정책0(클라 전면 차단).
- [x] **III. Clinical Reliability** — 크레딧 차감은 비차단·비throw(잔액 음수 허용) → 전사·상담 데이터 불변. 신규 스키마 마이그레이션 + schema.sql/database.md 동반. increment 멱등.
- [x] **IV. Simplicity Over Abstraction** — 크레딧 로직 `lib/credits.ts` 한 곳, 메뉴 정의 `lib/usage/menu-config.ts` 한 곳. EO의 토큰 실측·요금제는 제외(고정 단가).
- [x] **V. Spec-Driven Development** — 본 spec/plan/data-model/contracts 존재.
- [x] **VI. Documentation as Living Artifact** — schema.sql·database.md·architecture.md·project_status.md·README 동반 갱신.

## Project Structure

```text
specs/013-usage-credit-dashboard/
├── spec.md · plan.md · data-model.md · research.md · quickstart.md · tasks.md
├── contracts/usage-credit-api.md
└── checklists/requirements.md

supabase/migrations/20260628000002_usage_credits.sql   # [신규] 3테이블·3RPC·RLS
lib/
├── credits.ts                       # [신규] 단가·deduct(비차단)·grant·balance
├── usage/menu-config.ts             # [신규] MENU_ITEMS·menuIdFromPath·화이트리스트
└── types/database.ts                # [수정] MenuUsageRow·InstitutionCreditRow·CreditLogRow
app/api/
├── menu-usage/track/route.ts        # [신규] POST 수집(sendBeacon)
├── menu-usage/summary/route.ts      # [신규] GET 메뉴 집계(슈퍼어드민)
├── credits/summary/route.ts         # [신규] GET 크레딧 집계(슈퍼어드민)
└── credits/grant/route.ts           # [신규] POST 충전(슈퍼어드민)
app/(dashboard)/
├── admin/usage/page.tsx             # [신규] 대시보드 페이지(슈퍼어드민 게이트)
├── admin/page.tsx                   # [수정] 사용량·크레딧 링크 추가
└── layout.tsx                       # [수정] <RouteTracker/> 배치
components/
├── usage/route-tracker.tsx          # [신규] 화면 진입 추적(클라)
└── admin/usage-dashboard.tsx        # [신규] 2탭 대시보드(클라)
app/actions/transcribe.ts            # [수정] recordUsage 비차단 배선(엔진/청크)
supabase/schema.sql · docs/database.md · docs/architecture.md · project_status.md · README.md  # [수정]
```

**Structure Decision**: 기존 Next.js 앱 확장. EO와 동일한 일별집계·track/summary·크레딧 원장 구조를 케어로그 `institution_id`·`isSuperAdmin`·service_role에 매핑. 차단 정책만 임상 안정성 위해 제거(비차단).

## Complexity Tracking

| 추가 요소 | 왜 필요 | 더 단순한 대안 기각 이유 |
|---|---|---|
| 일별 집계 테이블 | 진입당 row 폭증 방지(연 수만건) | raw 이벤트 적재는 비용·집계 부하 |
| 크레딧 2테이블(잔액+로그) | 잔액 조회 O(1) + 상세 원장 분리 | 로그만 합산은 잔액 조회 매번 풀스캔 |
| RPC 3개 | 원자적 increment·차감·충전(레이스 안전) | JS 읽고-쓰기는 동시성 정합 위험 |
