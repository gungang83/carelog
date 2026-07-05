# spec 023 — 업데이트 피드 (슈퍼어드민 전용)

**세션 65 (2026-07-05)**

## 배경
대표 요청: "업데이트 내용이 나한테만 보이는 곳에 차곡차곡 쌓여 있으면 좋겠다. 그걸 보고 자동/수동으로 업데이트 공지를 올릴지 말지 결정하고, 취사선택해서 올릴 수도 있게."
spec 022 공지 티커의 발행 앞단에, **발행 여부를 결정하는 대표 전용 인박스**를 둔다.

## 결정
- **피드 소스 = 레포 코드** `lib/update-feed.ts`의 `UPDATE_FEED` 배열. 다온이 **세션 마무리 때** "사용자에게 보이는 변경"을 엔트리(id·date·emoji·title·items·internal)로 append → 배포와 함께 자동으로 쌓인다. (에이전트가 DB에 직접 쓸 수 없는 제약을 뒤집어, 배포 파이프라인 자체를 적재 경로로 사용)
- **결정 상태 = DB** `update_feed_decisions`(entry_id PK·status·announcement_id·decided_at). RLS enable + 정책 0개(deny-all) → 서버액션(service_role + `isSuperAdmin` 가드)만 접근. **일반 직원에게는 존재 자체가 안 보인다.**
- **화면** `/admin/updates`(슈퍼어드민 전용): 피드 최신순, 상태 배지(대기/공지 발행됨/보류).
  - **취사선택**: 대기 항목 체크 → "선택 항목으로 공지 문구 만들기" → `composeAnnouncementDraft`가 제목("M/D 업데이트 — …")·본문(엔트리별 emoji+title+items 문단)을 자동 조합 → **수정 가능한 초안 폼** → 레벨·고정 선택 후 발행.
  - **발행** = announcements insert + 선택 엔트리 published 기록(공지 id 연결) — 티커에 즉시 흐름.
  - **보류** = 공지로 올리지 않음(또는 이미 다른 경로로 안내됨). **대기로 되돌리기**로 언제든 번복.
- `/admin`에 '업데이트 피드 →' 진입 링크(보라).
- **마무리 루틴 연동**: `CLAUDE.md` 마무리 체크리스트 1단계에 "사용자에게 보이는 변경이 있으면 `lib/update-feed.ts`에 엔트리 추가" 명시. 문구는 사용자 톤 + 용어 규칙("상담 기록") 준수.

## 산출물
- `supabase/migrations/20260705000003_update_feed.sql` — `update_feed_decisions`. **배포 전 적용 필요.** (미적용이어도 피드 조회는 동작 — 결정 상태만 비어 보임. 발행 시 공지는 나가고 상태 기록만 실패 안내.)
- `lib/update-feed.ts` — 타입·`UPDATE_FEED`(7/5 백필 4건: 기록 카드·확인 꼬리표·녹음 일시정지·공지 티커)·`composeAnnouncementDraft`.
- `app/actions/update-feed.ts` — `getUpdateFeed`·`publishUpdateAnnouncement`·`dismissUpdateEntries`·`clearUpdateDecision`.
- `app/(dashboard)/admin/updates/page.tsx` + `components/admin/update-feed-manager.tsx`.
- `app/(dashboard)/admin/page.tsx` — 진입 링크.

## 비범위 (후속)
- 완전 자동 발행(마무리 시 무결정 엔트리를 자동 공지). 현재는 "자동 문구 + 대표 승인" 반자동 — 오발행 방지 우선.
- 피드 엔트리의 UI 편집(현재는 발행 초안 단계에서 문구 수정으로 충분).
- 백필 4건은 이미 7/5 공지로 안내됨 → 대표가 '보류' 처리 권장(발행됨 상태는 공지 id 연결이 필요해 새 발행에만 부여).
