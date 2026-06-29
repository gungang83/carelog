# Implementation Plan: 일일 사용 리포트

**Branch**: `014-daily-usage-report` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md)
**Input**: spec.md + spec 013 데이터(menu_usage_daily·credit_log) + 기존 cron(vercel.json·CRON_SECRET)·알림(spec 012 sendNotification)·웹푸시(VAPID)

## Summary

전일(KST 0~24시) 전체 워크스페이스 사용량을 집계해 발행 + 슈퍼어드민 아침 알림.

- **집계기 `lib/usage/daily-report.ts`**: `buildDailyReport({date, scope})` — menu_usage_daily(KST 일자) + credit_log(KST 경계) 합산. scope 일반화(all|institution_id). 전일 대비·경고 포함. `persistDailyReport`/`getStoredReport`.
- **토큰 실측**: 전사 액션이 Claude `usage`(입력/출력)를 EngineRun에 실어 `recordUsage`→`deduct_credit`로 `credit_log.tokens_in/out`에 적재.
- **발행 cron `/api/cron/daily-usage-report`**: 매일 08:00 KST. 빌드→저장→슈퍼어드민 전달(알림함 recipients=email + `sendPushToUser`). CRON_SECRET/슈퍼어드민 세션 인증. `?date=` 재발행.
- **열람 `/admin/usage/report/[date]`**: 발행본 우선, 없으면 즉석 집계. `DailyReportView`.

## Technical Context

**Language/Version**: TypeScript strict · Next.js 16.2.2 · React 19
**Primary Dependencies**: Supabase(admin client·RPC), 기존 cron·알림(sendNotification)·웹푸시(web-push/VAPID), 기존 auth admin(listUsers로 슈퍼어드민 user_id). **신규 외부 의존성 0.**
**Storage**: 신규 테이블 `usage_reports`(jsonb 스냅샷) + `credit_log`에 tokens_in/out 컬럼 + `deduct_credit` 8-arg. schema.sql·database.md 동반.
**Testing**: `npm run build`(TS·compile) 그린 + 슈퍼어드민 수동 트리거(`/api/cron/daily-usage-report?date=…`) 검증.
**Target Platform**: Web PWA + Vercel Cron(서버리스, hnd1).
**Constraints**: KST 0~24시 정확, 멱등 발행, 환자 PII 미적재, 전사 hot path 비차단(토큰 캡처 실패가 전사 안 막음), 서버 권위.

## Constitution Check

- [x] **I. Patient Privacy First** — 리포트·알림에 환자 PII 0(직원 이메일·집계 수치만).
- [x] **II. Server-Side Data Authority** — 집계·발행·전달 모두 service_role/cron. RLS 정책0(usage_reports). 열람 슈퍼어드민 게이트.
- [x] **III. Clinical Reliability** — 토큰 캡처·리포트 적재는 비차단(전사·상담 데이터 불변). 발행 멱등(upsert). 신규 스키마 마이그레이션 동반.
- [x] **IV. Simplicity Over Abstraction** — 집계기 한 곳(daily-report.ts), 발행 한 곳(cron route), 표시 한 곳(DailyReportView). 이메일/SMS·요금제 제외.
- [x] **V. Spec-Driven Development** — 본 spec/plan/data-model/contracts 존재.
- [x] **VI. Documentation as Living Artifact** — schema.sql·database.md·architecture.md·project_status.md·README 동반.

## Project Structure

```text
specs/014-daily-usage-report/  (spec·plan·data-model·research·quickstart·tasks · contracts/ · checklists/)

supabase/migrations/20260628000003_daily_report.sql  # [신규] usage_reports + credit_log tokens + deduct_credit 8-arg
lib/
├── usage/daily-report.ts            # [신규] buildDailyReport·persist·getStored·headline·KST 유틸
├── credits.ts                       # [수정] deductCredit tokens 파라미터
├── admin.ts                         # [수정] SUPER_ADMIN_EMAIL export
└── transcribe/engines.ts            # [수정] EngineRun.tokensIn/out
app/
├── actions/transcribe.ts            # [수정] Claude usage 캡처 → recordUsage(tokens)
├── actions/push.ts                  # [수정] sendPushToUser(user 단위 푸시)
├── api/cron/daily-usage-report/route.ts            # [신규] 발행 cron
└── (dashboard)/admin/usage/report/[date]/page.tsx  # [신규] 열람 페이지
components/admin/daily-report-view.tsx  # [신규] 리포트 표시(서버 렌더)
app/(dashboard)/admin/usage/page.tsx    # [수정] '오늘 리포트' 링크
vercel.json                             # [수정] cron 0 23 * * *
supabase/schema.sql · docs/* · project_status.md · README.md  # [수정]
```

**Structure Decision**: spec 013 데이터 위에 집계기+cron+열람 추가. 알림은 spec 012 재사용(슈퍼어드민은 크로스-기관이라 recipients=email 인앱 + user 단위 푸시 신규). 생성기 scope 일반화로 운영자 리포트 후속 대비.

## Complexity Tracking

| 추가 요소 | 왜 필요 | 더 단순한 대안 기각 이유 |
|---|---|---|
| usage_reports 스냅샷 | 과거 열람·이력·멱등 | 매번 재집계는 가능하나 이력/불변성 없음(즉석 집계는 폴백으로 유지) |
| credit_log 토큰 컬럼 | 실토큰 관측(크레딧과 별개 정확도) | 크레딧만으론 실제 LLM 비용 추정 불가 |
| sendPushToUser | 슈퍼어드민은 크로스-기관 → 기관 푸시 부적합 | 기관 전체 푸시는 무관 직원에게 발송 |
