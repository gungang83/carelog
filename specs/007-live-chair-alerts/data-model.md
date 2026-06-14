# Phase 1 Data Model: 실시간 체어 상담기록 알림

**신규 테이블·컬럼 없음.** 기존 자산을 구독·확장한다. DB 변경은 **realtime publication 추가 1건**뿐.

## 이벤트 원천 (기존 테이블 재사용)

### `chair_audit_logs` (구독 대상 — 신규 컬럼 없음)
실시간 알림의 신호원. INSERT만 구독.

| 필드 | 용도(알림) |
|---|---|
| `id` (uuid) | 이벤트 dedup 키 |
| `institution_id` (uuid) | **채널 필터 + RLS 격리**(타 기관 차단) |
| `chair_id` (uuid→chairs) | 클라이언트가 `chairs.name`으로 해석("2번 체어") |
| `consultation_id` (bigint) | 어떤 기록인지(필요 시 이동 대상) |
| `event_type` (text) | `'record_created'`만 처리(이번 범위) |
| `actor_user_id` (uuid) | **에코 방지**(현재 사용자와 비교) |
| `metadata` (jsonb) | `{}` 유지 — **PII 미적재**(헌법 I) |
| `created_at` (timestamptz) | 표시·디바운스 기준 |

> ⚠️ 전송선 데이터에 진료 본문·환자 식별정보 없음. 토스트 표시는 `chair_id→name`과 "도착 사실"만.

### `chairs` (재사용, 변경 없음)
`name`(체어 라벨) → 토스트 문구. 클라이언트가 이미 `chair-provider`로 보유.

### `consultation` (재사용, 변경 없음)
체어 기록 = `patient_id IS NULL AND chair_id IS NOT NULL`, `status='draft'`. 목록(미연결 기록)은 `router.refresh()`로 서버에서 RLS 경유 조회. **Realtime 구독 대상 아님**(본문 보호).

### `push_subscriptions` (재사용, 변경 없음)
`sendPushToInstitution`이 기관 구독 엔드포인트 조회에 사용(US3).

## 클라이언트 상태 (DB 아님)

### 알림 환경설정 (per-screen, `localStorage`)
| 키 | 값 | 의미 |
|---|---|---|
| `soundArmed` | bool | "소리 켜기" 1회 활성화 여부(자동재생 잠금 해제) |
| `soundEnabled` | bool | 소리 on/off 토글(기본 on, 단 armed 전엔 무음) |

> 스키마 변경 없이 화면 단위 보관(헌법 IV — 불필요한 테이블 금지). 향후 직원 단위 영속 설정이 필요해지면 그때 테이블 검토.

## 이벤트 흐름 (요약)

```
[체어 화면] saveChairRecord(Server Action)
   → consultation INSERT (patient_id null, chair_id)
   → chair_audit_logs INSERT (event_type='record_created', actor_user_id)
   → sendPushToInstitution(...)  [fire-and-forget, US3]
        │
        ▼ (Supabase Realtime, RLS+필터: institution_id)
[열린 모든 직원 화면] live-alerts-provider
   → actor === me ?  → (토스트/소리 생략, 목록만 refresh)   // 에코 방지
   → else            → 디바운스 → 토스트(chair name) + (armed면) 효과음 + router.refresh()
[화면 꺼짐/백그라운드] → OS Web Push (US3)
```

## DB 마이그레이션 (1건)

```sql
-- 2026XXXX_realtime_chair_audit_logs.sql
alter publication supabase_realtime add table public.chair_audit_logs;
```
- `docs/database.md` + `supabase/schema.sql`에 publication 상태 반영(헌법 VI).
- RLS는 기존 "staff reads own institution audit logs" 정책 그대로 활용(추가 정책 불필요).
