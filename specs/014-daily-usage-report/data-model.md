# Data Model: 일일 사용 리포트 (spec 014)

마이그레이션: `supabase/migrations/20260628000003_daily_report.sql`

## usage_reports — 일별 리포트 스냅샷
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| report_date | date | 대상 일자(KST) |
| scope | text | 'all'(전체·슈퍼어드민) \| institution_id(운영자) |
| payload | jsonb | `DailyReport` 집계 결과 스냅샷 |
| created_at | timestamptz | 발행 시각 |
| **UNIQUE** | (report_date, scope) | 멱등 upsert 키 |

인덱스: `(report_date desc)`. RLS enable + 정책 0개(service_role만).

## credit_log 확장 (spec 013 테이블)
- `tokens_in integer not null default 0` — Claude 입력 토큰
- `tokens_out integer not null default 0` — Claude 출력 토큰

## RPC 변경
- `deduct_credit(p_institution_id, p_amount, p_feature, p_ref_id, p_by, p_memo, p_tokens_in default 0, p_tokens_out default 0)` — 6-arg 버전 drop 후 8-arg 재생성(토큰 저장). 여전히 비차단(잔액 음수 허용).

## DailyReport payload (lib/usage/daily-report.ts)
```ts
{
  date, scope,
  summary: { workspaces, menuTotal, activeUsers, creditTotal, transcribeCount, tokensIn, tokensOut },
  prev: { menuTotal, creditTotal } | null,        // 전일 대비
  byWorkspace: [{ id, name, menu, activeUsers, credit, transcribeCount, balance }],
  byFeature:   [{ feature, label, credits, count, tokensIn, tokensOut }],
  byMenu:      [{ id, label, total, byRole }],
  topUsers:    [{ user, credit, count, tokensIn, tokensOut }],  // 상위 20
  alerts:      [{ level: 'warn'|'info', text }],  // 잔액 음수/임박·사용 급증
}
```

## KST 경계 계산
- `menu_usage_daily.day` = KST 일자(track API가 KST로 기록) → `eq('day', date)`.
- `credit_log.created_at`(timestamptz) → `[date 00:00 KST, +24h)` = `${date}T00:00:00+09:00` ~ +1d. `gte/lt`.
