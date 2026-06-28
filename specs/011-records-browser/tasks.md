# Tasks: 상담 기록 열람·검색·필터 (011-records-browser)

**Tests**: 프로젝트 무 하네스 → 테스트 task 없음(수동 검증). **제약**: 스키마/마이그레이션/버킷/라이브러리 0, 환자상세 회귀 0, PII 평문 노출 0.

## Phase 1: 데이터
- [X] T001 `app/actions/consultations.ts`: `searchConsultations(filters)` 신규 — 기관범위 + patient 조인(name/chart) + 키워드(content ilike, 태그 무관 best-effort) + status(all/linked/unlinked)/chairId/patientId/기간/정렬(newest|oldest) + limit·offset. 통합행 반환(`SearchedConsultation`). 기존 함수 불변.

## Phase 2: 전체보기 화면 (US1·US3)
- [X] T002 `components/records/records-browser.tsx` 신규(client): 검색창·상태칩·체어 select·정렬 토글, 날짜별 그룹, **접이식 카드**(미리보기→펼침). 펼친 카드: 전체복사(CopyAllButton) + 연결완료면 '환자 상세에서 편집' 링크(`/patients/{id}`), 미연결이면 상태 표기. '더 보기'(offset).
- [X] T003 `app/(dashboard)/records/page.tsx` 신규: 초기 `searchConsultations` 호출 → `RecordsBrowser` 렌더. dashboard layout(maxDuration·auth) 상속.
- [X] T004 `components/home/home-feed.tsx`: '기록·활동' 헤더/전체보기 영역에 **`/records` 링크**('전체 검색·필터') 추가. 기존 인라인 펼침은 빠른 보기로 유지.

## Phase 3: 환자별 간략 보기 (US2·A6)
- [X] T005 `components/consultation-history.tsx`: 카드 **기본 접힘(간략: 제목/날짜/한두 줄)** + 클릭 시 펼침(펼친 카드만 본문·이미지·서브컨트롤 노출). 서브 컨트롤(DraftActions/RelinkControls/ConfirmedEditControls/SmsControls) 동작 보존.
- [X] T006 `components/consultation-history.tsx`: 환자 내 **키워드 검색창** — 본문 텍스트 매칭으로 카드 필터(클라이언트, 이미 로드된 목록 기준).

## Phase 4: Polish
- [X] T007 `docs/architecture.md`: /records 화면 + searchConsultations 흐름 + 환자상세 접이식 추가.
- [X] T008 `project_status.md`: 세션 기록.
- [X] T009 `npm run build` 그린(TypeScript).
- [ ] T010 (배포 후 수동) 예미안에서 검색·필터·환자별 접기 검증 + 회귀 점검.

## 의존성
T001 → T002/T003 → T004. T005 → T006(같은 파일 순차). Polish 마지막.
