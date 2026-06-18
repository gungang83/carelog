# Phase 1 Data Model: 상담보드 (Consultation Board)

MVP는 **DB 스키마 변경이 없다.** 기존 엔티티를 재사용하고, 신규는 클라이언트 임시 상태(draft 세션)와 파생 조회(최근 참여자)뿐이다.

## 영속 엔티티 (기존 재사용 — 변경 없음)

### consultation (체어 기록)
- `id`, `institution_id`, `patient_id`(체어 기록은 null), `chair_id`(저장 시 귀속), `content`(sanitized HTML), `prescriptions`(text[]), `participants`(jsonb — `Participant[]` 스냅샷), `status`('draft'), `author_employee_id`, `author_name`, `created_at`.
- 보드 저장 = 기존 `saveChairRecord`로 INSERT. 변경 없음.

### chairs
- `id`, `institution_id`, `name`. 저장 시 귀속 대상. 변경 없음.

### clinic_members (참여자 디렉터리)
- `id`, `institution_id`, `name`, `role`, `position`, `eo_role`, `source('manual'|'eo')`, `is_active`, `display_order`.
- `participant-picker`의 후보 원천. 정렬·필터는 **읽기 측 클라이언트 로직**(컬럼 변경 없음).

### chair_audit_logs
- 실시간 알림 원천(PII 0). 보드 저장도 기존대로 `record_created` INSERT. 변경 없음.

## 신규 — 클라이언트 임시 상태 (영속 아님)

### Draft 세션 (chair-provider 내 단일 슬롯)
진행 중인 한 건의 상담. 저장 전까지 메모리에만 존재.

| 필드 | 타입 | 설명 |
|---|---|---|
| key | `"__draft__"`(sentinel) | recording/mediaRefs 맵의 예약 키 |
| status | `idle\|recording\|processing\|has_records` | 기존 ChairStatus 재사용 |
| transcribedText | string | 중지 후 전사 결과 |
| (board-local) selectedChairId | string \| null | 저장 시 귀속할 체어. 미확정 허용 |
| (board-local) editText | string(HTML) | 본문(전사 + 사용자 편집) |
| (board-local) participants | `Participant[]` | '나' 자동 포함 |
| (board-local) prescriptions | string[] | 처방 |

**상태 전이**: `idle → recording`(1탭) → `processing`(중지·전사) → `has_records`(편집) → 저장 시 `saveChairRecord(selectedChairId, …)` → draft reset(`idle`).
**보존(FR-016)**: 저장 전 보드를 닫아도 draft 슬롯·board-local 상태는 유지(사용자가 '버리기' 전까지). 단순 구현 위해 진행 중 draft는 1건만(단일 세션).

## 신규 — 파생 조회 (읽기, 영속 아님)

### RecentParticipant (getRecentParticipants 출력)
- 형태: `Participant[]`(= `{id, name, role}[]`), 최근 등장순.
- 원천: 최근 `consultation.participants` jsonb를 펼쳐 name 기준 distinct.
- 부수효과 없음(순수 읽기). 실패 시 `[]`.

## 검증 규칙 (요구 추적)

- 저장 시 `selectedChairId` 필수(FR-005). 미선택이면 저장 버튼이 빠른 체어 선택을 유도(차단이 아니라 1탭 선택).
- `participants`는 비어도 저장 가능(FR-010).
- 본문 저장은 기존 `ensureHtml`/`sanitizeRichHtml` 경유(줄바꿈·안전성 보존).
- 실시간 알림 payload에 환자정보·본문 미적재(FR-012, 기존 유지).
