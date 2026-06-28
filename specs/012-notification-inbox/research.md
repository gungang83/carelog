# Phase 0 Research: 알림함 (EO 벤치마크 + Carelog 매핑)

형식: 결정 / 근거 / 기각한 대안. (EO 코드 읽기전용 교차검증 근거)

## R1. 데이터 모델 — 2테이블 분리(메시지 vs 읽음)
**Decision**: `notifications`(broadcast 본문) + `notification_reads`(user_id×notification_id, 행 존재=읽음). EO 동형.
**Rationale**: 한 알림이 여러 수신자(all/admins)에게 broadcast → 읽음은 사람마다 독립. 행 존재로 읽음을 표현하면 멱등(upsert/delete)이 자연스럽고 "전체 읽음"이 단순.
**Alternatives**: 단일 notifications에 is_read — 수신자별 복제 필요·정합 어려움(기각).

## R2. 식별자·대상(recipients) 매핑 (EO→Carelog)
**Decision**: EO `workspace_id`→`institution_id`, EO `email`+`role(manager/clinic_admin)`→Carelog **`user_id`(읽음 키) + `institution_members.role`(대상 판정)**. recipients = `'all'` | `'admins'`(role admin) | 특정 이메일.
**Rationale**: Carelog 멀티테넌트·RLS는 institution_id·auth.uid() 기반. 읽음 키를 user_id로 두면 RLS(`auth.uid()`)로 본인만 보장 견고. EO의 manager+clinic_admin = Carelog admin.
**Alternatives**: 읽음 키 email(EO 방식) — Carelog는 user_id가 더 견고(기각, 단 recipients의 특정대상은 이메일 허용).

## R3. RLS·서버 권위
**Decision**: `notifications` select = 같은 기관 멤버(`get_my_institution_id()` 패턴, chair_audit_logs와 동일) + service_role full(서버 적재). `notification_reads` = 본인(`user_id = auth.uid()`) select/insert/delete + service_role full. 적재·조회·읽음은 서버(lib) 경유.
**Rationale**: 헌법 II/I — 기관 격리·본인 읽음을 DB로 강제. 서버는 admin client로 적재.
**Alternatives**: 클라 직접 insert — 서버 권위 위반(기각).

## R4. 실시간 — publication + 구독
**Decision**: `alter publication supabase_realtime add table public.notifications;` (chair_audit_logs와 동일 패턴). 브라우저는 `lib/realtime/institution-events.ts`에 `subscribeNotifications({institutionId,onEvent})` 추가 — `notifications` INSERT를 `institution_id=eq.` 필터로 구독. 벨은 이벤트 수신 시 목록 재fetch + **30초 폴백 폴링**.
**Rationale**: 기존 `subscribeChairEvents`와 동형(헌법 IV, 한 곳). 알림 본문엔 PII 없음 → realtime 전송선 안전(헌법 I). 폴백으로 연결 끊김 보완.
**Alternatives**: 폴링만 — 지연·부하(기각). 직접 새 채널 모듈 — 기존 institution-events 재사용이 단순(기각).

## R5. 생성 흐름 — sendNotification 통합 + 배선
**Decision**: `lib/notifications.ts` `sendNotification({title,body,type,link,recipients,institutionId,createdBy?})` = `notifications` insert(admin) **+** 기존 `sendPushToInstitution` 호출. 기존 푸시 호출부에 배선:
- `app/actions/chairs.ts` `saveChairRecord`(새 상담 기록 저장, 현 sendPushToInstitution) → `sendNotification({type:'consultation_saved', link:'/records', recipients:'all'})`
- `app/actions/consultations.ts` `saveConsultation` → 동일 패턴(link 환자상세 등)
적재 실패는 비차단(상담 저장·푸시를 막지 않음).
**Rationale**: "그동안 푸시가 다 알림함에 뜨고"의 실현 = 푸시 지점에서 함께 적재. 한 함수로 단일화(헌법 IV).
**Alternatives**: 별도 적재 호출 산재 — 누락·중복 위험(기각).

## R6. 조회·읽음 로직 (EO 동형)
**Decision**: `getNotifications({userId,email,role,institutionId})` = 기관 알림 100건(최신순) + 내 read 행 → isRead 계산 → recipients 필터(all / admins=role admin / 이메일==본인) → 50건. `markRead`(upsert onConflict notification_id,user_id) / `markUnread`(delete) / `markAllRead`(미읽음 dedup 후 일괄 upsert — EO의 "ON CONFLICT cannot affect row a second time" 버그 회피).
**Rationale**: EO 검증된 로직 그대로(중복 dedup 포함).

## R7. API 표면 (EO 동형, Carelog 인증)
**Decision**: Route Handler 4개 — `GET /api/notifications`, `POST /api/notifications/[id]/read`, `PATCH /api/notifications/[id]/read {is_read:false}`, `POST /api/notifications/read-all`. 인증=`getSessionUser`(Supabase 세션), 역할=`institution_members`. 라우트는 얇게 lib 위임.
**Rationale**: EO 동형 + 벨이 fetch로 소비(실시간/폴링과 자연). Next 16 동적 라우트 `[id]`는 `params: Promise<{id}>` await(번들 문서 확인).
**Alternatives**: Server Actions — 가능하나 fetch 기반 벨엔 Route Handler가 단순(EO 동형).

## R8. 벨 UX·PWA 배지
**Decision**: `components/notifications/notification-bell.tsx` — 종 + 미읽음 배지(9+), 드롭다운(타입아이콘·제목·본문·상대시간·미읽음 강조+점·읽음 ✓토글·전체읽음), 클릭→읽음+링크 이동, 외부클릭 닫기, `navigator.setAppBadge`(미읽음). Carelog 팔레트(sky/emerald). 헤더 RefreshButton/SoundArmButton 옆 배치. 하단 '알림 설정' 링크는 설정 페이지 없으므로 **생략**(후속).
**Rationale**: EO UX 그대로, 색만 Carelog화. setAppBadge는 지원 기기에서만(가드).

## R9. 백필
**Decision**: 1차 **미포함**(가는 시점부터 누적). 후속에서 필요 시 `chair_audit_logs`(record_created)·`consultation`에서 시드.
**Rationale**: 과거 푸시는 미적재라 완전 소급 불가. 초기 빈 화면은 곧 이벤트로 채워짐. 시드는 별 작업.

## R10. 타입(consultation.id 등) 주의
**Decision**: `notification_reads.notification_id`는 `notifications.id`(uuid) FK. `notifications`는 자체 uuid pk(상담 id와 무관). link는 텍스트 경로(`/records`, `/patients/{id}`).
**Rationale**: 알림은 어떤 도메인 이벤트든 담는 일반 컨테이너 → 자체 uuid가 단순. (audio_replay_logs가 consultation.id=bigint인 점과 무관.)
