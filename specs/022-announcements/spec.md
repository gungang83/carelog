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
- 사용자별 읽음 상태 DB화(현재는 localStorage last-seen 점만).
- 예약 발행 알림 푸시·기관 타겟팅(현재는 전역 즉시).
- EO ↔ Carelog 공지 동기화(중앙 EO에서 Carelog로 밀어넣기) — 게이트웨이 연동 후속.
