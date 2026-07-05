# spec 021 — 상담 카드 공용화 + 확인 꼬리표 (review flags)

**세션 62 (2026-07-05)** · 7/5 김도은 선생 회의 후속

## 배경
상담 생성 알림을 누르면 `/records`(상담 기록 전체보기)로 간다. 그런데 홈 화면에서 되던 카드 처리(전체복사·음성듣기·편집·삭제·환자연결)가 `/records`에서는 안 됐다. 담당(김도은 선생)이 정리 내용을 실제 차트에 옮기기 전 "이 부분은 확인이 필요하다"고 표시해 둘 방법도 없었다.

## 목표
1. **/records 카드 처리 = 홈과 완전 동일.** 연결 카드/미연결 카드에 따라 액션이 갈린다.
2. **확인 필요 '꼬리표'.** 어떤 환자인지·어느 원장/직원인지·어디(체어)인지·내용 정확성 등 확인할 항목을 카드에 달고, 확인되면 완료(resolve)하거나 삭제. **확장형 타입**.

## 결정
- **공용 컴포넌트 추출.** 홈 `home-feed`의 연결/미연결 카드 로직을 `components/consultation/consultation-card.tsx`(`ConsultationCard`/`CardRecord`)로 뽑아 홈·`/records` 양쪽이 재사용 → 액션·디자인이 코드 레벨에서 일치. (네비게이션으로 넘기는 대신 완전 동일 렌더)
- **꼬리표 타입 5종 기본**(확장형): 👤환자 확인 · 🩺참여자 확인 · 🪑장소·체어 확인 · 📝내용 정확성 · 🏷️기타. `lib/review-flags.ts` `REVIEW_FLAG_TYPES`에 한 줄 추가로 확장.
- **완료/삭제 둘 다.** ✓ = resolved(기록 남김, resolved_by/at), ✕ = 삭제.
- **멤버십 RLS**(소속 기관 한정), `my_institution_ids()`(spec 세션61) 재사용.

## 산출물
- `supabase/migrations/20260705000001_review_flags.sql` — `consultation_review_flags` 테이블(+인덱스+RLS). **배포 전 적용 필수.**
- `lib/review-flags.ts` — 타입 config·`ReviewFlag`·`flagMeta`.
- `app/actions/review-flags.ts` — `getReviewFlagsFor`(일괄)·`addReviewFlag`·`resolveReviewFlag`·`deleteReviewFlag`.
- `components/consultation/review-flags.tsx` — 칩 UI + 피커.
- `components/consultation/consultation-card.tsx` — 공용 카드(꼬리표 통합).
- `components/home/home-feed.tsx` — 공용 카드로 리팩터(중복 렌더 제거).
- `components/records/records-browser.tsx` — 공용 카드로 리팩터 + '확인 필요만' 필터.
- `app/actions/consultations.ts` — `searchConsultations`에 `participants` 추가(미연결 편집 시 보존).

## 비범위 (후속)
- 녹음 중 **일시정지(pause)** 기능 — 이번엔 기술 검토만(별도 spec 예정).
- 꼬리표 서버 집계·리포트·알림(누가 얼마나 미확인인지).
