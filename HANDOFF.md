# 🟣 다음 세션 카드 — EO 공지 구조 대조 → spec 022 마무리

> 대상: **새 세션 다온**. 대표님이 새 세션을 여는 이유 = 이 세션에선 EO 레포 접근이 스코프 밖이라 막혔고,
> 환경설정(레포 추가)은 **새 세션부터** 반영되기 때문. 세션 시작 후 아래를 순서대로.
> 톤: 대표님 호칭 + 존댓말. 커밋 말머리 `[다온]`. 브랜치 `claude/eo-sso-token-verify-w9v931`.

---

## ⚡ 최우선 액션 (이 카드의 목적)

1. **EO 레포 접근 확인**: `gungang83/EO` (private). GitHub MCP로 읽기 시도.
   - 안 되면 → 스코프에 아직 EO가 없는 것. 대표님께 "이 세션도 carelog만 잡힌다"고 알리고 레포명 재확인.
   - 되면 → 아래 대조 진행.
2. **EO의 '공지/업데이트/알림' 구조 확인** (Carelog spec 022 `announcements`와 대조할 원본):
   - 찾을 것: 공지(announcement/notice) 테이블 스키마, 발행 주체·발행 UI, 홈 티커/배너 유무, 레벨·노출기간·고정 개념, 사용자별 읽음 처리 방식, EO→Carelog 푸시(게이트웨이) 여부.
   - 후보 경로: `supabase/migrations/`, `supabase/schema.sql`, `app/**/notice|announce|notification`, `components/**`, `specs/**`.
   - 참고 계약: `docs/eo-carelog-integration.md`(Carelog 측 기록), `specs/016-carelog-integration/` (EO 정본 계약 언급).
3. **대조 결과로 `announcements` 설계 조정 판단**:
   - EO와 크게 다르면 → 마이그레이션 `supabase/migrations/20260705000002_announcements.sql` + `lib/announcements.ts` + 액션/컴포넌트 수정.
   - 대체로 맞으면 → 그대로 확정하고 대표님께 "EO와 정합, 이대로 SQL 실행하시면 됩니다" 보고.
4. **확정 후에만** 대표님께 마이그레이션 SQL 실행 요청(대표님이 Supabase SQL Editor에서 직접 실행. 에이전트엔 DB 크레덴셜 없음).

---

## 📦 지금까지 배포 브랜치에 쌓인 것 (push 완료, **main 미배포**)

| 세션 | 내용 | 마이그레이션 | 상태 |
|---|---|---|---|
| spec 021 | 상담 카드 공용화(홈=/records 동일) + 확인 꼬리표 | `20260705000001_review_flags.sql` | ✅ 대표님 **SQL 실행 완료** |
| 세션 63 | 녹음 일시정지/재개 | 없음(DB 변경 없음) | 코드 완료 |
| spec 022 | 공지·업데이트 티커(홈 헤더 아래) + 슈퍼어드민 발행 | `20260705000002_announcements.sql` | ⚠️ **SQL 미실행** (EO 대조 후 실행) |

- **spec 022 SQL 미실행 상태여도 안전**: 테이블 없으면 `getActiveAnnouncements`가 빈 배열 → 티커 렌더 안 됨(에러 없음). 기존 화면 영향 0.
- **배포(마무리) 대기**: 위 3건 모두. 대표님이 "마무리" 신호 주면 `CLAUDE.md` 마무리 프로토콜 5단계(문서→빌드→커밋→main 머지→Vercel).

---

## 🗺️ spec 022에서 만든/고친 파일 (대조 시 볼 곳)

- `supabase/migrations/20260705000002_announcements.sql` — 전역 `announcements`(institution_id 없음). 직원 read RLS / service_role write.
- `lib/announcements.ts` — 타입 + 레벨 config(update/notice/info, 확장형).
- `app/actions/announcements.ts` — `getActiveAnnouncements`(직원) + 슈퍼어드민 CRUD(`listAll`·`create`·`setActive`·`setPinned`·`delete`, `isSuperAdmin` 가드 + admin 클라).
- `components/announcements/announcement-ticker.tsx` — 홈 헤더 아래 마퀴 티커('전체보기' → `/announcements`, localStorage 새-공지 점).
- `app/(dashboard)/announcements/page.tsx` — 전체보기.
- `app/(dashboard)/admin/announcements/page.tsx` + `components/admin/announcement-manager.tsx` — 발행/관리.
- `app/(dashboard)/page.tsx` — 티커 배선(헤더 아래 전체폭). `app/globals.css` — `carelog-marquee` 키프레임. `app/(dashboard)/admin/page.tsx` — '공지 발행' 링크.
- 스펙: `specs/022-announcements/spec.md`.

## 🧭 설계 근거(왜 별도 전역 테이블인가)

알림함(`notifications`, spec 012)은 **기관별**(institution_id NOT NULL)이라 전 기관 공통 공지에 부적합 → 중앙 발행 전역 공지는 `announcements`로 분리. **EO 대조에서 이 판단이 맞는지 재확인이 핵심.** (EO가 전역 공지를 어떻게 모델링했는지 보고 정합 맞추기.)

## ⚠️ 주의
- EO는 **읽기 전용 교차검증**만(단방향 불변). EO 레포에 쓰기 금지.
- 지침상 허용 스코프 밖 레포를 우회 검색하지 말 것. EO가 스코프에 잡혀야만 진행.
- `/about` 프리렌더 빌드 실패는 컨테이너 env(NEXT_PUBLIC_SUPABASE_URL) 미설정 기존 이슈 — 코드 무관. clean 트리에서도 동일.

---
_작성: 다온 · 2026-07-05 세션 64 · 다음 세션은 EO 확인부터._
