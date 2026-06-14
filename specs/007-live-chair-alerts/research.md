# Phase 0 Research: 실시간 체어 상담기록 알림

모든 NEEDS CLARIFICATION 해소됨(기기 = PC·안드로이드 태블릿·안드로이드 폰, iOS 범위 밖). 아래는 핵심 기술 결정.

## D1. 실시간 신호 원천 — `chair_audit_logs` 구독 (NOT `consultation`)

- **Decision**: Supabase Realtime `postgres_changes`로 **`chair_audit_logs` 테이블의 INSERT**를 `institution_id=eq.<내 기관>` 필터로 구독하고, 클라이언트에서 `event_type === 'record_created'`만 처리한다.
- **Rationale**:
  - `chair_audit_logs`는 `chair_id`·`consultation_id`·`actor_user_id`·`event_type`·`metadata({})`만 담아 **진료 본문·환자정보가 전송선에 실리지 않음**(헌법 I). `consultation`을 구독하면 `content`(진료 HTML)가 모든 열린 화면으로 브로드캐스트됨 → 불필요·과다.
  - `actor_user_id`로 **에코 방지**(본인이 올린 건 본인 화면에 토스트/소리 안 함)가 자연 해결.
  - 삽입 전용·불변 테이블이라 INSERT만 보면 됨(UPDATE/DELETE replica identity 이슈 없음).
- **Alternatives rejected**:
  - `consultation` 직접 구독 — 진료본문 브로드캐스트(프라이버시·대역), 체어 기록과 환자 상담 INSERT 혼재 필터 필요.
  - Supabase **Broadcast**(서버에서 명시 메시지 발행) — 서버 액션에서 별도 발행 코드 필요, 현 단계엔 과함. audit_logs 구독이 더 단순(헌법 IV).

## D2. RLS·publication

- **Decision**: `chair_audit_logs`를 `supabase_realtime` publication에 추가하는 **마이그레이션** 작성(`alter publication supabase_realtime add table public.chair_audit_logs;`). 기존 RLS 정책("staff reads own institution audit logs")이 구독 가시성을 기관 단위로 강제.
- **Rationale**: Realtime postgres_changes는 인증된 브라우저 클라이언트의 RLS를 따른다 → 타 기관 이벤트는 애초에 수신 불가(SC-004, 헌법 II). DB 변경은 대시보드 직접 DDL 금지 → 마이그레이션 파일 필수(헌법 기술제약).
- **Alternatives rejected**: 채널 필터만으로 격리 — RLS 없이 필터만 믿으면 위험. 둘 다 둔다(필터+RLS).

## D3. 목록 갱신 — `router.refresh()` (서버 재조회)

- **Decision**: 이벤트 수신 시 토스트를 띄우고 `router.refresh()`로 홈(미연결 기록 섹션)을 서버에서 재렌더. 실시간 payload의 데이터를 직접 목록에 주입하지 않는다.
- **Rationale**: 헌법 II(서버 데이터 권위) — 목록의 실제 진료 데이터는 항상 RLS 경유 서버 조회로만. payload는 "갱신하라"는 트리거로만 사용. 재연결 시에도 refresh로 자연 재동기화(FR-011, D6).
- **Alternatives rejected**: payload를 낙관적으로 목록에 삽입 — 진료본문 전송 필요(D1과 충돌), 권한·정합 위험.

## D4. 소리 자동재생 — 1회 활성화(arming)

- **Decision**: "🔔 알림 소리 켜기" 버튼 1회 탭으로 사용자 제스처 안에서 `AudioContext` resume(또는 무음 1회 재생)하여 오디오를 푼다. 이후 도착 시 짧은 효과음(`/sounds/alert.mp3`) 재생. 활성화·on/off 상태는 화면 단위로 `localStorage` 보관.
- **Rationale**: 브라우저 자동재생 정책상 제스처 없이 소리 불가. 항상 띄워두는 화면이라 1회 탭이면 충분(US2). localStorage라 새로고침에도 유지(SC-002).
- **Alternatives rejected**: 자동 소리 시도 — 차단되어 무음·콘솔에러. Web Speech TTS 우선 — 효과음이 더 단순·확실, TTS는 옵션 후속.

## D5. Web Push 확장 — `saveChairRecord`에 추가

- **Decision**: `saveChairRecord` 성공 후 기존 `sendPushToInstitution(institutionId, { title, body, url })`를 **await 없이 fire-and-forget** 호출. body는 "체어 이름 + 새 상담 기록 도착"(환자정보 없음), url은 홈("/").
- **Rationale**: 인프라(`push.ts`·VAPID·`push_subscriptions`·`sw.js`)가 이미 있음(헌법 IV 재사용). 기존 consultation 푸시와 동일하게 비차단 → `{ok}` 반환 지연·실패 영향 0(헌법 III). 화면 꺼진 기기 보완(US3).
- **Alternatives rejected**: 별도 푸시 경로 신설 — 중복. 동기 await — 저장 지연·실패 전파 위험.

## D6. 에코 방지·디바운스·재연결

- **에코**: payload `actor_user_id` === 현재 사용자면 토스트·소리 생략(목록 refresh는 허용). (FR-004, SC-003)
- **디바운스**: 짧은 창(예 ~1.5s) 내 다발 이벤트는 소리 1회·토스트 묶음(FR-007). 마지막 이벤트 기준 단일 refresh.
- **포그라운드 중복**: 화면 켜진 동안은 인앱 알림이 주, OS 푸시는 사실상 백그라운드에서만 표출(브라우저 기본). 추가로 `sw.js`/포커스 상태로 과표시 억제 검토(FR-010).
- **재연결**: Realtime 채널 status가 `SUBSCRIBED`로 복귀하면 1회 `router.refresh()`로 끊긴 동안 변경 보정(FR-011). 실시간 팝업은 놓칠 수 있음 → 푸시가 보완.

## D7. 마운트 위치

- **Decision**: `live-alerts-provider`를 **(dashboard) 레이아웃**(직원 인증 라우트)에 마운트 → 직원이 어느 화면에 있든 구독 활성. 환자 포털·공개 라우트엔 미마운트.
- **Rationale**: 기관 직원 전 화면 커버(FR-001), 환자/타기관 영향 0(헌법 I·II).
