# Tasks: 일일 사용 리포트 (spec 014)

상태: 구현 완료(✅). 검증(T11)은 수동 트리거/예미안 확인 대기.

| # | 작업 | 파일 | 상태 |
|---|---|---|---|
| T01 | 마이그레이션(usage_reports + credit_log tokens + deduct_credit 8-arg) | `supabase/migrations/20260628000003_daily_report.sql` | ✅ |
| T02 | 집계기(build/persist/getStored/headline/KST 유틸) | `lib/usage/daily-report.ts` | ✅ |
| T03 | deductCredit 토큰 파라미터 | `lib/credits.ts` | ✅ |
| T04 | EngineRun.tokensIn/out + Claude usage 캡처 | `lib/transcribe/engines.ts`, `app/actions/transcribe.ts` | ✅ |
| T05 | SUPER_ADMIN_EMAIL export | `lib/admin.ts` | ✅ |
| T06 | sendPushToUser(user 단위 푸시) | `app/actions/push.ts` | ✅ |
| T07 | 발행 cron(인증·집계·저장·전달) | `app/api/cron/daily-usage-report/route.ts` | ✅ |
| T08 | cron 등록(0 23 * * *) | `vercel.json` | ✅ |
| T09 | 열람 페이지 + 표시 컴포넌트 + '오늘 리포트' 링크 | `app/(dashboard)/admin/usage/report/[date]/page.tsx`, `components/admin/daily-report-view.tsx`, `app/(dashboard)/admin/usage/page.tsx` | ✅ |
| T10 | 문서 동반(schema·database·architecture·status·README) | 각 문서 | ✅ |
| T11 | 빌드 그린 + 수동 발행(`?date=`) 검증 | — | 빌드 ✅ / 수동검증 대기 |
