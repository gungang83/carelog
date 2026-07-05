# spec 022 — 공지·업데이트 티커 (announcements)

**세션 64 (2026-07-05)**

## 배경
홈 헤더 바로 아래에 '업데이트 내용'·'공지사항'이 한 줄로 은은히 흐르면(놓친 부분을 '전체보기'로) 좋겠다는 요청. 공지는 **중앙(Carelog/EO 슈퍼어드민)에서 내보내는** 것. EO의 알림 구조를 참조.

> 참고: EO 레포는 이번 세션 GitHub 접근 범위 밖 → Carelog에 이미 EO에서 포팅된 **알림함(spec 012)** 을 참조 기준으로 삼음. 알림함(`notifications`)은 **기관별**(institution_id NOT NULL)이라 전 기관 공통 공지에는 부적합 → 별도 **전역** 테이블을 둔다.

## 결정
- **전역 `announcements` 테이블**(institution_id 없음). 한 번 발행하면 모든 워크스페이스가 같은 공지를 본다. 발행/수정은 **service_role(슈퍼어드민 서버액션)** 만, 직원(authenticated)은 **활성 + 노출기간 내** 공지 읽기(RLS).
- **은은한 티커**: 홈 헤더 아래 전체폭 한 줄, 작은 회색 글씨, seamless 마퀴(globals.css). hover/focus 시 정지(읽을 수 있게), `prefers-reduced-motion`이면 정지.
- **전체보기** → `/announcements` 페이지(고정 우선·최신순, 상세·링크·발행자). '새 공지' 점은 localStorage last-seen 비교(DB 읽음테이블 없이 가볍게).
- **발행 UI**: `/admin/announcements`(슈퍼어드민 전용) — 제목·상세·링크·레벨·고정·노출종료 발행 + 목록(노출 토글·고정·삭제).
- **레벨 확장형**: update(✨)·notice(📢)·info(ℹ️), `lib/announcements.ts`에 한 줄로 확장.

## 산출물
- `supabase/migrations/20260705000002_announcements.sql` — `announcements` 테이블 + RLS(직원 read / service_role write). **배포 전 적용 필수.**
- `lib/announcements.ts` — 타입·레벨 config.
- `app/actions/announcements.ts` — `getActiveAnnouncements`(직원) + 슈퍼어드민 CRUD(`listAll`·`create`·`setActive`·`setPinned`·`delete`, isSuperAdmin 가드 + admin 클라).
- `components/announcements/announcement-ticker.tsx` — 홈 티커.
- `app/(dashboard)/announcements/page.tsx` — 전체보기.
- `app/(dashboard)/admin/announcements/page.tsx` + `components/admin/announcement-manager.tsx` — 발행/관리.
- `app/(dashboard)/page.tsx` — 티커 배선(헤더 아래 전체폭). `/admin`에 '공지 발행' 링크. `app/globals.css` 마퀴 키프레임.

## 비범위 (후속)
- 사용자별 읽음 상태 DB화(현재는 localStorage last-seen 점만). → EO는 `announcement_reads`(announcement_id·email·read_at) 테이블 사용 — DB화 시 이 모델 참조.
- 예약 발행 알림 푸시·기관 타겟팅(현재는 전역 즉시). → EO는 target_type(all|clinic_type|workspace|employees)+target_value jsonb — 타겟팅 도입 시 참조.
- EO ↔ Carelog 공지 동기화(중앙 EO에서 Carelog로 밀어넣기) — 게이트웨이 연동 후속. 연동 시 `source`·`external_id` 컬럼 ALTER 추가로 대응(현 스키마 변경 불필요).

## EO 대조 결과 (세션 65, 2026-07-05) — 정합 확정 ✅

EO 원본(`gungang83/eo`) 읽기 전용 대조 완료. **핵심 판단 — "중앙 발행 전역 공지는 기관별 알림함(notifications)과 분리" — 은 EO 모델링과 정합.** 스키마 수정 없이 이대로 확정, 마이그레이션 SQL 실행 가능.

- **EO 스키마**: 단일 `announcements` 테이블이 **전역 공지**(is_global=true, workspace_id NULL, 슈퍼어드민=isEoOwner 발행)와 **기관 내부 공지**(원장/ANNOUNCEMENT_MANAGE 권한 발행)를 겸함. 주요 컬럼: `type`(eo|clinic)·`category`(general|update|hr|maintenance|event)·`status`(draft|published|archived)·`target_type`/`target_value`(전역 타겟팅)·`version`(릴리즈노트 유니크). EO도 전역 공지는 workspace 스코프 밖(NULL) — Carelog의 "전역 테이블" 판단과 동일 구조. Carelog는 기관 내부 공지 기능이 없으므로(기관별 전달은 알림함 담당) **전역 전용 테이블로 충분**.
- **읽음 처리**: EO는 `announcement_reads` DB 테이블(upsert). Carelog v1은 localStorage last-seen — 후속 DB화 시 EO 모델 따라가면 됨.
- **홈 노출**: EO는 티커가 아니라 홈의 접이식 공지 카드 리스트(`HomeClient` AnnouncementCards, 카테고리 숨김은 localStorage). **마퀴 티커는 Carelog 고유 UX(대표님 요청)** 로 유지.
- **레벨·고정·노출기간**: EO엔 없음(카테고리·status로 대체). Carelog의 `level`(표시 톤)·`pinned`·`starts_at/ends_at`은 한 줄 티커 특성상 필요한 개념이라 유지.
- **EO→Carelog 공지 푸시**: 게이트웨이(`api/gateway/carelog/master`)에 공지 연동 없음(마스터 데이터만). 후속 항목 그대로 유지.
- **접근 모델 차이**: EO는 NextAuth+service_role API 라우트(RLS 비의존), Carelog는 Supabase Auth라 직원 read RLS + service_role write가 더 적절 — 인증 스택 차이일 뿐 설계 불일치 아님.
- **발행 시 푸시**: EO는 발행 시 `sendNotification`(알림 엔진, 전 직원)을 함께 쏨. Carelog도 후속으로 알림함(spec 012) 연계 발송 고려 가능.
