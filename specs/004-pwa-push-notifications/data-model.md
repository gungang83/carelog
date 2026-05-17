# Data Model: Carelog PWA + 푸시 알림

## New Entities

### push_subscriptions

푸시 알림을 수신할 기기의 Web Push 구독 정보.

| Column          | Type        | Constraints          | Description                       |
|----------------|-------------|----------------------|-----------------------------------|
| id             | uuid        | PK, default gen_uuid | 구독 ID                           |
| user_id        | uuid        | NOT NULL             | Supabase auth.users.id            |
| institution_id | uuid        | NOT NULL             | 소속 기관 ID                      |
| endpoint       | text        | NOT NULL             | Web Push 수신 엔드포인트 URL      |
| p256dh         | text        | NOT NULL             | 암호화 공개키                     |
| auth           | text        | NOT NULL             | 인증 시크릿                       |
| created_at     | timestamptz | NOT NULL, default now| 구독 생성 시각                    |

**Unique constraint**: `(user_id, endpoint)` — 동일 사용자의 동일 기기 중복 구독 방지.

**RLS Policies**:
- `SELECT`: 본인 구독만 조회 (`user_id = auth.uid()`)
- `INSERT`: 본인 구독만 생성 (`user_id = auth.uid()`)
- `DELETE`: 본인 구독만 삭제 (`user_id = auth.uid()`)

**Index**: `(institution_id)` — 기관별 전체 구독 조회용 (알림 발송 시).

---

## Existing Entities (unchanged)

### consultation
- `id` (bigint), `patient_id` (bigint), `institution_id` (uuid) — 알림 트리거 소스

### activity_logs
- `consultation_id` (bigint), `institution_id` (uuid) — 활동 피드 이벤트 소스

### institution_members
- `user_id` (uuid), `institution_id` (uuid) — 기관 구성원 확인용

---

## Environment Variables (new)

| Variable              | Description                                      |
|----------------------|--------------------------------------------------|
| VAPID_PUBLIC_KEY     | Web Push VAPID 공개키 (클라이언트에 전달)        |
| VAPID_PRIVATE_KEY    | Web Push VAPID 비밀키 (서버 전용)                |
| VAPID_SUBJECT        | VAPID 연락처 (mailto: or https:)                 |
| NEXT_PUBLIC_VAPID_PUBLIC_KEY | 클라이언트에서 구독 시 사용하는 공개키   |
