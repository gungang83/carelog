# Contract: 실시간 이벤트 · 토스트 · 푸시

UI/실시간 애플리케이션 계약. 외부 HTTP API 신설 없음 — 클라이언트↔Supabase Realtime 구독 + 기존 푸시 재사용.

## 1. Realtime 구독 계약 (브라우저 ↔ Supabase)

- **클라이언트**: `createBrowserSupabaseClient()` (anon key)
- **채널**: `institution:{institutionId}:chair-events` (기관별 고유)
- **이벤트**: `postgres_changes`
  - `event: 'INSERT'`
  - `schema: 'public'`, `table: 'chair_audit_logs'`
  - `filter: 'institution_id=eq.{institutionId}'`
- **수신 payload(`payload.new`)에서 사용하는 필드**:
  ```ts
  type ChairAuditEvent = {
    id: string;              // dedup
    institution_id: string;
    chair_id: string | null; // → chairs.name 해석
    consultation_id: number | null;
    event_type: "record_created" | "record_transcribed" | "record_edited" | "patient_linked" | "record_deleted";
    actor_user_id: string;   // 에코 방지
    created_at: string;
  };
  ```
- **클라이언트 처리 규칙**:
  1. `event_type !== 'record_created'` → 무시(이번 범위).
  2. `actor_user_id === currentUserId` → 토스트·소리 생략, `router.refresh()`만(에코 방지).
  3. else → 디바운스(~1.5s) → 토스트 + (armed && enabled면) 효과음 + `router.refresh()`.
  4. 채널 status `SUBSCRIBED` 재진입(재연결) → 1회 `router.refresh()`.
- **격리**: 필터 + RLS("staff reads own institution audit logs") 이중. 타 기관 수신 0.
- **보안**: payload에 진료본문·환자 식별정보 없음(`chair_audit_logs` 컬럼 한정).

## 2. 토스트(인앱 알림) 계약

- **표시 문구**: `"{chairName} · 상담 기록 도착"` (chairName = `chairs.name`, 미해석 시 "체어").
- **동작**: 화면 상단/모서리, 수 초 후 자동 사라짐, 클릭 시 미연결 기록 섹션으로 스크롤/이동(선택).
- **금지**: 환자명·진료내용·주민번호 등 일체 미표시.

## 3. 소리 활성화 계약

- `sound-arm-button`: 첫 탭(사용자 제스처)에서 `AudioContext.resume()`/무음 1회 재생으로 잠금 해제 → `localStorage.soundArmed=true`.
- 토글: `localStorage.soundEnabled`(기본 true). 재생 조건 = `soundArmed && soundEnabled`.
- 미활성 시: 시각 알림만, 소리 없음, 콘솔 에러 없음.
- 디바운스: ~1.5s 창 내 다발 → 효과음 1회.

## 4. Web Push 계약 (기존 재사용 · US3)

- `saveChairRecord` 성공 후 호출(비차단):
  ```ts
  void sendPushToInstitution(institutionId, {
    title: "새 상담 기록",
    body: `${chairName} · 상담 기록이 올라왔습니다`,
    url: "/",
  });
  ```
- payload는 기존 `PushPayload`({title, body, url, icon?}) 형태 그대로. **환자정보 미포함.**
- 권한 없거나 VAPID 미설정 시 기존 로직대로 graceful no-op(`ensureVapidConfigured`).
- 포그라운드 중복은 인앱 우선(브라우저 기본 + 필요 시 `sw.js` 포커스 체크).

## 5. Server Action 영향 (계약 유지)

- `saveChairRecord` 반환 형태 `{ ok: true, consultationId } | { ok: false, message }` **불변**.
- 푸시 추가는 fire-and-forget → 저장 성공/실패에 영향 없음(헌법 III).
- 쓰기 경로 신설 없음 — 실시간은 읽기 전용 구독(헌법 II).
