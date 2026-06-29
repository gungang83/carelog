# Tasks: 점진 청크 전사 + 상담 종료/자동저장 (spec 016)

상태: 구현 완료(✅). 검증(T08)은 예미안 수동(청크 점진·자동저장·실패) 대기.

| # | 작업 | 파일 | 상태 |
|---|---|---|---|
| T01 | 청크 구간 완료 콜백(onSegmentReady) + registerSegmentHandler | `components/chair/chair-provider.tsx` | ✅ |
| T02 | 에디터 getHTML() 핸들(자동저장 동기 캡처) | `components/rich-text-editor.tsx` | ✅ |
| T03 | 점진 전사: handleStart 등록 + finalizeChunked + finishChunkTexts(라이브/복구 공용) | `components/chair/consultation-board.tsx` | ✅ |
| T04 | 자동저장: handleStopAndSave + doAutoSave(저장·업로드·정리·닫기) | `components/chair/consultation-board.tsx` | ✅ |
| T05 | 버튼 개명("상담 종료") + "상담 종료 및 저장" + 진행 표시(구간 전사됨·저장 예정) | `components/chair/consultation-board.tsx` | ✅ |
| T06 | 실패 안전망: reportAutoSaveFailure 서버 로그 + 임시본 보존 + 안내 | `app/actions/chairs.ts`, board | ✅ |
| T07 | 문서(architecture·project_status) | 각 문서 | ✅ |
| T08 | 빌드 그린 + 예미안 수동 검증 | — | 빌드 ✅ / 수동검증 대기 |
