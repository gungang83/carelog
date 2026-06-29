# Quickstart: 일일 사용 리포트 (spec 014)

## 적용
1. 마이그레이션 실행: `supabase/migrations/20260628000003_daily_report.sql`
   - `usage_reports` 생성 + `credit_log`에 tokens_in/out 추가 + `deduct_credit` 8-arg 재생성.
2. 배포(`main`). Vercel이 `vercel.json`의 새 cron(`0 23 * * *` = 08:00 KST)을 자동 등록.
3. (선택) `CRON_SECRET` 환경변수 설정 시 cron 보호.

## 즉시 확인 (cron 안 기다리고 테스트)
슈퍼어드민으로 로그인한 브라우저에서:
- 수동 발행: `/api/cron/daily-usage-report?date=2026-06-28` 접속 → JSON `{ok, summary, delivery}` 확인 + 알림함/푸시 도착.
- 오늘 즉석 리포트: `/admin/usage` → **📊 오늘 리포트** → `/admin/usage/report/today`.
- 특정 일자: `/admin/usage/report/2026-06-28`.

## 토큰 확인
- AI 전사를 한 번 돌린 뒤 `/admin/usage/report/today` 기능별 표의 입력/출력 토큰 확인.
- (Whisper만 쓰는 빠른메모·청크 구간은 토큰 0 — 정상. Claude 요약/번역 단계만 토큰 집계.)

## 검증 쿼리(선택)
```sql
select feature, sum(-delta) credit, sum(tokens_in) tin, sum(tokens_out) tout
from credit_log where delta<0 group by 1 order by 2 desc;
select report_date, scope, payload->'summary' from usage_reports order by report_date desc limit 7;
```

## 회귀 체크
- 전사(체어·긴 상담) 정상 — 토큰 캡처/리포트는 비차단.
- 비-슈퍼어드민이 리포트 페이지/cron 접근 시 차단.
