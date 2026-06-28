# Research: 사용량 · 크레딧 (spec 013)

## EO 벤치마크 (읽기전용 교차검증)
- `gungang83/EO@main` — `src/app/superadmin/menu-usage/{page,MenuUsageClient}.tsx`, `src/app/api/menu-usage/{track,summary}/route.ts`, `src/lib/credits.ts`, `supabase/migrations/20260621_spec075_menu_usage.sql`, `20260606_spec011_credits.sql`.

### 차용
- 일별 집계(`(ws,user,menu,day)` 카운트 +1) — row 폭증 방지. → 케어로그 `(institution,user,menu,day)`.
- track: sendBeacon `{menuId}`만 받고 워크스페이스·유저·역할은 세션에서 확인 + 화이트리스트 + 조용한 204. → 동일.
- summary 다각도(총합·워크스페이스별·메뉴별 역할분해·미사용). → 직군(job_category) 대신 케어로그 역할(owner/admin/staff)로 분해.
- 크레딧 2테이블(잔액 + 로그) + 원자적 RPC + 기능별 단가 헬퍼. → 동일 구조.

### 의도적 차이 (케어로그 결정)
| 항목 | EO | 케어로그 | 이유 |
|---|---|---|---|
| 격리 | RLS disable(sms_logs 패턴) | RLS enable + 정책 0개 | Constitution I/II 격리 — 클라 전면 차단이 더 안전 |
| 차감 | `deduct_credit` 잔액부족 시 false(차단) | 비차단(음수 허용·비throw) | Constitution III 임상 안정성 — 전사 끊김 방지 |
| 단위 | 직군 분해 | 역할 분해 | 케어로그엔 job_category 없음 |
| 인증 | NextAuth `auth()`/`isEoOwner` | Supabase 세션/`isSuperAdmin` | 케어로그 인증 스택 |

## 결정
- 크레딧은 시뮬레이션(부여+차감 로그). 실결제는 후속.
- 메뉴 추적은 라우트 첫 세그먼트 기준(RouteTracker). 세밀 이벤트는 범위 외.
