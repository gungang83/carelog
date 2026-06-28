# Data Model: 사용량 · 크레딧 (spec 013)

마이그레이션: `supabase/migrations/20260628000002_usage_credits.sql`

## menu_usage_daily — 화면(메뉴) 진입 일별 집계
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| institution_id | uuid FK→institutions | 기관 격리 키 |
| user_email | text | 직원 식별(슈퍼어드민만 열람) |
| menu_id | text | MENU_ITEMS.id(home/records/patients/view/settings/help/about/admin) |
| day | date | 진입일(KST) |
| role_snap | text | 진입 시점 역할(owner/admin/staff) |
| count | integer | 누적 진입 수 |
| updated_at | timestamptz | |
| **UNIQUE** | (institution_id, user_email, menu_id, day) | increment 충돌 키 |

인덱스: `(institution_id, day)`, `(institution_id, menu_id, day)`.

## institution_credits — 기관 크레딧 잔액
| 컬럼 | 타입 | 설명 |
|---|---|---|
| institution_id | uuid PK FK→institutions | |
| balance | integer | 잔액(음수 허용 — 비차단) |
| updated_at | timestamptz | |

## credit_log — 차감/충전 원장
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| institution_id | uuid FK→institutions | |
| delta | integer | 음수=차감, 양수=충전 |
| feature | text | transcribe_* / summarize_chunk / grant |
| ref_id | text? | 상담 id 등(선택) |
| balance_after | integer | 변동 후 잔액 |
| memo | text? | |
| created_by | text? | 사용자 이메일(누가) |
| created_at | timestamptz | |

인덱스: `(institution_id, created_at desc)`, `(feature, created_at desc)`.

## RPC
- `increment_menu_usage(p_inst, p_email, p_menu, p_day, p_role)` — UPSERT +1. SECURITY DEFINER.
- `deduct_credit(p_institution_id, p_amount, p_feature, p_ref_id, p_by, p_memo) → integer` — ★비차단: 잔액 부족해도 차감·기록(음수 허용). 차감 후 잔액 반환.
- `grant_credit(p_institution_id, p_amount, p_by, p_memo) → integer` — 충전 + grant 로그. 충전 후 잔액 반환.

## RLS
세 테이블 모두 **RLS enable + 정책 0개** → 클라이언트(anon/authenticated) 전면 차단, service_role(admin client)·SECURITY DEFINER만 접근. 기관 격리는 조회 쿼리의 institution_id 필터.

## 크레딧 단가 (lib/credits.ts CREDIT_PRICES)
| feature | 크레딧 | 라벨 |
|---|---|---|
| transcribe_quick | 1 | 빠른 메모 |
| transcribe_basic | 2 | 기본모델 전사·요약 |
| transcribe_detailed | 3 | 상세 요약 |
| transcribe_dental | 3 | 용어 보정 |
| transcribe_multilingual | 3 | 다국어 통역 |
| transcribe_comparison | 5 | 엔진 비교 |
| transcribe_chunk_segment | 1 | 긴 상담 구간 전사 |
| summarize_chunk | 2 | 긴 상담 요약 |
