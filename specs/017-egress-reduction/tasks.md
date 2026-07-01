# Tasks: 이그레스 절감 (spec 017)

상태: 구현 완료(✅). DB 마이그레이션 없음.

| # | 작업 | 파일 | 상태 |
|---|---|---|---|
| T01 | 이미지 최적화 lib(압축·변환URL·본문HTML) | `lib/image/optimize.ts` | ✅ |
| T02 | 업로드 압축 배선(단일 경로) | `components/rich-text-editor.tsx` (uploadImage) | ✅ |
| T03 | 본문 렌더 변환+lazy | `home-feed.tsx`·`records-browser.tsx`·`consultation-history.tsx`·`patient-records-list.tsx` | ✅ |
| T04 | 갤러리/썸네일 변환+lazy | `consultation-history.tsx`·`patient-records-list.tsx`·`view/[consultationId]/page.tsx` | ✅ |
| T05 | 변환 off 안전장치(NEXT_PUBLIC_IMG_TRANSFORM) | `lib/image/optimize.ts` | ✅ |
| T06 | 문서(architecture·project_status) | 각 문서 | ✅ |
| T07 | 빌드 그린 + 배포 + 이그레스 추이 모니터 | — | 빌드 ✅ / 모니터 대기 |
