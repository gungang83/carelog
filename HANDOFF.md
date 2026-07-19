# 🟣 다온 세션 카드 — spec 022 확정 완료, SQL 실행 + 마무리(배포) 대기

> 세션 65 (2026-07-05) 갱신. 브랜치 `claude/eo-announcement-structure-bkjhv5` (세션 64 브랜치 `claude/eo-sso-token-verify-w9v931`의 작업을 머지해 승계).
> 톤: 대표님 호칭 + 존댓말. 커밋 말머리 `[다온]`.

---

## ✅ 세션 65에서 완료된 것

1. **EO 레포 접근 확보**: `gungang83/eo`를 세션에 추가(add_repo) → `/workspace/eo`에 읽기 전용 클론. 새 세션에서도 필요 시 같은 방식으로 추가하면 됨.
2. **EO 공지 구조 대조 완료** → **spec 022 정합 확정, 스키마 수정 없음.**
   - EO: 단일 `announcements` 테이블(전역 공지 = workspace_id NULL·is_global=true·슈퍼어드민 발행 / 기관 내부 공지 = 원장 발행). category·status(draft/published/archived)·target_type/value·version 컬럼. 읽음은 `announcement_reads` DB 테이블. 홈 노출은 티커가 아닌 접이식 카드 리스트. EO→Carelog 게이트웨이 공지 푸시 없음.
   - Carelog 판단(기관별 알림함과 분리된 전역 announcements) = EO 모델링과 정합. 차이(레벨·pinned·노출기간·localStorage 읽음)는 티커 UX에 맞춘 의도적 단순화.
   - 상세: `specs/022-announcements/spec.md` "EO 대조 결과" 절.

## ⏭️ 남은 것

1. ~~`20260705000003_update_feed.sql` 실행~~ → ✅ 완료 · ~~spec 023 배포~~ → ✅ main 배포 (2026-07-05)
2. 대표님: `/admin/updates`에서 백필 4건(이미 7/5 공지로 안내됨) '보류' 처리 권장

## 📦 작업 현황 (spec 021·세션 63·spec 022는 2026-07-05 main 배포 완료 ✅)

| 세션 | 내용 | 마이그레이션 | 상태 |
|---|---|---|---|
| spec 021 | 상담 카드 공용화(홈=/records) + 확인 꼬리표 | `20260705000001_review_flags.sql` | ✅ SQL 실행 완료 |
| 세션 63 | 녹음 일시정지/재개 | 없음 | 코드 완료 |
| spec 022 | 공지·업데이트 티커 + 슈퍼어드민 발행 | `20260705000002_announcements.sql` | ✅ 설계 확정 · ✅ SQL 실행 완료 · ✅ main 배포 · 첫 공지 발행 확인 |
| spec 023 | 업데이트 피드(대표 전용 /admin/updates, 취사선택 발행) | `20260705000003_update_feed.sql` | ✅ SQL 실행 완료 · ✅ main 배포 |
| 세션 66 | 상담 요약 평문화(별표 제거, [라벨] 구조, 기존 기록 소급) | 없음 | ✅ main 배포 (2026-07-08) |
| spec 025 | 상담 이미지 라이브러리 + 상담 캔버스(픽커·전체화면·글감싸기) | `20260708000001_consult_assets.sql` | ✅ SQL · ✅ main 배포 |
| spec 026 | 상담 스테이지(크게 열고 그리기→기록에 담기) + 영상 링크 | `20260708000002_consult_assets_video.sql` | ✅ SQL 실행 완료 · main 배포(마무리 중) |

## ⚠️ 주의
- EO는 **읽기 전용 교차검증**만(쓰기 금지).
- `/about` 프리렌더 빌드 실패는 컨테이너 env(NEXT_PUBLIC_SUPABASE_URL) 미설정 기존 이슈 — 코드 무관.

---
_작성: 다온 · 2026-07-05 세션 65 · SQL 실행 완료. 다음 액션은 대표님 마무리 신호 → 배포._
