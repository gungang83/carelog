# Tasks: 사용량 · 크레딧 대시보드 (spec 013)

상태: 전부 구현 완료(✅). 검증(T13)은 예미안 수동 확인 대기.

| # | 작업 | 파일 | 상태 |
|---|---|---|---|
| T01 | 마이그레이션(3테이블·3RPC·RLS) | `supabase/migrations/20260628000002_usage_credits.sql` | ✅ |
| T02 | 크레딧 lib(단가·deduct비차단·grant·balance) | `lib/credits.ts` | ✅ |
| T03 | 메뉴 정의·화이트리스트·path매핑 | `lib/usage/menu-config.ts` | ✅ |
| T04 | 타입 추가 | `lib/types/database.ts` | ✅ |
| T05 | track API(sendBeacon 수집) | `app/api/menu-usage/track/route.ts` | ✅ |
| T06 | 메뉴 summary API | `app/api/menu-usage/summary/route.ts` | ✅ |
| T07 | 크레딧 summary API | `app/api/credits/summary/route.ts` | ✅ |
| T08 | 크레딧 grant API | `app/api/credits/grant/route.ts` | ✅ |
| T09 | 전사 액션 비차단 배선 | `app/actions/transcribe.ts` | ✅ |
| T10 | RouteTracker(클라) + 레이아웃 배치 | `components/usage/route-tracker.tsx`, `app/(dashboard)/layout.tsx` | ✅ |
| T11 | 대시보드 페이지 + 컴포넌트 + /admin 링크 | `app/(dashboard)/admin/usage/page.tsx`, `components/admin/usage-dashboard.tsx`, `app/(dashboard)/admin/page.tsx` | ✅ |
| T12 | 문서 동반(schema·database·architecture·status·README) | 각 문서 | ✅ |
| T13 | 빌드 그린 + 예미안 수동 검증 | — | 빌드 ✅ / 수동검증 대기 |
