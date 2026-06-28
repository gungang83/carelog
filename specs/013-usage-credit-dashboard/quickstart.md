# Quickstart: 사용량 · 크레딧 (spec 013)

## 적용
1. 마이그레이션 실행: `supabase/migrations/20260628000002_usage_credits.sql` (Supabase SQL editor).
   - 3테이블(`menu_usage_daily`·`institution_credits`·`credit_log`) + 3RPC + RLS 생성.
2. 배포 후 일반 사용자가 화면을 이동하면 `menu_usage_daily`가 쌓이고, AI 전사 시 `credit_log`에 차감이 적재된다.

## 확인 (슈퍼어드민)
- `/admin` → 우상단 **사용량 · 크레딧 →** → `/admin/usage`.
- **크레딧 탭**: 기간/기관 필터, 기능별·사용자별·기관별·잔액·최근 내역. **+ 크레딧 충전**으로 기관에 부여.
- **메뉴 탭**: 화면별 진입(역할 분해)·기관별·미사용 메뉴.

## 검증 쿼리(선택)
```sql
select menu_id, count(*) from menu_usage_daily group by 1 order by 2 desc;
select feature, sum(-delta) spent, count(*) from credit_log where delta<0 group by 1 order by 2 desc;
select created_by, sum(-delta) spent from credit_log where delta<0 group by 1 order by 2 desc;
```

## 회귀 체크
- 전사(체어 즉시 기록·긴 상담)·네비게이션이 평소대로 동작(추적/차감은 비차단).
- 비-슈퍼어드민이 `/admin/usage`·summary API 접근 시 차단(redirect/403).
