# Contract: 일일 리포트 API + lib (spec 014)

## Cron / Route Handler

### `GET /api/cron/daily-usage-report[?date=YYYY-MM-DD]`
- 인증: `Authorization: Bearer ${CRON_SECRET}`(Vercel cron) **또는** 슈퍼어드민 세션(수동). 미인증 401.
- 동작: 대상일(기본 어제 KST, `?date=`로 지정) `buildDailyReport({scope:'all'})` → `persistDailyReport` → 슈퍼어드민 전달.
- 전달: 슈퍼어드민 소속 기관마다 알림함 적재(recipients=슈퍼어드민 email, type='daily_report', link=`/admin/usage/report/{date}`) + `sendPushToUser(uid)` 웹푸시.
- 응답: `{ ok, date, summary, delivery:{ inApp, pushed } }`.
- 멱등: 같은 (date, 'all') 재호출 시 리포트 upsert. (알림은 재호출 시 추가 적재 — 수동 재발행은 의도적.)

### 페이지 `GET /admin/usage/report/[date]` (RSC)
- 슈퍼어드민 게이트. date='today'|YYYY-MM-DD. 발행본(`getStoredReport`) 우선, 없으면 `buildDailyReport` 즉석.

## lib/usage/daily-report.ts
```ts
buildDailyReport({ date, scope?='all' }): Promise<DailyReport>
persistDailyReport(report): Promise<void>          // usage_reports upsert(멱등)
getStoredReport(date, scope='all'): Promise<DailyReport|null>
reportHeadline(report): string                     // 알림 본문 한 줄
shiftKstDate(date, deltaDays): string
kstToday(): string
```

## lib/credits.ts (변경)
```ts
deductCredit(institutionId, feature, byEmail, opts?: {refId?, memo?, tokensIn?, tokensOut?}): Promise<void>
```

## app/actions/push.ts (추가)
```ts
sendPushToUser(userId, payload): Promise<void>   // push_subscriptions를 user_id로, 기관 무관
```

## 토큰 캡처 배선 (app/actions/transcribe.ts)
- 각 Claude 호출 run(basic/detailed/dental/multilingual)·summarizeChunkTranscript이 `message.usage.input_tokens/output_tokens`를 EngineRun(tokensIn/out)에 실음.
- `recordUsage(feature, {tokensIn, tokensOut})` → `deductCredit(... tokens)`. comparison은 두 run 합산. quick/chunk_segment(Whisper)는 0.
