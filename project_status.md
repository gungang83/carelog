# Carelog 프로젝트 상태

> **제품 정체성(SSOT)**: Carelog는 **환자 전용 서비스가 아니다.** 의료기관 상담 기록(B2B) ↔ 환자 평생 보관·생애주기 건강관리(B2C)를 잇는 **연결고리**. 상세: [docs/product-vision.md](docs/product-vision.md)

**최종 업데이트**: 2026-07-08 (세션 66d — 견적 빌더 spec 028 + 동의서(a안)·빈 캔버스: '₩ 견적' 빌더(프리셋 treatment_items→[치료비 견적] 평문 블록), 픽커 빈 캔버스(백지/모눈/줄노트→스테이지), consent 카테고리. 마이그레이션 20260708000003 필요) · 2026-07-08 (세션 66c — 상담 스테이지 spec 026: 자료·기록 이미지를 전체화면으로 열어 그리며 설명(주석도구 재사용) → '기록에 담기'로 스냅샷 삽입. 영상 링크 자산(외부 URL) 등록→기록에 삽입→표시 시 자동 링크화(환자 전달). 마이그레이션 20260708000002 필요) · 2026-07-08 (세션 66b — 상담 이미지 라이브러리+상담 캔버스 spec 025: 기관이 설명 이미지를 미리 등록(/settings 상담 자료) → 상담 에디터 '📚 자료' 픽커로 삽입(카테고리·검색·확대 미리보기·즉석 업로드). 에디터 전체화면 + 이미지 글감싸기/가운데 정렬(왼쪽 2장=나란히). 마이그레이션 20260708000001 필요) · 2026-07-08 (세션 66 — 상담 요약 평문화: AI 요약의 마크다운(**·##) 제거. 프롬프트 5경로 [라벨] 구조 평문 지시 + stripMarkdownMarkers로 기존 기록도 표시·복사 시 소급 정리. DB 변경 없음) · 2026-07-05 (세션 65b — 업데이트 피드 spec 023: 대표 전용 /admin/updates 인박스. 세션 마무리마다 lib/update-feed.ts에 업데이트 내역 append(배포=적재) → 취사선택 → 공지 문구 자동 조합·수정 → 발행/보류. update_feed_decisions(RLS deny-all, service_role만). 마이그레이션 20260705000003 실행 완료 ✅) · 2026-07-05 (세션 65 — EO 공지 구조 대조 → spec 022 확정: EO 원본(announcements 단일 테이블·전역=workspace_id NULL·announcement_reads 읽음테이블·타겟팅·draft/published 상태) 읽기 대조 결과 "전역 announcements 분리" 판단 정합 확인. 스키마 수정 없이 확정 — 마이그레이션 20260705000002 실행 완료 ✅) · 2026-07-05 (세션 64 — 공지·업데이트 티커 spec 022: 홈 헤더 아래 전역 공지가 은은히 흐르는 마퀴 한 줄 + '전체보기'(/announcements). 중앙(슈퍼어드민)이 /admin/announcements에서 발행 → 전 워크스페이스 공통. 전역 announcements 테이블(직원 read RLS / service_role write). 마이그레이션 20260705000002 필요) · 2026-07-05 (세션 63 — 녹음 일시정지/재개: 상담보드·체어 오버레이 녹음 바에 '일시정지'/'이어서 녹음' 버튼. MediaRecorder.pause()/resume()로 스트림 유지·타이머 freeze, 청크 모드는 구간 회전 타이머 함께 정지/복원. DB 변경 없음) · 2026-07-05 (세션 62 — 상담 카드 공용화 + 확인 꼬리표 spec 021: /records 카드 처리 기능을 홈과 완전 동일하게 통일(공용 ConsultationCard — 연결/미연결별 전체복사·음성듣기·편집·삭제·환자연결), 담당이 차트 이관 전 확인할 항목을 다는 '확인 필요' 꼬리표(추가·완료·삭제, 확장형 타입) + /records '확인 필요만' 필터. 마이그레이션 20260705000001 필요) · 2026-06-29 (세션 61 — 멀티워크스페이스 RLS fix: get_my_institution_id() limit1 → my_institution_ids() 멤버십 기반. 여러 기관 소속 사용자 전환 복구(대표가 본원 예미안치과 접근 막혔던 문제 해결). 마이그레이션 20260629000003 필요) · 2026-06-29 (세션 60 — 긴 녹음 자동 서버우회 spec 020 FR-008: '상담 종료'도 3분↑ 녹음은 서버 비동기로 자동 전환→전 워크스페이스(비-lab 포함) 'This page couldn't load' 크래시 방지) · 2026-06-29 (세션 59 — 서버 비동기 전사 spec 020: '상담 종료 및 저장'을 서버 위임으로. 음성만 올리고 즉시 종료→워커가 전사·요약→완료 알림. 탭 닫아도 OK. 마이그레이션 transcription_jobs 필요) · 2026-06-29 (세션 58 — 운영자별 일일 리포트 spec 019: 기관 관리자에게 자기 워크스페이스 리포트 발송(알림함·푸시억제) + /reports/daily/[date] 관리자 페이지) · 2026-06-29 (세션 57 — 일일 서버(인프라) 리포트 spec 018: 일일 리포트에 스토리지·DB·신규생성·증가추이 섹션 + 스토리지 급증 경고. 마이그레이션 get_infra_usage 필요) · 2026-06-29 (세션 56 — 이그레스 절감 spec 017: Supabase 5GB 초과 정지→Pro 복구 후 재발방지. 이미지 업로드 압축(webp)+표시 변환+lazy, off 안전장치) · 2026-06-29 (세션 55 — 점진 청크 전사 + 상담 종료/자동저장 spec 016: 녹음 중 구간 백그라운드 전사로 종료 대기 단축 + 종료 및 저장 자동저장·실패 안전망) · 2026-06-29 (세션 54 — 사용량 필터 고도화 spec 015: 기간 직접지정·사용자별 조회·검색형 드롭다운·리포트 날짜선택) · 2026-06-29 (세션 53 — 일일 사용 리포트 spec 014: KST 0~24시 메뉴·토큰·크레딧 집계, 매일 아침 슈퍼어드민 알림+웹푸시, 실토큰 캡처) · 2026-06-28 (세션 52 — 사용량·크레딧 대시보드 spec 013: EO menu-usage+크레딧 벤치마크, 메뉴추적+AI크레딧 원장·통계) · 2026-06-28 (세션 51b — 슈퍼어드민 기관명 깨짐(mojibake) fix: SSO verifyJwt UTF-8 디코드 + 과거데이터 복구) · 2026-06-28 (세션 51 — 알림함 spec 012: EO 벤치마크 포팅, 종+읽음관리+실시간) · 2026-06-28 (세션 50 — /records 빈화면 수정 + 홈 연결완료 카드 통일) · 2026-06-28 (세션 49 — 상담 기록 열람·검색·필터 + 환자별 간략 보기 spec 011) · 2026-06-28 (세션 48 — 예미안 피드백 1차: 중복등록·이름표기·녹음 안내문) · 2026-06-28 (세션 47 — 긴 상담 청크 분할 전사 모드 spec 010 구현: 분할녹음·구간전사·실패격리·복구) · 2026-06-27 (세션 46 — 전사 모드 3종 추가: 빠른메모·상세요약·용어보정, 실험실 픽커) · 2026-06-27 (세션 45 — 긴 상담 녹음 전사 유실 버그 fix: maxDuration page레벨·비트레이트↓·복구 재전사) · 2026-06-26 (세션 44 — 미연결 기록 체어·참여자 편집 + 요약 제목 브랜딩) · 2026-06-25 (세션 43 — 녹음 엔진 picker UX: 홈 히어로 이동·디자인 정리·상담 카피) · 2026-06-24 (세션 42 — C-07 + 오늘의 치과 미팅 기획 + 녹음 엔진 실험실 v1)
**현재 버전**: main 브랜치

---

## 2026-07-08 세션 66d (feat) — 견적 빌더 (spec 028) + 동의서(a안)·빈 캔버스

- **견적 빌더**: 에디터 '₩ 견적' → 프리셋(설정→치료 항목·수가, `treatment_items` 테이블) 탭으로 행 추가·수량 스텝퍼·직접 입력·할인(음수 단가)·합계 자동·메모 → **[치료비 견적] 평문 블록** 삽입(`formatEstimateBlock`, 형식 고정 — 표 아님: 차트 전체복사 유지·후속 상담 데이터화 파싱 대상). 견적 자체는 DB 미저장.
- **빈 캔버스**(스토리지·DB 불필요): 픽커 상단 백지/모눈/줄노트 버튼 — 클라 canvas로 생성해 바로 스테이지로 열고 그리기 → '기록에 담기' 시에만 업로드.
- **동의서(a안, spec 026 §6.5)**: consult_assets 카테고리 `consent` 추가 — 동의서 이미지를 스테이지에서 설명·펜 서명 후 기록에 담는 흐름(법정 동의서 대체 주장 없음, 변호사 자문은 roadmap '나중').
- **마이그레이션**(`20260708000003_treatment_items.sql`) 실행 필요. 미실행 시 견적 빌더 프리셋만 빈 목록(직접 입력은 동작), 기존 화면 영향 0.

## 2026-07-08 세션 66c (feat) — 상담 스테이지 + 영상 링크 (spec 026 P1·P2)

7/8 김도은 회의 후속. 기획(스테이지 레이어) 대표 확정: ① 기록 속 이미지도 다시 열어 그리기 ② 외부 영상 링크 ③ 바로 착수.

- **스테이지**: 픽커 미리보기 '🖊 크게 열고 그리기' + 에디터 이미지 선택 시 '🖊 크게' — 전체화면 주석도구(ImageAnnotator 재사용: 펜·화살표·도형·텍스트·지우개·터치·핀치줌, saveLabel='기록에 담기') → 그린 스냅샷 업로드 후 에디터 삽입(기록 이미지는 해당 위치 바로 뒤). 3환경(모니터+마우스/태블릿+펜/상담실) 단일 화면 대응.
- **영상 링크**(`kind='video_link'`+`link_url`): /settings 등록 폼에 '▶ 영상 링크' 모드(외부 URL만 — 파일 업로드는 이그레스·체어타임 보호로 제외). 픽커에서 ▶ 표시, '기록에 넣기' → 본문에 "▶ 제목 (영상): URL" 평문 삽입.
- **표시 파이프라인 통합**(`lib/content-html.ts` `renderContentHtml`): 마커 제거→URL 자동 링크화→이미지 최적화. 카드·환자 상세·환자 포털 공용(영상 링크가 포털에서 클릭 시청 가능). 전체 복사는 URL 텍스트 그대로(차트 안전).
- **마이그레이션**(`20260708000002_consult_assets_video.sql`) ✅ 실행 완료(2026-07-08, kind·link_url 컬럼).
- 후속(P3): 동의서 펜 서명(법적 검토 병행), 견적 블록. 상담 세션 지속성 항목은 spec 027 트랙.

## 2026-07-08 세션 66b (feat) — 상담 이미지 라이브러리 + 상담 캔버스 (spec 025)

대표 요청: 미리 넣어둔 이미지로 상담. 기획 v2 확정(템플릿 프리셋 폐기 → 상담 중 계속 꺼내 쓰는 픽커 + 에디터 강화, 전역 콘텐츠는 후속).

- **라이브러리**(`consult_assets` + `consult-assets` 공개 버킷): /settings '상담 자료'(owner/admin) — 업로드(제목·카테고리 8종·캡션, 클라 webp 압축→서버액션 service_role 업로드)·숨김·삭제(스토리지 원본은 보존 — 기존 기록 이미지 보호). RLS read=멤버십+활성 전역 / write=owner·admin.
- **픽커**(`asset-picker.tsx`): 에디터 툴바 '📚 자료' — 카테고리 칩·검색·확대 미리보기·캡션 동반 삽입 옵션·즉석 업로드(등록+삽입 동시).
- **상담 캔버스**(rich-text-editor): ⛶ 전체화면 토글(상담 동안 크게), 이미지 선택 시 글감싸기(좌/우 float)·가운데 정렬 버튼(data-align, 저장 HTML 인라인 style → 카드·포털 표시 그대로), 왼쪽 글감싸기 2장 연속=나란히. globals.css clearfix.
- 스키마는 전역(Carelog 제공, institution_id null) 확장 준비 — 발행 UI는 후속.
- **마이그레이션**(`20260708000001_consult_assets.sql`) ✅ 실행 완료(2026-07-08, 테이블+RLS+버킷).

## 2026-07-08 세션 66 (fix) — 상담 요약 평문화 (마크다운 별표 제거, [라벨] 구조)

대표 피드백: 긴 상담 요약을 차트에 붙였더니 `**`(굵게 마크다운)가 그대로 노출되어 읽기 헷갈림. 원인 = AI 요약 프롬프트가 `##` 마크다운 제목을 지시 → 모델이 문서 전체를 마크다운 톤으로 생성 + '전체 복사'는 원문 그대로 복사. 어떤 화면(케어로그·전자차트)도 마크다운을 렌더하지 않아 순수 노이즈.

- **프롬프트 평문화**(`app/actions/transcribe.ts`): 공용 `PLAINTEXT_RULES`(마크다운 금지, 섹션=[라벨], 빈 줄 구분) — basic·detailed·dental·multilingual·chunk 5개 경로 모두 적용. 제목도 `##` 없이 "치과 상담 기록 요약 - Carelog".
- **기존 기록 소급**(`lib/summary-format.ts` `stripMarkdownMarkers`): `**`·줄머리 `#` 제거(치아번호 `#16`은 보존, 검증 완료). 표시(공용 카드·환자 상세·환자 포털의 `optimizeContentHtml` 앞단)와 복사(`htmlToPlainText`) 양쪽에 적용 → DB 원문은 그대로 두고 보여줄 때만 걷음.
- dental/multilingual의 `[요약]`·`[번역]` 마커 파싱은 앵커 방식이라 본문 [라벨]과 충돌 없음(확인).
- DB 변경 없음.

## 2026-07-05 세션 65b (feat) — 업데이트 피드 (spec 023)

대표 요청: "업데이트 내용이 나한테만 보이는 곳에 쌓이고, 보고 취사선택해서 공지를 올릴지 결정하고 싶다."

- **피드 소스 = 레포 코드**(`lib/update-feed.ts` UPDATE_FEED): 다온이 세션 마무리마다 사용자-facing 변경을 엔트리로 append → 배포와 함께 쌓임(에이전트 DB 크레덴셜 없음 제약을 배포 파이프라인으로 우회). CLAUDE.md 마무리 체크리스트 1단계에 규칙 추가.
- **결정 상태 = DB**(`update_feed_decisions`): entry_id·status(published/dismissed)·announcement_id·decided_at. RLS enable+정책 0개(deny-all) → 서버액션(service_role+isSuperAdmin)만. 직원에겐 존재 자체 안 보임.
- **화면**(`/admin/updates`, 슈퍼어드민 전용): 최신순 목록+상태 배지(대기/공지 발행됨/보류). 대기 항목 체크 → 공지 문구 자동 조합(`composeAnnouncementDraft`) → 수정 가능한 초안 → 레벨·고정 선택 발행(announcements insert+published 기록, 티커 즉시 반영) / 보류 / 대기로 되돌리기. `/admin`에 진입 링크.
- **백필 4건**(기록 카드·확인 꼬리표·녹음 일시정지·공지 티커)은 이미 7/5 공지로 안내됨 → 보류 처리 권장.
- **마이그레이션**(`20260705000003_update_feed.sql`) ✅ 실행 완료(2026-07-05). (미실행이어도 피드 조회는 동작 — 결정 상태만 빈 값.)

## 2026-07-05 세션 65 (docs) — EO 공지 구조 대조 → spec 022 확정

EO 레포(`gungang83/eo`)가 세션 스코프에 추가되어 읽기 전용 대조 수행. **결론: Carelog spec 022 설계는 EO와 정합 — 스키마 수정 없이 확정.**

- EO도 전역 공지를 workspace 스코프 밖(workspace_id NULL, is_global=true, 슈퍼어드민 발행)으로 모델링 → "기관별 알림함과 분리된 전역 announcements" 판단 재확인.
- 차이점은 모두 의도된 단순화 또는 Carelog 고유 UX: EO의 category/status/타겟팅/version/announcement_reads(읽음 DB)는 후속 항목으로 spec에 참조 기록. EO 홈은 티커가 아닌 접이식 카드 리스트 — 마퀴 티커는 Carelog 고유 유지. EO→Carelog 게이트웨이 공지 푸시는 현재 없음(후속 유지).
- 상세: `specs/022-announcements/spec.md` "EO 대조 결과" 절.
- **다음**: ~~SQL 실행~~ ✅ 완료(2026-07-05) → 마무리(배포) 대기.

## 2026-07-05 세션 64 (feat) — 공지·업데이트 티커 (spec 022)

홈 헤더 바로 아래에 중앙 발행 공지가 **은은히 흐르는 한 줄 티커** + '전체보기'. 공지는 **중앙(Carelog/EO 슈퍼어드민)** 이 발행 → 모든 워크스페이스 공통.

- **전역 테이블**: 알림함(`notifications`)은 기관별(institution_id)이라 전 기관 공통 공지에 부적합 → 별도 전역 `announcements`(institution_id 없음). 발행/수정은 service_role(슈퍼어드민 서버액션)만, 직원은 활성+노출기간 내 read(RLS).
- **티커**(`announcement-ticker.tsx`): 전체폭·작은 회색 글씨·seamless 마퀴(globals.css `carelog-marquee`). hover/focus 시 정지, `prefers-reduced-motion` 정지. '새 공지' 점은 localStorage last-seen 비교(DB 읽음테이블 없이). 공지 없으면 렌더 안 함.
- **전체보기**(`/announcements`): 고정 우선·최신순, 상세·링크·발행자·레벨.
- **발행 UI**(`/admin/announcements`, 슈퍼어드민 전용): 제목·상세·링크·레벨(update/notice/info)·고정·노출종료 발행 + 목록(노출 토글·고정·삭제). `/admin`에 진입 링크.
- **마이그레이션**(`20260705000002_announcements.sql`): `announcements`(title·body·link·level·active·pinned·starts_at·ends_at·created_by). **배포 전 적용 필수.**
- 검증: `npm run build` TypeScript ✅(`/about` 프리렌더는 컨테이너 env 이슈, 코드 무관).
- 비범위(후속): 사용자별 읽음 DB화, 예약 발행 푸시, EO→Carelog 공지 동기화(게이트웨이).

## 2026-07-05 세션 63 (feat) — 녹음 일시정지 / 재개

7/5 김도은 선생 회의 요청 후속. 녹음 중 **일시정지**하고 이어서 녹음할 수 있게 함(중간에 자리 비움·대기 시간 녹음 낭비 방지).

- **provider**(`chair-provider.tsx`): `ChairStatus`에 `"paused"` 추가. `pauseRecording`/`resumeRecording` API. `MediaRecorder.pause()/resume()`로 스트림·누적 chunks 유지한 채 데이터 수집만 멈춤. **청크(긴 상담) 모드**는 구간 회전 타이머(segmentTimer)를 함께 정지→재개 시 복원(일시정지 중 구간이 잘리지 않게). pause 미지원/실패 시 상태 전환 안 함(계속 녹음).
- **UI**: 상담보드(`consultation-board.tsx`)·체어 오버레이(`chair-overlay.tsx`) 녹음 바에 '일시정지'(amber)/'이어서 녹음'(sky) 토글. 일시정지 시 빨간 펄스→amber 정지 점, 타이머 **freeze**(0으로 리셋 안 함). 이탈 경고·자동저장·실시간 브로드캐스트는 paused도 '진행 중'으로 취급. 저장은 종료 후에만.
- exhaustive switch 보정: `chair-buttons.tsx` statusLabel/buttonClass에 paused 케이스.
- **DB 변경 없음.** 검증: `npm run build` TypeScript ✅(`/about` 프리렌더는 컨테이너 env 이슈).
- 한계: iOS Safari는 pause/resume 신뢰도가 낮을 수 있음(백그라운드·잠금 시 OS가 스트림 정지). 실기기 검증 권장.

## 2026-07-05 세션 62 (feat) — 상담 카드 공용화 + 확인 꼬리표 (spec 021)

7/5 김도은 선생 회의 후속. 상담 생성 알림 → `/records`에서 상담 카드를 홈과 **완전 동일하게** 처리(전체복사·음성듣기·편집·삭제·환자연결). 담당이 정리 내용을 차트에 옮기기 전 확인할 항목(환자·참여자·장소·내용 등)을 다는 **'확인 필요' 꼬리표** 도입.

- **공용 카드**(`components/consultation/consultation-card.tsx`): 홈 `home-feed`의 연결/미연결 카드 로직을 추출한 단일 컴포넌트. `useChairContext()` 경유로 체어·멤버·오버레이 사용. `CardRecord` 정규화 타입. 홈·`/records` 양쪽이 이 카드로 렌더 → 액션·디자인 완전 일치. 연결 카드=편집은 환자 상세 링크, 미연결 카드=인라인 편집·환자연결·새 녹음.
- **home-feed 리팩터**: 중복 `renderLinkedCard`/`renderUnlinkedCard`(약 300줄) 제거하고 공용 카드 사용. 데이터 로딩·시간순 병합·토글만 유지.
- **records-browser 리팩터**: 아코디언 인라인 카드 → 공용 카드 목록(날짜 그룹 유지). `searchConsultations`에 `participants` 추가(미연결 편집 시 참여자 보존).
- **확인 꼬리표**(`consultation_review_flags`): 카드 하단 amber 칩 + `+ 확인 필요` 피커. 타입 확장형(`lib/review-flags.ts` REVIEW_FLAG_TYPES: 환자·참여자·장소·내용·기타). 완료(✓ resolve)·삭제(✕). 멤버십 RLS. 서버액션 `app/actions/review-flags.ts`(조회 일괄·추가·완료·삭제).
- **`/records` '확인 필요만' 필터**: 열린 꼬리표가 달린 기록만 클라 필터.
- **마이그레이션**(`20260705000001_review_flags.sql`): `consultation_review_flags`(institution_id·consultation_id[bigint]·type·note·status·created_by·resolved_by/at). **배포 전 적용 필수.**
- 검증: `npm run build` TypeScript ✅ (`/about` 프리렌더 실패는 컨테이너 env 미설정 기존 이슈, 코드 무관).
- 비범위(후속): 일시정지(pause) 녹음 기능은 기술검토만(별도 spec 예정), 꼬리표 서버 집계·알림.

## 2026-06-29 세션 61 (fix) — 멀티워크스페이스 RLS (기관 전환 복구)

**증상**: 여러 기관 소속 사용자(예: 대표=예미안치과의원 관리자 + 예미안치과 대표)가 전환한 워크스페이스를 못 봄. 홈 상담 목록 비고, 워크스페이스 전환 드롭다운·"기관 전환" 섹션까지 사라져 **한 기관에 갇힘**. 대표가 본원(예미안치과, 8명·기록 있음)에 아예 접근 불가.
**원인**: RLS `get_my_institution_id()`가 `limit 1`로 소속 기관 중 한 곳만 반환 → 앱 institution_id 필터(활성 기관)와 교집합 0. getMyInstitutions도 RLS로 1곳만 반환 → 전환 UI 숨김.
**해결**: 멤버십 기반 RLS. `my_institution_ids()`(SECURITY DEFINER, 재귀 방지)로 소속 **모든** 기관 접근 허용, 표시 워크스페이스는 앱 institution_id 필터가 결정. 역할(admin/owner) 검사는 '해당 행의 기관' 기준으로 유지. 격리 유지(소속 한정).
**대상 정책 11개**: patient·consultation·institutions·institution_members·institution_invitations·activity_logs·chairs·chair_audit_logs·clinic_members·audio_replay_logs·notifications. 앱 코드 변경 없음. migration `20260629000003_membership_rls.sql`. ✅ 적용·검증 완료(전환 드롭다운 복구).

## 2026-06-29 세션 59 (feat) — 서버 비동기 전사 (spec 020)

'상담 종료 및 저장'을 클라 전사(탭 의존)에서 **서버 위임**으로 전환. 종료 즉시 음성만 올리고 끝 → 서버 워커가 전사·요약 → 완료 알림. **탭 닫기·폰 잠금에도 완료**(18분 크래시 근본원인=탭 의존 제거).

- **마이그레이션**(`20260629000002_transcription_jobs.sql`): `transcription_jobs`(consultation_id·engine·prefix_html·status·attempts, RLS 정책0).
- **enqueue**(`app/actions/transcription-jobs.ts`): 플레이스홀더 상담 '🎙️ 전사 중' 즉시 생성 + 음성 업로드(기존 경로 재사용) + job 등록. 클라 '상담 종료 및 저장'이 호출(청크는 이어붙임).
- **워커**(`app/api/cron/process-transcriptions`, 매 분): pending 원자 클레임 → 음성 다운로드 → `runServerTranscription`(세션 없이) → 본문 갱신 → done → 크레딧·토큰 기록 → 완료 알림. 3회 재시도 후 실패 표시(음성 보관·재시도).
- **'상담 종료'(검토 경로) 불변**. prefix(직접 입력 본문) 전사 앞 보존. 등록 실패 시 임시본 보존+로그.
- 검증: `npm run build` TypeScript ✅. **배포 전 마이그레이션 적용 필수 + 실기기·실키 검증 필요.** Vercel cron `* * * * *`(플랜상 분단위 불가 시 `*/2`).
- 비범위(후속): 완료 시 리스트 realtime 자동갱신, 서버 청크 실패격리, 스트리밍.

## 2026-06-29 세션 58 (feat) — 운영자별 일일 리포트 (spec 019)

기관 관리자에게 자기 워크스페이스 일일 리포트 발송(생성기 scope 재사용). cron이 당일 활동 기관별 리포트 발행 + 관리자 알림함(recipients:'admins', push:false — 전 직원 스팸 방지). `/reports/daily/[date]`(owner/admin 전용) + 설정 페이지 진입 링크. `sendNotification` push 억제 옵션 추가.

## 2026-06-29 세션 57 (feat) — 일일 서버(인프라) 리포트 (spec 018)

이그레스 정지가 경고 없이 온 걸 계기로, 일일 리포트에 **인프라 상태 섹션** 추가. 슈퍼어드민이 매일 아침 스토리지·DB·신규 생성량·증가 추이를 자동으로 봄.

- **마이그레이션**(`20260629000001_infra_usage.sql`): `get_infra_usage()` SECURITY DEFINER — storage.objects 버킷별 용량·객체수 + pg_database_size. service_role만.
- **리포트**: `buildDailyReport`(scope='all')에 infra 블록 — 총 스토리지(전일 대비)·DB 크기·버킷별·당일 신규 상담/이미지/음성. `DailyReportView`에 "서버(인프라) 상태" 카드.
- **조기경보**: 스토리지 전일比 +500MB↑면 "주의 신호" 경고(이그레스 위험 proxy).
- **한계 명시**: 정확한 이그레스는 플랫폼 지표라 DB에 없음 → "Supabase Usage 확인" 안내. 후속: `SUPABASE_ACCESS_TOKEN`(Management API) 붙이면 실이그레스·플랜한도까지.
- 검증: `npm run build` TypeScript ✅. **배포 전 마이그레이션 적용 필수.**

## 2026-06-29 세션 56 (fix/perf) — 이그레스 절감 (spec 017)

Supabase 무료 이그레스 5GB 초과로 프로젝트 정지됨(조직 suwant FREE). **Pro 업그레이드로 복구** 후 재발 방지. **DB 변경 없음.** 주범 = 상담 이미지(무압축 원본 저장 + 볼 때마다 풀사이즈 전송).

- **업로드 압축**: `uploadImage`(붙여넣기·드롭·주석 단일 경로) 전 `compressImageFile`로 다운스케일(최대 1600px)+webp(q0.82) → ~10배↓. 이득 없으면 원본, gif 제외, EXIF 방향 반영.
- **표시 변환+lazy**: `optimizeContentHtml`/`optimizeStorageUrl`로 본문·갤러리 `<img>`가 작은 변환본(render/image) 받도록 + `loading="lazy"`. 홈피드·기록·상담이력·환자포털·상담뷰 전부. **기존 이미지에도 효과.**
- **안전장치**: `NEXT_PUBLIC_IMG_TRANSFORM=off`면 변환 끄고 원본 폴백(이미지 변환 사용량 우려 시 재배포 없이). 압축·lazy는 유지.
- 음성은 온디맨드(재청취 클릭)라 수동적 유출 없음 — 이번 범위 밖.
- 검증: `npm run build` TypeScript ✅. 배포 후 Supabase Reports에서 이그레스·이미지 변환 추이 모니터.

## 2026-06-29 세션 55 (feat) — 점진 청크 전사 + 상담 종료/자동저장 (spec 016)

"상담 종료 후 전사를 바라보며 기다리는 소모"를 줄임. **DB 변경 없음(클라/서버액션만).**

- **점진 청크 전사**: 청크 모드에서 구간이 잘릴 때마다(녹음 중) 즉시 백그라운드 전사 → 누적. 종료 시 남은 작업만 대기 + 요약 → 종료 대기가 "전체 전사"→"마지막 구간+요약"으로 단축. 18분 OOM 위험도 동반 감소. (기존 spec 010은 종료 후 일괄)
  - chair-provider: 청크 onstop이 `onSegmentReady(seg,index)` 통지 + `registerSegmentHandler`. 보드가 녹음 시작 시 핸들러 등록해 구간별 전사 누적(`liveTextsRef`/`liveTasksRef`), `finalizeChunked`가 마무리. 기존 일괄 `transcribeSegments`는 복구 경로 전용으로 유지(`finishChunkTexts` 공용화).
- **상담 종료 / 종료 및 저장 버튼**: "중지 및 변환"→**"상담 종료"** 개명 + **"상담 종료 및 저장"**(체어 선택 시 활성). 종료→전사 완료→`doAutoSave`(자동 saveChairRecord+음성 업로드+정리+닫기). 보드는 레이아웃 상시 마운트라 닫고 다음 환자로 이동해도 백그라운드 완료. 비교 모드+자동저장이면 첫 결과로 자동 확정.
- **실패 안전망**: 전사/저장/내용없음/체어없음 시 IndexedDB 임시본 보존 + 사용자 안내 + 서버 로그(`reportAutoSaveFailure`, Vercel 로그, PII 미포함). 비차단.
- **에디터**: `RichTextEditorHandle.getHTML()` 추가(자동저장이 현재 내용을 React 상태 대기 없이 동기 캡처).
- 검증: `npm run build` TypeScript ✅. 배포만(마이그레이션 없음).
- 비범위(후속): 서버 비동기 전사(탭 생명주기 완전 분리), 실시간 스트리밍, 자동저장본 미검토 표식.

## 2026-06-29 세션 54 (feat) — 사용량 필터 고도화 (spec 015)

사용량/크레딧 대시보드·리포트의 조회 필터 확장. **마이그레이션 불필요(쿼리 파라미터 + 읽기 엔드포인트만).**

- **기간 직접 지정**: 프리셋(7/30/90/365)에 '직접 지정…' 추가 → 시작/종료 날짜(특정 일·기간). summary API가 `from`/`to`(KST) 수용(`lib/usage/range.ts`로 KST 경계 일원화), 미지정 시 `days`.
- **사용자별 조회**: `user`(이메일) 필터 추가 — credit=`created_by`, menu=`user_email`. 기관·사용자 모두 **검색형 드롭다운**(`SearchSelect`)으로 전환(목록 커져도 입력 필터링).
- **필터 옵션 API** `/api/usage/filters`: 전체 기관 + 사용량 기준 사용자(이메일·소속기관) 목록(1회 로드).
- **리포트 날짜 선택**: `/admin/usage/report/[date]`에 날짜 input 추가(`ReportDateNav`) — 전일/익일 + 임의 일자 검색.
- 검증: `npm run build` TypeScript ✅. DB 변경 없음 → 배포만.

## 2026-06-29 세션 53 (feat) — 일일 사용 리포트 (spec 014)

하루(KST 0~24시) 메뉴·토큰·크레딧 사용을 집계해 **매일 아침 08:00(KST) 슈퍼어드민에게 알림+웹푸시**. spec 013 데이터 위에 집계기+발행 cron+열람 페이지. **마이그레이션 동반, 전사 회귀 0.**

- **스키마**(`20260628000003`): `usage_reports`(일별 jsonb 스냅샷, 멱등) + `credit_log`에 `tokens_in/out` 추가 + `deduct_credit` 8-arg(토큰) 재생성. RLS enable+정책0.
- **실토큰 캡처**: 전사 액션의 Claude 응답 `usage`(입력/출력)를 EngineRun→recordUsage→credit_log에 적재. Whisper는 토큰 개념 없어 전사 건수로(quick·chunk_segment=0). 비차단.
- **집계기** `lib/usage/daily-report.ts`: `buildDailyReport({date,scope})` — KST 0~24시(menu_usage_daily.day + credit_log 경계). 전일 대비·워크스페이스별·기능별(토큰)·메뉴별(역할)·사용자별 상위·경고(잔액음수/임박·급증). scope 일반화(all|기관).
- **발행 cron** `/api/cron/daily-usage-report`(매일 08:00 KST=`0 23 * * *`): 빌드→저장→슈퍼어드민 알림함(recipients=email)+`sendPushToUser`(본인 기기). CRON_SECRET/슈퍼어드민 세션 인증, `?date=` 재발행.
- **열람** `/admin/usage/report/[date]`(발행본 우선·없으면 즉석) + `/admin/usage`에 '📊 오늘 리포트' 링크. 전일/익일 내비.
- **범용성**: 생성기 scope로 운영자(기관별) 리포트 후속 재사용 대비(배선만 추가).
- 검증: `npm run build` TypeScript ✅. 배포 전 **마이그레이션 적용 필수**. 수동 발행 `?date=`로 즉시 테스트 가능.
- 비범위(후속): 이메일/SMS 채널, 운영자 자동 발송, 사용자 시간대 설정.

## 2026-06-28 세션 52 (feat) — 사용량·크레딧 대시보드 (spec 013, EO 벤치마크 포팅)

EO `/superadmin/menu-usage`(spec-075)·크레딧(spec-011)을 Carelog 슈퍼어드민으로 포팅 + 통합. **누가·얼마나·어떤 기능에서** AI 크레딧을 쓰는지 상세+통계, 그리고 화면(메뉴) 사용량. **마이그레이션 동반, 전사·네비 회귀 0.**

- **스키마**(`20260628000002_usage_credits.sql`): `menu_usage_daily`(일별 진입 집계) + `institution_credits`(잔액) + `credit_log`(차감/충전 원장) + RPC 3개(`increment_menu_usage`·`deduct_credit`·`grant_credit`). RLS enable+정책0(service_role만), 기관격리=쿼리필터.
- **크레딧 모델(사용자 결정)**: 원장+로그, **잔액 부족해도 전사 차단 안 함**(임상 안정성). `deduct_credit`·`recordUsage` 비차단·비throw. 단가는 `lib/credits.ts` CREDIT_PRICES(기능별 고정).
- **메뉴 추적**: `components/usage/route-tracker.tsx`(sendBeacon) → `/api/menu-usage/track`(세션 신뢰원·화이트리스트·KST). 정의 `lib/usage/menu-config.ts`.
- **배선**: `app/actions/transcribe.ts` 각 전사 성공 직후 `recordUsage(feature)`(엔진/청크별 단가).
- **API 4개**: `/api/menu-usage/{track,summary}`, `/api/credits/{summary,grant}` — 집계/충전은 `isSuperAdmin` 게이트.
- **UI**: `/admin/usage`(슈퍼어드민) 2탭 대시보드 — 크레딧(기능별·사용자별·기관별·잔액·최근내역+충전) / 메뉴(역할분해·기관별·미사용). `/admin`에 진입 링크.
- 검증: `npm run build` TypeScript ✅(/about prerender 에러는 컨테이너 env 누락, 코드 무관). 배포 전 **마이그레이션 적용 필수**.
- 비범위(후속): 실결제 빌링, 잔액 기반 차단, 토큰 실측 단가, 네비 외 세밀 이벤트.

## 2026-06-28 세션 51b (fix) — 슈퍼어드민 기관명·이름 깨짐(mojibake)

SSO 토큰의 한글 클레임이 `atob`(Latin-1) 디코드로 깨지던 버그 수정 + 과거 데이터 복구.

- **근본 원인**: `app/api/auth/sso/route.ts` `verifyJwt`가 `JSON.parse(atob(payload))` — atob가 UTF-8 바이트를 Latin-1 문자로 줘 한글(institution_name·name) mojibake. `Uint8Array.from(atob(...)) + TextDecoder`로 UTF-8 디코드 수정.
- **데이터 복구**: `convert_from(convert_to(x,'LATIN1'),'UTF8')` (가드: 비ASCII 있고 한글 없는 행만). institutions.name·institution_members.display_name·consultation.author_name 복구. content는 오탐 확인 후 제외.

## 2026-06-28 세션 51 (feat) — 알림함 (spec 012, EO 벤치마크 포팅)

EO '알림' 기능을 같은 UX로 Carelog에 포팅. 그동안 fire-and-forget이던 푸시를 영속 알림으로 적재 + 읽음관리 + 실시간. **마이그레이션·RLS 동반, 기존 헤더·실시간 토스트 회귀 0.**

- **스키마**: `notifications`(broadcast) + `notification_reads`(user_id×id, 행=읽음) + RLS(기관 멤버 read / 본인 읽음) + realtime publication. schema.sql·database.md 동반.
- **lib/notifications.ts**: `sendNotification`(적재 + 기존 sendPushToInstitution 통합) / `getNotifications`(기관 격리·대상 필터 all·admins·이메일·본인 읽음) / markRead·markUnread·markAllRead / getNotificationContext.
- **API 4개**: `/api/notifications`(GET), `/[id]/read`(POST·PATCH), `/read-all`(POST) — getSessionUser 인증, lib 위임.
- **NotificationBell**(헤더): 종+미읽음 배지(9+)+드롭다운(타입아이콘·제목·본문·상대시간·미읽음 강조·읽음✓토글·전체읽음)+클릭 읽음+이동, Realtime(`subscribeNotifications`)+30초 폴백+PWA setAppBadge. Carelog 팔레트.
- **배선**: chairs.saveChairRecord·consultations.saveConsultation → sendNotification(직원 대상 적재). 환자 푸시는 분리.
- 검증: `npm run build` TypeScript ✅. 배포 전 **마이그레이션 적용 필수**(notifications 테이블·publication).
- 비범위(후속): 환자 포털 알림함, 이메일/SMS 채널·설정 페이지, 과거 푸시 백필.

## 구현 완료 기능

| 기능 | 상태 | 비고 |
|---|---|---|
| 환자 등록 | ✅ 완료 | 이름, 차트번호, 전화번호, 주민번호 |
| 환자 수정 | ✅ 완료 | 수정 모달, 주민번호 포함 |
| 통합 검색 | ✅ 완료 | 이름 / 전화번호 / 차트번호 / 주민번호 앞자리 |
| 상담 기록 작성 | ✅ 완료 | 리치 텍스트(HTML), 인라인 이미지(주석 포함), 처방 메모 |
| 상담 이력 조회 | ✅ 완료 | 환자 상세 페이지, HTML 렌더링 |
| 리치 텍스트 에디터 | ✅ 완료 | Tiptap — 볼드·이탤릭·제목·목록·인용·구분선·실행취소 |
| 인라인 이미지 편집 | ✅ 완료 | 텍스트 흐름 안에 이미지 삽입, 모서리 드래그로 크기 조절 |
| 이미지 주석 도구 | ✅ 완료 | 펜·직선·화살표·사각형·텍스트·지우개, 색상 7종, Ctrl+Z |
| 이미지 삽입 방법 | ✅ 완료 | 툴바 버튼 / 드래그 앤 드롭 / Ctrl+V 클립보드 붙여넣기 |
| 체어 번호 관리 | ✅ 완료 | 로컬스토리지 기반, 상담 기록에 자동 저장 |
| 주민번호 마스킹 | ✅ 완료 | 목록/상세 화면 880101-1****** 형식 |
| 주민번호 해시 | ✅ 완료 | SHA-256, unique index로 중복 방지 |
| Vercel 배포 | ✅ 완료 | GitHub main 연동 자동 배포 |
| Supabase Auth 연동 | ✅ 완료 | 이메일+비밀번호, 세션 쿠키, proxy 미들웨어 |
| 이메일 인증 콜백 | ✅ 완료 | /auth/callback PKCE 코드 교환, 자동 로그인 |
| 기관 등록 (signUp) | ✅ 완료 | 기관명 + 이메일 + 비밀번호로 신규 기관 생성 |
| 다기관 격리 구조 | ✅ 완료 | institution_id 필터 + RLS (get_my_institution_id) |
| 로그인/로그아웃 | ✅ 완료 | `/login`, `/signup` 페이지 |
| 기존 데이터 기관 귀속 | ✅ 완료 | 시드 기관 → 예미안치과 마이그레이션 완료 |
| 직원 초대 (Server Action) | ✅ 완료 | inviteStaff, acceptInvitation 백엔드 구현 |
| 디자인 시스템 문서 | ✅ 완료 | docs/design.md |
| 환자 포털 — SMS 초대 발송 | ✅ 완료 | 직원이 환자 상세에서 "상담 공유" 버튼으로 Solapi SMS 발송 |
| 환자 포털 — OTP 가입 | ✅ 완료 | 주민번호+전화번호 → OTP 인증 → patient_accounts 생성 |
| 환자 포털 — 상담 내역 조회 | ✅ 완료 | /portal/records — 모든 연결 기관 상담 통합 조회 |
| 환자 포털 — 로그아웃 | ✅ 완료 | patient_session_token 쿠키 삭제 + DB 세션 삭제 |
| Google OAuth 로그인 | ✅ 완료 (외부 설정 필요) | Google 로그인 버튼 + 신규 사용자 기관 등록 온보딩 흐름 |
| 헤더 기관 전환 드롭다운 | ✅ 완료 | 복수 기관 소속 직원용 드롭다운, 단일 기관은 텍스트만 표시 |
| 직원 권한 관리 (설정 페이지) | ✅ 완료 | `/settings` — 직원 목록 조회, is_active 토글, 직원 초대, 기관명 수정 |
| 최고 관리자 패널 | ✅ 완료 | `/admin` — 전체 기관 통합 조회, 기관별 직원 권한 관리 |
| PWA 홈 화면 추가 | ✅ 완료 | manifest.ts, 아이콘(192/512), sw.js, Apple 메타태그 |
| Web Push 알림 | ✅ 완료 | VAPID, push_subscriptions 테이블, 상담 저장 시 자동 발송 |
| 항시 로그인 | ✅ 완료 | proxy.ts updateSession() + SessionRefresher 클라이언트 리스너 |
| 헤더 고정 + 새로고침 | ✅ 완료 | sticky 헤더 + RefreshButton (router.refresh()) |
| 푸터 브랜딩 | ✅ 완료 | SUWANT holdings Inc. 푸터 전 페이지 표시 |
| 환자 Google OAuth 가입 | ✅ 완료 | SMS OTP 인증 후 /portal/signup-cta → Google OAuth → patient_auth_links 연결 |
| 환자 Google 재로그인 | ✅ 완료 | /portal/login Google 버튼 → /auth/patient-callback → /portal/records |
| 환자 포털 이중 인증 지원 | ✅ 완료 | OTP 쿠키 세션 OR Supabase Google 세션 모두 허용 (getPatientSession 업데이트) |
| 이중 역할 전환 | ✅ 완료 | 직원 헤더 "내 진료 기록" → /portal/records, 환자 화면 "직원 화면" → / |
| 환자 푸시 알림 | ✅ 완료 | patient_push_subscriptions + sendPushToPatient, 상담 저장 시 fire-and-forget |
| 환자 계정 연결 오류 안내 | ✅ 완료 | /portal/link-account — OTP 없이 Google 로그인 시도 시 안내 |
| 체어 즉시 기록 (Chair Quick Record) | ✅ 완료 | 체어 선택 → 즉시 녹음 → AI 변환 → 임시 저장 → 환자 연결 |
| 상담보드 (Consultation Board, record-first) | ✅ 구현(spec 008) | 홈 "상담 기록 시작" 1탭 → **체어·참여자 선택 없이 즉시 녹음** → 보드에서 본문·그림·체어·참여자·처방 병행 채움 → 저장. 참여자 검색·'나' 자동·최근·역할 후순위. 마지막 체어 기기별 기억(보드 기본 선택). DB 변경 0 |
| 미연결 기록 관리 (홈 인라인) | ✅ 완료 | 전체 체어 통합 조회 · 인라인 RichTextEditor 편집 · 처방 선택 · 환자 연결 |
| 체어 기록 재연결/해제 | ✅ 완료 | 환자 상담 기록에서 다른 환자로 재연결 또는 미연결 상태로 되돌리기 |
| 참여자(원장·직원·담당자) 선택 | ✅ 완료 | 녹음 시작 시 참여자 선택 + 마스킹, `clinic_members` 디렉터리 + `consultation.participants` 스냅샷. 마이그레이션 적용 완료 |
| 이미지 줌/팬 | ✅ 완료 | 보기 라이트박스(`ZoomableImage`) + 주석 화면(CSS transform 줌·팬). 휠/버튼/핀치/드래그/더블클릭, 외부 라이브러리 없음 |
| EO 마스터 게이트웨이 캐시 | ✅ **라이브** (2026-06-10) | EO 직원 마스터를 `clinic_members`에 캐시(`source='eo'`). `lib/eo/gateway.ts`+`sync-master.ts`, Vercel Cron `/api/cron/sync-master`(10분). 수동분 보호. 예미안(0e4e85d6) 직원 30명 동기화 확인 |
| EO SSO 작성자 귀속 | ✅ **라이브** (2026-06-10) | `/api/auth/sso` 확장 클레임 수용 → `institution_members.eo_employee_id`·`display_name` 저장. 상담 저장 시 `author_employee_id`·`author_name` 자동 기록 |

---

## 2026-06-28 세션 50 (fix/feat) — /records 빈 화면 수정 + 홈 연결완료 카드 통일

- **[버그] /records 빈 화면** — `searchConsultations`의 `patient:patient_id(...)` 임베드 조인이 관계 해석 실패 → 쿼리 에러 → 조용히 빈 결과. **수동 조인**(patient 일괄 조회)으로 교체. 이제 전체보기 표시.
- **홈 카드 통일(피드백)** — '활동(로그 행)'을 **연결완료 상담 카드**로 교체. 미연결과 동일 chrome(배지·체어·미리보기·**눌러서 전체보기**·처방) + 동일 액션(**전체복사·음성듣기·삭제** + 편집은 환자상세). "미연결→연결로 바뀌기만" 한 통일 디자인. 홈은 `searchConsultations({status:linked})`로 로드.
- 신규 `deleteConsultation`(연결 포함 삭제, 감사 로그) — deleteChairRecord는 미연결만이라.
- 활동 로그 행/마스킹 헬퍼 제거(연결완료 카드가 대체, PII는 이름·차트만).
- 검증: `npm run build` TypeScript ✅.

---

## 2026-06-28 세션 49 (feat) — 상담 기록 열람·검색·필터 + 환자별 간략 보기 (spec 011)

예미안 260628 피드백 A5+A6 구현(상담이 쌓여 찾기·보기 힘듦 해소). speckit(spec+tasks). **스키마/마이그레이션/버킷/라이브러리 0, 환자상세 회귀 0.**

- **데이터**: `consultations.ts` `searchConsultations(filters)` 신규 — 연결·미연결 통합, 키워드(content ilike)·상태·체어·환자·기간·정렬·limit/offset, patient 조인(이름·차트), PII 평문 미노출.
- **전체보기(A5·A3)**: `app/(dashboard)/records/page.tsx` + `components/records/records-browser.tsx` — 검색창·상태칩·체어·정렬, 날짜그룹, **접이식 카드**(펼치면 전체복사 + 연결완료는 환자상세 편집 링크), 더보기.
- **환자별 간략 보기(A6)**: `consultation-history.tsx` — 카드 기본 접힘+클릭 펼침 + 환자 내 키워드 검색. 서브컨트롤(편집·전송·연결변경·삭제) 보존.
- **홈(A5)**: `home-feed.tsx` '기록·활동'에 '전체보기·검색' → `/records` 링크.
- 검증: `npm run build` TypeScript ✅. 수동(예미안): 검색·필터·환자별 접기·회귀 점검(배포 후).

---

## 2026-06-28 세션 48 (feat/fix) — 예미안 파일럿 피드백 1차 반영 (김도은 260628)

오늘 김도은 회의(예미안 실사용 1주) 피드백 정리·착수. 정리 카드: `specs/000-backlog/pilot-yemian-260628.md`.

- **[A1 버그] 환자 동시/중복 등록** — `createPatient`가 주민번호 해시로 기존 환자 선조회→재사용(멱등) + 유니크 충돌 친화 메시지. 원인: `patient_resident_no_hash_uidx` 충돌(둘이 같은 환자 동시 등록). 해시는 강한 식별자라 오연결 위험 없음.
- **[A2] 요약 맨 앞 환자 이름** — 녹취 첫머리 이름 언급 시 요약에 "환자: <이름>"(미연결 카드 식별성↑). basic/chunk/detailed/dental 프롬프트 반영.
- **[신규] 녹음 시작 안내문** — 녹음 중 배너로 "이름 먼저·치아 부위 또렷이" 안내(상담 규칙 앱 내장).
- 검증: `npm run build` TypeScript·compile ✅.
- **다음**: A5+A6(상담 기록 전체 열람·검색·필터 + 환자별 간략 보기) spec 011 착수 권장. A3는 환자상세엔 이미 완료, 홈 활동행 옵션만 잔여.

---

## 2026-06-28 세션 47 (feat) — 긴 상담 청크 분할 전사 모드 (spec 010, speckit 전과정)

긴 상담의 batch 천장(타임아웃·전손)을 구조적으로 푸는 **"긴 상담(청크)" 모드** 추가. C안(수동 모드 먼저 검증 → 나중에 자동 전환 승격). speckit 전과정(specify→plan→tasks→implement) 수행. **lab 전용·새 인프라 0·마이그레이션 0·비-lab 회귀 0.**

| 영역 | 구현 |
|---|---|
| 스펙 | `specs/010-chunked-transcription/`(spec·plan·research·data-model·contracts·quickstart·tasks). 음성보관 A안(단일 경로 concat) |
| 분할 녹음 | `chair-provider.tsx` — chunk 모드 시 5분(`CHUNK_SEGMENT_MS`)마다 MediaRecorder stop→restart로 유효 webm 구간 배열. `stopRecordingChunked(): Promise<Blob[]>` |
| 구간 전사 | `transcribe.ts` 신규 서버액션 `transcribeSegment`(구간1개)·`summarizeChunkTranscript`(전체요약) — 둘 다 lab 게이트 |
| 오케스트레이션 | `consultation-board.tsx` — 구간 동시 전사(동시성 3·실패1회 재시도·격리)→순서 join→전체 요약 1회→삽입. 부분 실패 보존(전 구간 실패 시만 전체 실패), 실패 구간 본문 표시 |
| 진행률 | "음성 인식 중… (n/m 구간)" 표시(`chunkProgress`) |
| 복구 | `draft-store` `BoardDraft.audioSegments[]` + 종료 직후 영속화 → `applyRecover` 구간 재전사. 자동저장이 구간 배열 덮어쓰지 않도록 보강 |
| 보관 | 저장 시 구간 concat 단일 blob을 기존 `uploadConsultationAudio`로(스키마 불변), `transcription_engine="chunk"` |
| 픽커 | `engines.ts` `EngineId`에 chunk + `LAB_ENGINE_OPTIONS` "긴 상담". 셀렉터 줄바꿈 pill로 7모드 수용 |
| 검증 | `npm run build` TypeScript·compile ✅. quickstart 6시나리오는 예미안 수동 검증 대기(T022/T023) |
| 보류 | chunk 음성 재청취 완전 패리티(v1 한계), 자동 전환(짧으면 batch/길면 chunk) 승격은 검증 후 |

---

## 2026-06-27 세션 46 (feat) — 전사 모드 3종 추가 (실험실 엔진 픽커 확장)

구조(batch→스트리밍/청크)를 바꾸는 대신, **모드를 늘려 사용자가 골라 쓰는** 방향(대표 지시). 기존 엔진 레지스트리(`lib/transcribe/engines.ts` + `runX` + 자동 렌더 셀렉터)에 모드 3종 추가. **모두 lab 워크스페이스(예미안)에만 노출**, 비-lab은 `basic` 강제(기존 게이트 그대로). 지금 인프라(Whisper+Claude) 그대로 — 새 외부 서비스·인프라 0.

| 모드 | 동작 | 함수 |
|---|---|---|
| **빠른 메모**(quick) | Claude 요약 생략, 전사만 → 가장 빠름·저렴(직접 정리용) | `runQuick` |
| **상세 요약**(detailed) | 증상·소견·처치·처방·다음방문 섹션 구조화 요약 | `runDetailed` |
| **용어 보정**(dental) | Whisper 오인식 치과용어·치아번호 교정 후 요약(정확도↑) | `runDental` |

- `EngineId`에 quick/detailed/dental 추가, `LAB_ENGINE_OPTIONS` 6종(기본/빠른메모/상세요약/용어보정/다국어/비교). 한국어 전사 공용 헬퍼 `transcribeKo`로 중복 제거.
- `engine-selector.tsx`: 모드 6개라 가로 1줄 초과 → **줄바꿈 pill**로 변경(모바일 안전).
- 보류: **긴 상담(청크 분할)** — 웹오디오 분할 부담 + 세션 45 fix로 30분급 이미 커버 → 후속(동시통역 스트리밍과 합류).
- 검증: `npm run build` TypeScript·compile ✅.

---

## 2026-06-27 세션 45 (fix) — 긴 상담 녹음 전사 유실 버그 (서범기 18분 케이스)

서범기(오늘의 치과)가 **모바일에서 18분 녹음 → 종료 → "10초쯤 요약하다 This page couldn't load" → 리로드 시 자료 소실**. 코드 대조로 원인 확정·완화 배선.

| 영역 | 내용 |
|---|---|
| 근본 원인 | 전사 서버액션이 **batch(통짜 blob)** + Vercel **기본 타임아웃(~10s)에서 함수 강제 종료**. `maxDuration`이 `layout.tsx`에만 있었는데, **Next 16 문서상 Server Action 타임아웃은 page 레벨에 둬야 적용**(`route-segment-config/maxDuration.md` "set at the page level"). 즉 layout의 120은 액션에 무효였음 → spec 006 §5 결정이 실효되지 않은 상태 |
| 가중 원인 | `bodySizeLimit:10mb` + MediaRecorder 비트레이트 미지정(기본 ~128kbps) → 18분이 10MB 근접/초과 → 업로드 거부·모바일 메모리 압박(별개 실패 경로) |
| 수정 ① 타임아웃 | `app/(dashboard)/page.tsx`에 `export const maxDuration = 300` 추가(액션 실효) + `layout.tsx` 120→300 |
| 수정 ② 용량 | MediaRecorder `audioBitsPerSecond: 32000`(~0.25MB/분, spec 009 결정 구현) — `chair-provider.tsx`·`voice-recorder.tsx`. 18분≈4.5MB. `next.config.ts` `bodySizeLimit` 10mb→25mb(Whisper 자체 상한에 정렬) |
| 수정 ③ 유실 안전망 | `consultation-board.tsx`: 종료 직후 전사 **시작 전** IndexedDB 즉시 1회 저장(1초 디바운스 대기 X). 복구 시 본문이 비고 음성만 남았으면 `applyRecover`가 **음성 재전사**(`transcribeBlob` 공용화) → 크래시해도 음성+본문 복구 가능 |
| 구조적 후속 | 긴 상담의 진짜 해법은 **스트리밍/청크 전사**(o1 동시통역 Level 2와 합류) — 현재 코드엔 실시간 통역 없음(다국어=사후 batch뿐). 별도 작업으로 분리 |
| 검증 | `npm run build` TypeScript·compile ✅ (정적 prerender는 컨테이너에 Supabase env 없어 /admin에서만 실패 — 코드 무관) |

---

## 2026-06-24 세션 42 — C-07 참여자 검색 + 오늘의 치과 2차 미팅 기획

| 항목 | 내용 |
|---|---|
| **C-07 배포** | 참여자 선택 매끄러움(↑ 완료 기능 표 참조). 마스킹 충돌 진단 → 피커 실명 노출 + 초성 검색(`lib/hangul.ts`) + 구획 라벨 |
| **오늘의 치과 2차 미팅 기획** | 서범기 전사록(`서범기_260624`) → `specs/000-backlog/pilot-ohneul-260624.md`. **O-1 다국어 실시간 통역**(대표 "방향성 결정", spec 1순위), O-2 동시편집(C-05 수요 재확인), O-3 캡처 차별점 재정의(통합 전달), O-4 습관화 전략, **O-5 공용계정 워크스페이스 동선(이번 주 액션)**, O-6 체어 하드웨어. EO 영역(업무관리·채용)은 경계 보존만 |
| **녹음 엔진 실험실 v1** | O-1 검증 인프라 구현·배포. `institutions.lab_enabled`(예미안만 true) + `consultation.transcription_engine`. 상담별 엔진 picker(실험실 워크스페이스만): **기본모델**/**다국어**(자동감지+번역, 원문/번역/요약)/**비교**(둘 동시→한쪽 선택). 비-lab은 서버에서 `basic` 강제. multilingual 실패 시 basic 자동 폴백. 공유 상수는 `lib/transcribe/engines.ts`로 분리("use server"는 async만 export) |
| **엔진 picker 위치 개선** | 헤더 상단바에 작게 끼어 있던 셀렉터(녹음 시작하면 사라져 "중지해야 보인다"는 체감) → 본문 **idle 전용 또렷한 블록**으로 이동. 라벨·설명·버튼형 선택, 녹음 시작 전에 노출되고 시작 시 자동 숨김(엔진 고정). 헤더엔 실험실 배지만 유지 |
| **엔진 picker를 홈 히어로로(핵심)** | 진입점 `ConsultHero`의 "상담 기록 시작"이 **클릭 즉시 녹음 시작**(제스처 보존) → 보드 idle을 못 봐 picker 선택 불가 문제. 엔진 상태를 `ChairProvider` context로 끌어올려(`engine`/`setEngine`/`labEnabled`) 히어로·보드 공유. **히어로 시작 버튼 위**에 엔진 선택 블록 노출(실험실만). 보드 idle 블록은 폴백으로 유지(같은 context 동기화) |
| **엔진 selector 디자인 정리** | 보라색 박스가 파란 히어로와 충돌·정렬 들쭉날쭉 → 공통 컴포넌트 `components/chair/engine-selector.tsx`로 추출. 라벨·컨트롤·설명을 같은 좌측 기준선에 맞춘 세그먼트 컨트롤(흰 배경 + 활성만 sky-600 채움, 사이 divider). 히어로·보드 동일 UI |
| **히어로 카피 — 상담 용어·환자 안심** | "오늘 진료, 기록으로 남겨서 환자에게 전달해요"(진료 기록 뉘앙스) → **"오늘 나눈 상담, 빠짐없이 남겨 환자분께 전해드려요"**. 본문도 상담 용어·안심 톤("정리된 상담 기록은 환자분도 직접 받아 보관"). 제목 크기 ↑(`sm:text-[2.15rem]`). 의료법 용어 규칙(상담 기록) 준수 |
| **미연결 기록 편집 — 체어·참여자** | 홈 피드 인라인 편집에서 본문·처방만 수정 가능 → **체어 변경 + 참여자 변경** 추가. `updateChairRecordContent`에 `chairId`/`participants` 파라미터(체어는 기관 소속 검증). `AllUnlinkedRecord.participants` 노출, 카드 헤더에 참여자 읽기전용 표시. 편집 UI에 체어 칩 + `ParticipantPicker` 재사용 |
| **요약 제목 브랜딩** | 기본 엔진 요약이 "## 치과 상담 기록 요약"으로 시작 → 프롬프트에 제목 줄 고정해 **"## 치과 상담 기록 요약 - Carelog"** 로 통일 |
| **상담 에디터 통일 (Phase 1)** | 입력·편집을 모든 진입점이 같은 기능으로 쓰도록 공용 `components/chair/consultation-editor.tsx` 추출(본문+체어+참여자+처방, 옵션 토글). 홈 피드 미연결 편집을 이걸로 교체(무동작 변경). 후속: 연결완료 카드·환자 페이지로 확대 → **보류 (핸드오프 622 우선)** |
| **/admin 기관 ID 표시·복사 + 기관 생성 (카드 622)** | EO SSO 연동은 Carelog `institution_id` 선발급 필요(멤버십 FK). 슈퍼어드민 콘솔에 ① 기관 ID 표시+복사 ② **기관 생성**(입력→생성/기존이면 그 id 반환→복사) 추가. SQL 없이 self-serve로 EO 연동 id 발급. `createInstitutionAsAdmin`(super 전용) + `institution-list.tsx`. 강남점(EO ws 776eacd1)용 — **완전자동의 폴백으로 유지** |
| **SSO 완전자동 — institutions UPSERT (카드 622)** | `app/api/auth/sso/route.ts`: 멤버십 insert 전에 `institutions` upsert(`onConflict:id, ignoreDuplicates`) + `institution_name` 클레임 수용. EO 자체발급 id로 **첫 SSO 시 기관 자동생성(FK위반 0)**, 있으면 기존 보존(이름·lab 안 덮음). 이 배포 선행 → 테오 #621(EO 자체발급) 활성. ②완전자동 핵심 선행 |
| 빌드 | C-07·실험실 TypeScript ✅ (`/admin` 프리렌더 실패는 컨테이너 env 미설정·무관) |
| 마이그레이션 | `supabase/migrations/20260624000001_engine_lab.sql` |
| **슈퍼어드민 진입점** | 프로필 드롭다운에 **슈퍼어드민**(최고 관리자 패널 `/admin`) 링크 추가 — `isSuperAdmin`(=SUPER_ADMIN_EMAIL) 계정만. 기존 패널이 메뉴에 없어 URL 직접입력만 되던 것 해소. layout→Header→ProfileDropdown prop |
| **워크스페이스 실험실 토글** | 슈퍼어드민 콘솔(`/admin` InstitutionList)에 기관별 `lab_enabled` 토글 + 실험실 배지. `setInstitutionLab`(super 전용). 이제 SQL 없이 워크스페이스별 실험실 on/off |
| 휴고 핸드오프 | 카드 481 — EO 메뉴 구성 참고자료 요청 → **✅ 수령·해결**(레포 혼선: 휴고 작성본이 EO 레포에 있었음). EO 4섹션이 Carelog 구조 검증 — 3-tier(staff/관리자/슈퍼어드민)·설정↔슈퍼어드민 경계(데이터범위) 이미 정렬. 적용: 슈퍼어드민 H1 라벨 일치 + 경계원칙 `docs/architecture.md` 명문화. 선택 후속(설정 탭화·라우트 리네임)은 대표 결정 대기 |

> **남은 후속(O-1)**: Level 2 실시간 통역(Soniox/OpenAI realtime PoC), 다국어 엔진 실측(예미안 외국인 신환), 화자분리·용어사전, 토큰 과금 편입. 검토: `specs/000-backlog/o1-multilingual-interpret-feasibility.md`

---

## 2026-06-24 세션 41 (feat) — 파일럿 W0 1차 회의 피드백 + 확정카드 편집

예미안 파일럿 1차 회의(김도은) 전사록·피드백을 코드와 대조해 백로그로 정리, 즉시건 1개 배포.

| 항목 | 내용 |
|---|---|
| 회의 피드백 정리 | `specs/000-backlog/pilot-w0-kickoff.md` — C-01~C-11. 각 건 코드 대조(현재상태·난이도·분류) |
| **C-03 배포** | 확정 상담 카드 **인라인 편집** 추가. STT 오인식 등 사후 정정용. status 가드 없는 `updateConsultationContent` 액션 + `ConfirmedEditControls` |
| **C-02 배포** | **환자 대면 보호막**(`PatientShield`). 홈의 `HomeFeed`·`PatientHome` 기본 가림(흐림+접힘) → "기록 펴기"/흐린영역 클릭 시 노출, 매 진입 재가림. `ConsultHero`는 노출 유지. 후속: overlay 제거+`scrollbar-gutter:stable`로 삐걱 해소, 안내 바 전체 클릭=가리기 |
| **C-12 큰 규칙** | **용어 규칙: "상담 기록"이지 "진료 기록"이 아니다**(의료법). `product-vision.md`+`CLAUDE.md`에 명문화, UI "진료 기록"→"상담 기록" 22곳 치환, `present-screen` "정식 진료기록" 표현 제거 |
| **C-01 1차+2차 배포** | 녹음 유실 가드. ①`beforeunload` 이탈 경고 + "버리기" 확인. ②**IndexedDB 임시영속화·복구**(`lib/chair/draft-store.ts`): 1초 디바운스 자동저장(본문·처방·참여자·체어·음성 blob), 재진입 시 복구 배너, `RichTextEditor.setHTML` 추가 |
| **C-05 1단계 배포** | 실시간 진행 현황. `lib/realtime/board-live.ts` broadcast + `LiveSessionsBanner`(홈). 다른 기기 작성 중이면 "△△님이 □ 체어에서 작성 중" 실시간 표시. **PII 미포함**(메타만). 본문 공유는 2단계 |
| **C-07 배포** | 참여자 선택 매끄러움. 진짜 원인=**마스킹 충돌**(`김도은`·`김도우`가 둘 다 `김도*`). 피커 **실명 노출**(입력=직원 내부 도구) + **초성/부분일치 검색**(`lib/hangul.ts`, "ㄱㄷㅇ"·"도우") + 구획 라벨(나·최근·전체). 저장 기록의 환자 마스킹은 유지. DB 변경 0 |
| 코드 대조 발견 | C-04(자동알림+리프레시)는 spec007로 **이미 구현** → 검증 항목. 전체복사도 확정카드에 **이미 존재** |
| spec 승격 후보 | C-01 녹음 유실 가드(009 연계), C-02 환자 대면 모드, C-05 실시간 협업(단계적), C-08 캡처 워크플로 |
| 드라이브 | 회의 자료는 `Carelog_Project_공유/01_파일럿` 폴더(런시트·전사록·피드백 메모) |
| 빌드 | `npm run build` ✅ |

---

## 2026-06-20 세션 40 (feat) — 도움말 페이지 + 워크스페이스 안내 배너

세션 39의 내부 규칙(SSOT)을 **사용자용 안내**로 노출(가볍게 1차).

| 항목 | 내용 |
|---|---|
| 도움말 페이지 | `/help`(`app/(dashboard)/help/page.tsx`) — 토픽 카드: EO 진입·계정/워크스페이스 연동·중복 워크스페이스 정리. 친절한 사용자 톤(내부 SSOT는 `docs/account-workspace-linking.md`) |
| 진입점 | 햄버거 메뉴에 "도움말"(/help) 항목 추가 |
| 상황 배너 | `WorkspaceHelpBanner` — **워크스페이스 2곳 이상** 소속 시 홈 상단에 안내(전환 방법 + 도움말 링크). 닫으면 localStorage 기억(잔소리 방지) |
| 비용 | 홈에서 `getMyInstitutions`(이미 layout서 호출 — cache로 추가비용 0) |
| 범위 밖 | 헤더 '?' 상시 뱃지는 이번 제외(요청). EO 도움말 배너/뱃지 패턴 직접 참고는 EO 레포 접근 필요(미접근) |
| 빌드 | `npm run build` ✅ |

---

## 2026-06-20 세션 39 (docs) — 계정·워크스페이스 연동 규칙

| 항목 | 내용 |
|---|---|
| 배경 | "Carelog로 먼저 가입한 사용자가 EO와 연결될 때" 동작·수동 운영을 SSOT로 못박음(대화 휘발 방지) |
| 신규 | `docs/account-workspace-linking.md` — 이메일=계정키, EO↔CL=기관단위 링크, 합류≠워크스페이스 이전, 수동 운영(빈 기관 정리·재링크·데이터 이관), 권장 운영(EO 직원은 SSO 진입), 엣지(Google 동일이메일 검증), 후속(공개가입 차단 등) |
| 연결 | `docs/eo-carelog-integration.md`에 링크 추가 |
| 알려진 한계 | 자동화 없음(현재 수동) · 공개 가입 열림 · 빈 중복 기관 정리 UI 없음 → 향후 spec 후보 |

---

## 2026-06-20 세션 38 (feat) — 미연결 카드 클릭하여 전체 내용 보기

| 항목 | 내용 |
|---|---|
| 동기 | 연결 카드는 클릭→상담 상세로 가는데, 미연결 카드는 '편집'을 눌러야만 내용 확인 가능 |
| 수정 | 미연결 카드 본문 영역을 클릭하면 **전체 내용(서식 포함, `.rich-content`)** 인라인 펼침/접힘. "눌러서 전체 보기 ▼"/"접기 ▲" 힌트 |
| 결정 | 클릭은 **보기(view)** 만 — 편집은 기존처럼 '편집' 버튼으로 명시(실수 편집 방지). 접근성: `role=button`+키보드(Enter/Space) |
| 빌드 | `npm run build` ✅ |

---

## 2026-06-20 세션 37 (feat) — 피드 10개 캡 + 연결카드 환자정보(마스킹)

| 항목 | 내용 |
|---|---|
| 10개 캡 | 통합 피드를 기본 **10개**만 노출, 나머지는 "전체 N개 보기"로 펼침(접기 가능). 기존 '활동 5개 캡'은 제거 |
| 환자정보 | 연결 완료 카드에 **차트번호·주민번호·전화** 칩 추가 — 환자 등록 누락을 현장에서 바로 확인 |
| 마스킹 | 민감정보는 **서버(getActivityLogs)에서 마스킹**(`880101-1******`, `010-****-1234`)해 평문 미전송. 미등록 항목은 **앰버**로 표시해 누락 강조 |
| 빌드 | `npm run build` ✅ |

---

## 2026-06-20 세션 36 (feat) — 통합 피드 카드 디자인 통일(상태 시각화)

미연결 카드와 연결 카드를 **같은 카드 언어**로 통일하되 상태는 확실히 구분.

| 항목 | 내용 |
|---|---|
| 통일 | 둘 다 `rounded-2xl` 카드 + 좌측 4px 강조선 + 상단 상태 배지(StatusPill)로 동일 레이아웃 |
| 미연결 | 좌측 **앰버** 강조선 + 옅은 앰버 배경(`bg-amber-50/30`) + `● 미연결` 배지 → "아직 처리 안 됨"이 확 띔 |
| 연결 완료 | 좌측 **에메랄드** 강조선 + `✓ 연결 완료` 배지 + 사람 아이콘·환자명 강조 → "환자 확정"이 분명 |
| 공통 헬퍼 | `StatusPill`·`CheckIcon`·`PersonIcon` 추가(home-feed 내부) |
| 빌드 | `npm run build` ✅ |

---

## 2026-06-20 세션 35 (feat) — 홈 '미연결 기록 + 최근 활동' 통합 피드

홈에 따로 떨어져 있던 두 영역을 하나의 시간순 피드로 합침(요청: 토글로 함께/하나씩).

| 항목 | 내용 |
|---|---|
| 통찰 | `activity_logs` 트리거가 **연결된 상담만** 기록(미연결 draft 제외) → 미연결기록과 최근활동은 **상호 배타**. 같은 상담이 미연결→연결 단계로 이동(연결 시 트리거가 `created_at=now()`로 활동 상단 노출) |
| 신규 | `components/home/home-feed.tsx` — 미연결(액션 카드) + 활동(연결 로그)을 `created_at` 시간순 병합. 상단 **토글 칩(미연결/활동)**: 둘 다(시간순)·하나씩. 활동은 5개 후 '전체 보기' |
| 동작 | 연결/삭제 시 `reload()` + `router.refresh()`로 양쪽 동기화(연결되면 미연결에서 빠지고 활동에 등장). 카드 액션(편집·연결·삭제·복사·재청취·새 녹음)은 기존 그대로 |
| 레이아웃 | 홈 순서: ConsultHero → PushBanner → **통합 피드** → 환자 검색(PatientHome) |
| 정리 | 기존 `unlinked-records-section.tsx`·`activity/activity-feed.tsx` 제거(통합 피드로 대체). `docs/architecture.md` 현행화 |
| 빌드 | `npm run build` ✅ |

---

## 2026-06-20 세션 34 (fix) — 연결 기록 '최신 작업 순' 정렬

증상: 미연결 기록을 환자에 연결하면, 환자 상세(연결 기록)에서 그 기록이 **아래로 가라앉음**.
원인: 정렬 기준이 `created_at`인데, 체어 기록의 `created_at`은 '체어에서 녹음한 과거 시각'.
방금 연결(`linked_at`=지금)해도 더 최근에 만든 기록 아래로 밀림.

| 항목 | 내용 |
|---|---|
| 수정 | `getConsultationsByPatientId`(환자 상세 = 연결 기록)를 **마지막 작업 시각 = max(created_at, linked_at) 내림차순**으로 정렬 → 방금 연결한 기록이 최상단 |
| 방식 | DB 마이그레이션 없이 서버액션에서 JS 정렬(환자당 ≤50건이라 충분). `linked_at` select 추가 |
| 미연결 | `getAllUnlinkedRecords`는 이미 `created_at desc`(최신 저장이 위) — 저장 시 홈 즉시 리프레시(ConsultationBoard `router.refresh()` → `initialRecords` 동기화)도 정상 확인 |
| 한계/후속 | **콘텐츠 편집 시각은 미반영**(consultation에 `updated_at` 없음). 편집도 '작업'으로 최상단에 올리려면 `updated_at` 컬럼+트리거 추가 필요 — 별도 제안 |
| 빌드 | `npm run build` ✅ |

---

## 2026-06-20 세션 33 (feat) — 상담보드 환자 안심 배너

상담보드는 보통 **환자 옆에서** 작성 → 환자에게 녹음의 '좋은 의도'를 크게 안내.

| 항목 | 내용 |
|---|---|
| 위치 | 상담보드(`consultation-board.tsx`) 녹음 바 바로 아래, 스크롤 밖 **항상 노출** 배너(방패✓ 아이콘 + 큰 제목 + 설명) |
| 문구 | 평상시 "안심하세요 — 환자분을 위한 기록이에요" / 녹음 중 "정확한 진료를 위해 상담을 기록하고 있어요". 공통 설명: 빠짐없이 남겨 정확히 진료·안전 보관·환자도 받아볼 수 있음(정직·선택 표현) |
| 동작 | 녹음 중에는 배경을 진한 하늘색으로 — 빨간 '녹음 중'과 정서적 균형 |
| 비고 | 문구는 컴포넌트 인라인(향후 기관별 커스터마이즈 후보). 직원용 안내(작은 회색 글씨)는 유지 |
| 빌드 | `npm run build` ✅ |

---

## 2026-06-20 세션 32 (fix) — SSO 로그인 후 대시보드 4~5초 (카드 479, 리전 거리)

웜 상태 4~5초의 진짜 원인 = **단일 병목이 아니라 리전 거리 누적**.

| 항목 | 내용 |
|---|---|
| ★진단 ① | Supabase DB 오리진 IPv6(`2406:da14:311::`)를 AWS ip-ranges로 역추적 → **ap-northeast-1(도쿄)** 확정. Vercel 함수는 `regions` 미지정 = 기본 **iad1(미국 워싱턴)** → DB·Auth 왕복마다 **미국↔도쿄 태평양 횡단**(왕복+TLS ~300ms) × 6~10회 ≈ 4~5초 |
| ★수정 ① | `vercel.json`에 `"regions": ["hnd1"]`(도쿄) — 함수를 Supabase와 **같은 리전에 코로케이션**. 왕복 ~300ms→~1~5ms. **단일 최대 레버** |
| 수정 ② | `getActivityLogs`가 캐시 우회한 `supabase.auth.getUser()`를 호출하던 것을 dedupe된 `getSessionUser()`로 교체 → 웜 대시보드 GoTrue 왕복 1회 제거 |
| 점검 ③ | SSO `generateLink`(hashed_token) + `verifyOtp`(세션 쿠키) 2회 GoTrue 왕복 = 구조상 불가피(토큰 발급→세션 확립). 코로케이션으로 각 왕복 자체가 저렴해져 영향 소멸. 변경 없음 |
| 점검 ④ | 레이아웃이 chairs/members/me·initialRecords를 prop으로 전달 중 → **클라이언트의 레이아웃 데이터 재호출 없음**(이미 충족). consultation-board의 `getRecentParticipants` 마운트 fetch는 별도 이력 데이터(향후 지연로드 후보) |
| 경계 | EO↔Carelog SSO 다리(토큰)는 경량·정상(헤임달 보증). 콜드스타트(별도 워밍)는 범위 밖 |
| 빌드 | `npm run build` ✅ |
| 후속 | 재사용 운영 노트 `docs/ops-region-colocation.md` 작성(EO 등 Vercel+Supabase 서비스 표준 점검 항목) + **헤임달 핸드오프 카드 480**(Carelog 해결 보고 + EO 적용 점검 요청) 발급 |

> 리전 변경은 **배포 후** Vercel 함수가 도쿄에서 재기동되어야 체감된다. 배포 직후 첫 호출은 콜드, 이후 웜에서 효과 확인.

---

## 2026-06-20 세션 31 (fix) — '서비스 소개'에서 로그아웃되어 보이던 버그 (SW HTML 캐싱)

증상: EO에서 SSO로 케어로그 로그인(대시보드 정상) → **'서비스 소개'(/about)** 누르면
로그인/시작하기 화면(로그아웃 상태)으로 보임.

| 항목 | 내용 |
|---|---|
| 진짜 원인 | `public/sw.js` 서비스워커가 **네비게이션(HTML) 응답을 통째로 캐시**(`cache.put`)하고 폴백에 사용. HTML에 로그인/로그아웃 상태가 박혀 있어, 로그아웃 시 캐시된 `/about`이 로그인 후에도 노출 |
| 왜 안 고쳐졌나 | 앞선 세션의 `/about` 인증 인식(async + getSessionUser) 수정은 옳았으나, SW가 서버 대신 **캐시 HTML로 응답**해 효과가 없었음 |
| 수정 | SW가 **HTML 네비게이션을 가로채지/캐시하지 않도록** 제거 — 인증 상태가 담긴 화면은 항상 네트워크(서버)에서. 정적 자산(`/_next/static/`)만 캐시 유지 |
| 캐시 무효화 | `CACHE_NAME` `carelog-v2`→`v3` 승급 → activate에서 구버전 캐시(오염된 `/about` HTML 포함) 삭제 |
| 영향 | 인증 화면 신선도 보장 + 서버 리다이렉트(SSO·온보딩) 깨짐 위험 제거. 오프라인 HTML 폴백은 포기(온라인 SaaS라 가치 작고 버그만 유발) |
| 빌드 | `npm run build` ✅ |

> 재현 해제: 사용자 기기에서 SW가 새 버전(v3)으로 교체되며 구캐시가 정리된다(다음 방문 시 자동).

---

## 2026-06-19 세션 30 (구현) — 요금제 표시 화면

요금정책을 화면으로. 표시 전용(결제·플랜변경은 향후 spec 010).

| 작업 | 결과 |
|---|---|
| 위치 | 설정(`/settings`) 상단 **"요금제" 섹션**(전 직원 노출 — 읽기 정보) |
| 표시 | 현재 플랜 배너(라벨·가격·태그라인) + **전체 등급 비교표**(기능×free/standard/pro/enterprise, 현재 열 강조) + 기대감 카피 + "업그레이드 신청 — 곧 열려요"(준비 중) |
| 단일 출처 | `lib/plan.ts`에 `PLAN_META`·`PLAN_FEATURES`·`PLAN_ORDER`(docs/pricing-tiers.md 미러). `getMyInstitutionPlan()`(institutions.plan) |
| 범위 밖 | 결제·플랜 변경·토큰 충전 = 향후. 지금은 표시·비교·기대감까지 |
| 빌드 | `npm run build` ✅ (DB 변경 없음, 표시 전용) |

---

## 2026-06-19 세션 29 (fix) — SSO 성능 2차 (카드 479)

웜 상태도 4~5초 → 구조적 홉·중복 제거.

| 수정 | 내용 |
|---|---|
| (A)★ 콜백 홉 제거 | `/api/auth/sso`가 hashed_token 직후 **그 자리서 `verifyOtp`로 세션쿠키 세팅 → 곧장 '/'**. `/auth/callback` 홉 통째 제거(서버리스 1홉+콜드1회+중복 verifyOtp·멤버조회 제거). SSO는 2단계서 멤버십 보장하므로 callback 온보딩 분기 불필요. (callback 라우트는 Google OAuth용으로 유지) |
| (B) getUser dedupe | 대시보드 진입은 이미 Promise.all(병렬)이었음 — 남은 비용은 **`auth.getUser()` 중복(레이아웃+3함수 ≈4회)**. `getSessionUser()`(React cache) 신설해 `getMyInstitutions`·`getMyInstitutionId`·`getMyAuthorInfo`·layout이 공유 → 인증 왕복 1회로 축소 |
| 빌드 | `npm run build` ✅ |

> 1차(#476) verified. 콜드(1회차)는 데모 직전 워밍으로 별도. 헤임달 연결 재검증 예정.

---

## 2026-06-19 세션 28 (구현) — 음성 원본 보관 (spec 009)

녹음 원본을 비공개 Storage에 등급별 보관·재청취. speckit 전 과정(specify→plan→tasks→implement).

| 작업 | 결과 |
|---|---|
| 스키마 | `20260619000001_audio_archive.sql` — `institutions.plan`(free/standard/pro/enterprise), `consultation.audio_path`·`audio_uploaded_at`, `audio_replay_logs`(감사, RLS), 비공개 버킷 `consultation-audio`. schema.sql·database.md 동반 |
| 정책 | `lib/plan.ts` — retentionDays(free=롤링3/std=90/pro·ent=365), auditReplay(pro+). 게이트 단일 출처 |
| 업로드 | `app/actions/audio.ts` `uploadConsultationAudio` — 저장 후 비차단 업로드, free 롤링 정리. 보드가 blob 보존→저장 시 업로드 |
| 재청취 | `getConsultationAudioUrl` — 기관·등급·만료 판정 → 서명URL(60초). `audio-replay-button` → `<audio>`. 미연결기록에 배치(audio 보유 시) |
| 정리·감사 | cron `/api/cron/prune-audio`(일1회, vercel.json) 등급별 만료 삭제. pro+ 재청취 `audio_replay_logs` 1건 |
| 헌법 | 비공개·서명URL·기관격리(I), 모든 mutation/URL=Server Action(II), 텍스트는 음성과 분리 영구(III) |
| 빌드 | `npm run build` ✅ |
| ⏳ 배포 전 필수 | **(1) 마이그레이션 적용 (2) 비공개 버킷 `consultation-audio` 생성(public OFF) (3) vercel cron 반영.** 미적용 상태로 코드 배포 시 `getAllUnlinkedRecords`의 audio_path select가 깨지므로 **마이그레이션 먼저 → 배포 순서 필수** |

> 미결: consultation-history(환자 상담이력) 재청취 버튼 배치는 후속(현재 미연결기록만). 법적 음성보존의무·동의형식 운영확인. 토큰/빌링 별건.

---

## 2026-06-19 세션 27 (fix) — SSO 로그인 성능 핫픽스 (카드 476)

헤임달 카드 476: `app/api/auth/sso/route.ts`가 로그인마다 무거운 작업을 동기 실행 → 느림. 서범기 데모 직결.

| 수정 | 내용 |
|---|---|
| ① 최대 병목 제거 | 기존 유저 조회를 `createUser(낙관적 실패)` + `listUsers({perPage:1000})`+JS find → **`generateLink(magiclink)` 1회**로 userId+세션토큰 동시 획득(기존 유저=대부분은 호출 1회). supabase-js 2.101엔 getUserByEmail 없어 generateLink-first 채택 |
| ② await 제거 | `await syncEoMaster`(EO fetch+다건 upsert)를 로그인 경로에서 제거 → 폴링 cron(`/api/cron/sync-master`)에 위임 |
| ③ 낙관적 create 제거 | generateLink-first가 곧 "존재확인 먼저", create는 신규 유저에만 |
| ④ 콜백 홉 단축 | 보류 — 쿠키/세션 흐름 리스크로 데모 직전 미적용(①② 만으로 ★최대 병목 둘 제거) |
| 빌드 | `npm run build` ✅ |

> 검증: 프로덕션 [SSO] 로그 타임스탬프 간격(userId→generating→redirecting) 단축 확인. 실 EO SSO 클릭 1회 검증 권장. 문제 시 `git revert`로 즉시 롤백.
>
> **결과(대표 체감): 여전히 생각보다 빠르지 않음.** ①② 제거에도 남은 지연 후보 → ⏳재방문:
> - ④ 보류한 콜백 홉(`/auth/callback` 1회 추가 리다이렉트+verifyOtp)
> - `generateLink`·Supabase admin 호출 자체 지연(GoTrue 왕복) / Supabase 리전
> - **로그인 직후 대시보드 레이아웃 5개 쿼리**(getMyInstitutions·getMyInstitutionId·getChairs·getClinicMembers·getMyAuthorInfo) — "첫 화면 느림"의 유력 원인
> - 서버리스 콜드스타트
> → 데모 직전 재최적화 시 ④ + 대시보드 쿼리 병렬/슬림화부터 검토.

---

## 2026-06-19 세션 26 (기획) — 요금·등급 정책(v2) + 음성 원본 보관 + spec 009

녹음 원본 보관 논의가 가격정책으로 확장 → 비판적 검토로 구조 확정. `docs/pricing-tiers.md`(v2) + `specs/009-audio-archive` 등급 정렬.

| 결정 | 내용 |
|---|---|
| 과금 단위 | **병원 월정액** + **토큰(전사 1분=토큰1)** 분리(변동원가 회수). 다지점=Enterprise 문의 |
| 등급 | **Free / Standard / Pro / Enterprise** (멤버 수 차등 없음) |
| 가격 | Standard 정가 ₩39,000(도입 ₩19,000) / Pro ₩59,000 / Free ₩0 / Enterprise 문의 |
| 포함 전사 | Free 30분 / Standard 300분 / Pro 1,000분(권장) · 초과 토큰 충전(원가~₩10/분, 판매 ₩30~50/분 초안) |
| 음성 원본 | Free=최근3 롤링(텍스트 유지) / Standard=90일 / Pro·Ent=1년+·감사 |
| 핵심 원칙 | 정액=기능·보관 / 토큰=전사분량. **상담보드(코어) 비매**, 모듈=주변부 고급. Free=맛보기+넛징 |
| 구현 연결 | `institutions.plan`(free/standard/pro/enterprise) → 게이트. 음성 보관=spec 009, 토큰 빌링=별건(향후) |

> 비판 검토: Pro 3,000→1,000분으로 낮춰 마진 80%대 확보(전사 원가 회피). 음성=중앙(Storage) 보관, 텍스트 차트는 등급 무관 영구. 법적 음성 보존의무 미결.

---

## 2026-06-19 세션 25 (기록) — 서범기 데모(강남 오늘의 치과) 진행중 캡처

모건 핸드오프: 강남 오늘의 치과 "신환 접수~상담 flow 효율화" Carelog 데모 흐름이 살아있음(서범기=연결고리, 주인공=상담실장). **결정: 데모 전용 작업은 하지 않고 핵심 기능 완성도를 높이는 것으로 대응.** 스코프·over-promise 위험·권장 시나리오를 카드로 보존.

| 항목 | 내용 |
|---|---|
| 기록 | `specs/000-backlog/seobeomgi-demo-scope.md` — 데모 대상·보여줄 수 있는 것·못 보여주는 것(덴트웹 자동연동 X·OCR X·상담PPT X·SMS 키 확인)·권장 시나리오 |
| 결정 | 별도 데모 개발 없음. 상담보드·녹음·전체복사 등 제품 기능 강화 = 곧 데모 준비 |
| 데모 임박 시(별도) | Solapi 키·데모 기기(안드/PC 크로미움) 점검 → 샘플 신환 시드 |
| 참조 | 미팅노트 260618_서범기미팅(구글닥). testers.md·beta-champion-pipeline은 미확보(EO 자산) |

> over-promise 방지: 덴트웹/OE 자동 연동은 없음(복사 1회·수동 업로드). 강조점은 "상담실장의 중복 손기입 제거".

---

## 2026-06-19 세션 24 (구현) — 다기기 알림·자동 refresh·전체 복사

케어로그 치과 실사용 도입 + 예미안 파일럿(도은쌤 주1회·시간당 3만·4회) 확정. 현장 요구 3건 반영. DB 변경 0.

| 작업 | 결과 |
|---|---|
| ① 같은 계정 다른 기기 알림 | 실시간 알림 에코 방지를 `actor_user_id` → **"이 탭이 방금 저장한 consultation_id"** 기준으로 변경(`lib/realtime/local-echo.ts`). 저장한 탭만 자기 토스트/소리 숨김 → **같은 계정으로 여러 PC 로그인 시 다른 화면은 알림 수신**. `live-alerts-provider`·`consultation-board`·`chair-overlay`에 `markLocalSave` 배선, `LiveAlertsProvider` currentUserId prop 제거 |
| ② 미연결기록 자동 refresh(타 기기 포함) | `UnlinkedRecordsSection`이 `initialRecords` prop 변경을 state에 반영하도록 동기화 effect 추가(기존 버그: useState 1회 초기화 후 미갱신). 실시간 알림의 `router.refresh()`가 모든 기기에서 목록 갱신 + 저장 기기는 보드 저장 직후 `router.refresh()`로 즉시 반영 |
| ③ 전체 복사 | `lib/html-to-text.ts`(HTML→평문, 줄바꿈 보존) + `components/copy-all-button.tsx`(클립보드 복사). **미연결 기록 카드·편집화면·상담보드·환자 상담이력**에 "전체 복사" 버튼 → 덴트웹 등 외부 EMR에 붙여넣기. 미연결 편집화면에 **"저장 후 환자 연결"**(편집→저장→연결 한 동선) 추가 |
| 빌드 | `npm run build` ✅ |

> 멀티기기(파일럿 워크스트림 A)에서 한 사람이 여러 PC를 같은 계정으로 띄워둬도 알림·목록이 일관되게 동기화됨.

---

## 2026-06-18 세션 23 (구현) — 상담보드 record-first (spec 008)

대표님 인사이트: 참여자 26명 선택이 과부하 + 급한 진료에 "선택 게이트"가 기록을 막는다 → **"선택 → 녹음"을 "녹음 → 채워넣기"로 역전**. spec-kit 전 과정(specify→plan→tasks→implement)으로 구현.

| 작업 | 결과 |
|---|---|
| 토대 — draft 세션 | `chair-provider.tsx`에 `DRAFT_CHAIR_KEY` — 체어 없이 녹음 시작/중지(기존 키 메커니즘 재사용), members·me context 노출. 기존 per-chair 오버레이 회귀 없음 |
| US1 record-first | `consultation-board.tsx`(신규) — 1탭 즉시 녹음 → 중지·전사 → **저장 시 체어 귀속**. `consult-hero.tsx`는 record-first 보드 진입으로 단순화(기존 picker 제거). 보드 닫아도 작성 내용·녹음 보존(FR-016) |
| US2 참여자 부담 해소 | `participant-picker.tsx`(신규, 검색·'나' 자동·최근순·역할 후순위) + `getRecentParticipants`(신규 읽기 액션, 최근 상담 participants distinct). 26명 노이즈(대표·한량·미분류) 후순위, 검색으로 전체 도달 |
| US3 종합 캔버스 | 보드 본문=`RichTextEditor`(인라인 이미지+그림 주석) + `PrescriptionPicker`. 녹음 도는 동안 본문·그림·처방·체어 병행(상태 분리로 녹음 끊김 0) |
| 설계 핵심 | **DB·서버 액션 시그니처 변경 0**(MVP) — `saveChairRecord(chairId,…)` 그대로, 변경은 클라이언트 재구성 + 읽기 액션 1개. 마이그레이션 불요 |
| 빌드 | `npm run build` ✅ (TypeScript 통과) |
| ⏳ 남은 것 | T017 녹음 일시정지(선택, 보류) · T021 실기기 수동검증(파일럿에서 SC-007) · main 배포(다온) |

> 멀티기기 세팅(예미안 파일럿 워크스트림 A)과 직결: 기기=체어 매핑 + record-first로 김도은 1년차가 "급할 때 빠짐없이 기록"하는 핵심 루프 완성.

---

## 2026-06-18 세션 22 (구현) — 원탭 녹음 UX (spec 006 강화)

체어 녹음 진입 단축. 기존 콜드 스타트는 "상담 기록 시작 → 체어 선택 → 녹음 시작" 3탭. 마지막 체어를 기억해 홈에서 1탭으로 바로 녹음 시작.

| 작업 | 결과 |
|---|---|
| 마지막 체어 기억 | `components/chair/consult-hero.tsx` — `localStorage["carelog:lastChairId"]`에 체어 선택 시 저장(`rememberChair`). 기기별이라 각 직원 기기가 자기 체어를 기억. 삭제된 체어 id는 복원 시 무시 |
| 원탭 녹음 버튼 | 마지막 체어가 있으면 히어로 1차 CTA를 `{체어명} 바로 녹음`으로 노출 → 같은 클릭 제스처 안에서 `openOverlay` + `startRecording` 호출(getUserMedia 사용자 제스처 보존). 보조 동선 "다른 체어로 기록"은 기존 picker로 |
| 폴백 | localStorage 미지원/차단 또는 마지막 체어 없음 → 기존 "상담 기록 시작" 흐름 그대로. 마이크 권한 거부 시 오버레이는 idle로 열려 재시도 가능 |
| 범위 | UI/클라이언트 한정 — DB/서버 액션/스키마 변경 없음. 기존 006 즉시기록 파이프라인 재사용 |
| 빌드 | `npm run build` ✅ (TypeScript 통과) |

> iOS "마이크 허용 1회화"는 PWA 설치 시 origin 권한이 유지되므로 별도 코드 없이 자연 충족. 체어 녹음 신뢰성(빈 녹음) 원인 확정은 대표님 요청으로 파킹(진단 계측 c81a4ef 배포 상태 유지).

---

## 2026-06-14 세션 21 (구현) — 실시간 체어 상담기록 알림 (spec 007)

spec-kit 전 과정(specify→plan→tasks→implement)으로 spec 007 구현. 예미안처럼 체어마다 PWA 띄워둔 환경에서 한 체어 기록이 올라오면 전 화면 실시간 인지.

| 작업 | 결과 |
|---|---|
| US1 실시간 토스트+목록갱신 | `lib/realtime/institution-events.ts`(chair_audit_logs INSERT 구독) + `components/notifications/live-alerts-provider.tsx`(에코방지·디바운스·재연결 refresh) + `alert-toast.tsx`, 대시보드 레이아웃 마운트 |
| US2 소리 | `alert-sound.ts`+`sound-arm-button.tsx`(1회 활성화·on/off, localStorage) + 헤더 배치, `public/sounds/alert.wav`(딩동) |
| US3 Web Push | `saveChairRecord`에 `sendPushToInstitution` fire-and-forget 추가(체어명·도착사실만) |
| 설계 핵심 | 진료본문 든 `consultation` 아닌 **`chair_audit_logs`(PII 0) 구독** → 전송선 환자정보 없음(헌법 I), `actor_user_id`로 에코방지. 목록은 `router.refresh()` 서버 재조회(헌법 II) |
| DB | 마이그레이션 `20260614000001_realtime_chair_audit_logs.sql`(chair_audit_logs를 supabase_realtime publication에 추가, 멱등). schema.sql·database.md 동기화 |
| 빌드 | `npm run build` ✅ |
| ⏳ 남은 수동작업 | **(1) 마이그레이션 Supabase 적용**(다온/대표 — 대시보드 Replication 확인) **(2) 실기기 검증**(두 화면 토스트/소리/푸시, quickstart.md) |

> 기기 확정: PC·안드로이드 태블릿·안드로이드 폰(보조), iOS 범위 밖 → 푸시·소리 제약 없음. 향후 알림·소통 기능(직원 호출·환자 도착 등)은 이 파이프라인 확장.

---

## 2026-06-13 세션 20 (기획) — 성장 축: 상담 데이터 → 경영관리·CRM

대표님 발의. 방향 캡처(스펙 아님). Carelog를 병원 상담 플랫폼으로 키우며 상담 데이터(상담 성공률 등)를 구조화 축적 → 경영관리·CRM 원천으로 잇는 사다리.

| 산출물 | 내용 |
|---|---|
| `docs/consult-analytics-crm-vision.md` | 신규 방향 문서 — 발전 사다리(기록→데이터·지표→경영관리·CRM), 수집 후보 필드, 지표 예시, EO 경계, 첫 걸음 |
| `roadmap.md` | 채움 — 지금(EO 안정화)/다음(상담 결과·유형+성공률 1단계)/나중(경영 대시보드·CRM·EO 피드·도메인 확장) |
| `docs/product-vision.md` | 관련 문서 목록에 성장 축 포인터 추가(기둥1 심화로 연결, SSOT 본문 불변) |

> 다음 액션: 우선순위 합의 후 1단계 `specs/007-consult-outcomes`(가칭) — `consultation` 결과/유형/전환/금액 필드 + 성공률 집계로 spec-kit 시작.

---

## 2026-06-10 세션 19 작업 내용 (EO 연동 프로덕션 라이브)

카드 235·237 마무리. 테오(EO) 측 게이트웨이 API·기관 연동·SSO 클레임 준비 완료 회신 → 시크릿 재발급 수신 → Carelog 배포·검증.

| 작업 | 결과 |
|---|---|
| 시크릿 등록 | 테오 새 `CARELOG_GATEWAY_SECRET` 재발급 → 대표님이 Carelog Vercel Production 등록 |
| EO 코드 배포 | work→`main`·`dev` 머지 배포. `lib/eo/*`·sync-master cron·SSO 확장 프로덕션 반영 |
| **cron 미들웨어 버그 fix** | `updateSession` 공개경로에 `/api/cron/` 누락 → Vercel Cron이 `/login`으로 307 리다이렉트되어 동기화 불가. `lib/supabase/middleware.ts`에 `/api/cron/` 추가(라우트 자체 `CRON_SECRET` 검증). 세션17 작성분이 미배포라 안 잡혔던 케이스 |
| 라이브 검증 | `GET /api/cron/sync-master` → `{ok:true, synced:1, skipped:1}`, 예미안(0e4e85d6) `synced(+0/~30/-0)` = EO 직원 30명 캐시. `error:config` 없음(시크릿 정상) |
| 연동 institution_id | `0e4e85d6-d839-48ef-a1fb-1915521b9395` (예미안치과의원, EO member_count 30) |
| 남은 확인(수동) | SSO 로그인 → 상담 저장 → `author_employee_id`·`author_name` 채워짐 최종 확인(EO "케어로그 열기" 경유) |

> 결정: EO는 import 없이 HTTP 게이트웨이/SSO로만 연동(헤임달 §3·§4). 상담 EO API 미구현(의료데이터 격리). 다음: SSO 작성자 귀속 실사용 확인 후 카드 237 종료.

---

## 2026-06-10 세션 18 작업 내용 (직원 초대 버그 수정 + 중복 워크스페이스 정리)

설정 화면 직원 초대에서 "초대 이메일 발송 실패: A user with this email address has already been registered" 발생 → 원인 분석 후 수정.

| 작업 | 결과 |
|---|---|
| 원인 | `inviteStaff`가 신규 전용 API `inviteUserByEmail`을 사용 → **이미 구글 로그인 등으로 auth 계정이 있는 이메일**엔 실패. 또한 콜백이 멤버 없으면 무조건 `/onboarding`(새 워크스페이스)로 보내 **초대받은 사람이 중복 워크스페이스를 생성**하는 트랩 존재 |
| ① `inviteStaff` 분기 (즉시 직원 추가) | 이미 가입된 계정이면 `inviteUserByEmail` 대신 `institution_members`에 **즉시 추가**(role 반영, 비활성 멤버는 재활성화). 신규 이메일은 기존 메일 초대 유지. `app/actions/institutions.ts` |
| ② 온보딩 트랩 보정 | `app/auth/callback/route.ts` — 멤버 없을 때 **대기 중(미수락·미만료) 초대가 있으면 `/invite/{token}`** 수락 동선으로, 없을 때만 `/onboarding` |
| ③ dangling invitation 방지 | 신규 이메일 초대 메일 발송 실패 시 방금 만든 `institution_invitations` row 롤백(delete) |
| 폼 UX | `staff-invite-form.tsx` — "직원으로 추가했습니다" vs "초대 이메일을 발송했습니다" 분기 + 즉시 추가 시 `router.refresh()`로 목록 갱신 |
| 데이터 핫픽스 | `yemian2012@gmail.com` 예미안치과(0e4e85d6) 직원 즉시 등록(SQL). 환자 테스트로 생긴 **중복 워크스페이스 `a15efbd8`(예미안치과, owner jihun0729)** 삭제 — 빈 워크스페이스(멤버 1건)라 cascade로 정리 |
| ④ 워크스페이스 이름 중복 방지 | `signUp`·`setupInstitution`에 기관명 **대소문자 무시 중복 검사**(`ilike`) 추가. signUp은 auth 유저 생성 **전에** 차단해 orphan 계정 방지. `app/actions/auth.ts` |
| ⑤ 직원 역할 변경 + 완전 제거 | `admin.ts`에 `changeStaffRole`(staff↔admin), `removeStaff`(멤버십 삭제) 액션 추가. 자기 자신·대표·슈퍼어드민 보호. `staff-list.tsx`에 역할 셀렉트 + 제거 버튼 배선(기존 활성/비활성 토글 유지) |
| 빌드/린트 | `npm run build` ✅ · 변경 파일 린트 이슈 없음(auth.ts `_formData` 미사용 경고는 기존 건) |

> 결정: "이미 계정 있는 사람 초대 = **즉시 직원 추가**"(이메일/수락 단계 없음), "워크스페이스 이름 = 전역 중복 불가".
> 후속 강화 후보(미적용): `institutions.name`에 DB 레벨 부분 unique index(`lower(name)`)로 동시성 레이스까지 차단. EO 게이트웨이 main 배포는 빌/테오 시크릿 회신 대기 중.

---

## 2026-06-08 세션 17 작업 내용 (카드 235 — EO 게이트웨이/SSO/작성자 귀속 구현)

핸드오프 카드 235 §6 구현계획 ①②③ 전체 구현. 계약: EO `spec-016`/카드#226(테오). 브랜치 `claude/festive-planck-FCghV`.

| 작업 | 결과 |
|---|---|
| ① 마스터 캐시 — `clinic_members` 재활용 | 마이그레이션 `20260608000001_eo_integration.sql`: `clinic_members`에 `eo_employee_id`·`email`·`eo_role`·`position`·`source`(manual/eo)·`synced_at` 추가. 기존 `unique(institution_id,name)` 완화 → 부분 unique 2종(manual 이름 / eo_employee_id). `lib/eo/gateway.ts` `fetchEoMaster()`(헤더 `x-gateway-secret`, 응답코드 200/400/401/404/500 매핑), `lib/eo/sync-master.ts` `syncEoMaster()`(eo_employee_id upsert·source='eo'·미존재 행 비활성·**manual 행 불가침**). 폴링 `app/api/cron/sync-master/route.ts`(Vercel Cron 10분, `CRON_SECRET` Bearer 보호) + `vercel.json` crons 등록 |
| ② SSO 보정 — `/api/auth/sso` | 확장 클레임(`employee_id`·`name`·`account_type`·`eo_role`) 수용. 신규 멤버는 `mapEoRole`(clinic_admin→admin, 그 외 staff)로 추가, 기존 멤버는 role 불변·`eo_employee_id`/`display_name`만 갱신(권한 과승격 방지). 로그인 시 해당 기관 EO lazy 동기화(best-effort, 비차단) |
| ③ 작성자 귀속 — `consultation` | 마이그레이션에 `author_employee_id`·`author_name` 추가. `lib/auth/institution.ts`에 `getMyAuthorInfo()` 신설 → `saveConsultation`·`saveChairRecord` 저장 시 자동 기록. 공용계정도 표시명 보존. **상담 EO API 미구현(계약 §4 의료데이터 격리)** |
| 타입·문서 | `lib/types/database.ts`(ConsultationRow·ClinicMemberRow·InstitutionMemberRow 컬럼), `supabase/schema.sql`, `docs/database.md`, `docs/architecture.md` 현행화 |
| 빌드 검증 | `npm run build` ✅ (TypeScript 통과, `/api/cron/sync-master` 동적 라우트 등록 확인) |

> ⏳ **배포 시 필수**: (1) `20260608000001_eo_integration.sql` Supabase 적용. (2) `CARELOG_GATEWAY_SECRET`을 **EO·Carelog 양쪽 Vercel**에 동일 등록(서버-서버). (3) `CARELOG_SSO_SECRET`(기존)·`EO_APP_URL` 확인, 선택 `CRON_SECRET` 등록.
> 🌿 카드의 `claude/dreamy-cerf-7LI1q` 대신 새 배정 브랜치 `claude/festive-planck-FCghV`에서 작업(카드 핸드오프 doc은 cherry-pick으로 동반).

---

## 2026-06-08 세션 16 작업 내용 (완료분 배포 + EO 계약 카드226 수신)

| 작업 | 결과 |
|---|---|
| 완료분 프로덕션 배포 | 참여자 선택 + 이미지 줌/팬(#2) + 홈 히어로 카피(#1) — `clinic_members` 마이그레이션 Supabase 적용 확인 후 `main` 머지·배포. 카드 235(EO 연동)와 분리해 완료분 우선 배포(완료분 방치 금지) |
| EO↔Carelog 연동 계약 수신 (카드226) | 테오 작성 `specs/016-carelog-integration/contracts/eo-gateway-and-sso.md` 전문 확보(EO 레포 자산, 빌 경유 전달). **확정 사항**: ① 마스터 게이트웨이 = Carelog가 `GET /api/gateway/carelog/master`로 pull(헤더 `x-gateway-secret: CARELOG_GATEWAY_SECRET`, 5~15분 폴링) → `clinic_members` 캐시 upsert(키=`employee_id`). ② SSO = 라이브, 클레임 확장(`employee_id`·`name`·`account_type`·`eo_role`·`scope`) → 작성자 귀속 키 저장 보정. ③ 상담 = **EO API 없음**(의료데이터 게이트웨이 금지), SSO 세션 후 Carelog 내부 저장·열람, 작성자만 `employee_id`/`email` 귀속 |
| 카드 235 착수 (다음) | ① `clinic_members` 재활용 캐시(eo_employee_id·email·eo_role 컬럼 + EO-source 동기화) ② `/api/auth/sso` 확장 클레임 수용 + `institution_members.eo_employee_id` 저장 ③ `consultation` 작성자 컬럼(author_employee_id·author_name) + 저장 시 귀속 |

> 📌 사전 추측 정정(빌): 게이트웨이는 `sso-token` 재사용 ❌ → 별도 서버-서버 시크릿 `x-gateway-secret`. 상담 EO API 구현 ❌(만들면 계약 위반).

---

## 2026-06-07 세션 14 작업 내용 (UX #1 + EO 통합 기획)

"2~5번 클릭이면 끝" 원칙으로 일상 플로우 점검 → 개선 착수 + EO↔Carelog 층위 기획.

| 작업 | 결과 |
|---|---|
| #1 상담 저장 성공 피드백 | `saveConsultation` 성공 시 redirect 제거 → `{ ok, mode }` 반환. `consultation-form`이 모드별 토스트("저장했어요 ✓"/"임시 저장"/"전송") + 폼 초기화 + `router.refresh()`로 타임라인 즉시 갱신. 죽은 코드(`ok` 항상 false)였던 성공 메시지 살림. `RichTextEditor`에 `clear()` 추가. **배포 완료** |
| EO↔Carelog 층위·통합 기획 | `docs/eo-carelog-integration.md` — SSOT 분할 + 브리지 계약 제안, 진료 후 피드백 파일럿. **제안 카드 25** EO 실비에게 전달(회신 대기) |

> 후보(미착수): #2 저장 버튼/동의 정리, #3 검색결과 행 전체 탭, #5 에러 문구 친화화, #4 체어 저장+연결 통합, #6 홈/환자목록 역할 분리. 환자 여정 단계적 가입(#7·#8)은 EO 보안/층위 합의 후 `specs/007`로.
>
> ⏳ **대기**: EO 실비 회신(층위 6문항) → `specs/007-eo-bridge-feedback` 착수.

---

## 2026-06-07 세션 15 작업 내용 (EO 통합 — 카드224 회신 반영)

실비 핸드오프 카드224(제안 카드25 회신) 수신 → `docs/eo-carelog-integration.md` 갱신.

| 작업 | 결과 |
|---|---|
| 미결 6문항 회신 반영 | **확정**: 클리닉·직원 마스터=EO 이관(Q1) / 환자 SSOT=Carelog(Q2) / 피드백 직원식별 O(Q4) / EO에 `sso-token`+`workspace_carelog_links` 기존재→재사용·중복금지(Q6). **방향확정·세부TBD**: 전송 관문=헤임달(카드219) 일원화·`sso-token` 재사용(Q5). **미결**: 암호화 lib/KMS·키공유(Q3) |
| 브리지 계약 1차 초안 | EO→CL 마스터(읽기)·CL→EO 환자 이벤트(`feedback.submitted`/`consent.updated`/`engagement.signal`) 공통 봉투·payload 초안. EO 소유 영역·헤임달 인증은 TBD 표기 |
| Living Consult 온보딩 기획 (카드229·달리) | `docs/living-consult-onboarding.md` — 진료 중 진입 부담↓: ①환자 설명화면+빠른녹음 버튼 ②의료진 멘트. **다온 결정**: 모니터=2기기+Realtime 읽기전용 `/present/[chairId]`, 동의='녹음·기록 동의'를 진료시점 캡처(개인정보 동의와 분리·거절도 기록), 기기=2기기 기본+1기기 폴백. 카피/멘트는 달리 브리프 확정안으로 대체 예정 |
| 제품 비전·정체성 SSOT 확정 (대표님 정의) | `docs/product-vision.md` 신규 — **환자 전용 아님**. 세 기둥: ①의료기관 상담 기록·시각화(STT/AI/상담보드→의무기록, B2B) ②연결고리(상담·사진·처방내역 환자 전달) ③환자 통합 보관·소통·생애주기 건강관리(B2C). README 첫 정의 교체 + project_status 상단 앵커 + 문서표 링크 |
| 빠른 녹음 설명화면 **구현** (Living Consult MVP) | `app/present/[chairId]` 신규 라우트(로그인 불요) + `components/chair/present-screen.tsx`. 흐름: 설명→선택(체어·담당의사·담당자, 선택 안 해도 진행)→**"같이 이야기 나누고 있어요"**(녹음 표현 X·sky 톤)→**상담 요약 시각화**(처방/다음방문 등)→**진료기록 받아보기 유도**. 메인카피 "기록으로 남겨서 저희가 전달해드릴게요", '삭제' 표현 배제(병원 보관). 미들웨어 `/present/` 공개경로. **빌드 통과**, 5개 상태 스크린샷 확인. **프로덕션 배포 완료**(carelog-tau.vercel.app/present/A). ⏳ 실제 음성 듣기·AI 요약(006 파이프라인)·Realtime 동기화·동의 컬럼 저장은 후속 |
| 홈 최상단 히어로 전환 (Living Consult 톤) | 기존 `QuickRecordTrigger`(빠른 기록 시작 버튼) → **`components/chair/consult-hero.tsx`**(`ConsultHero`)로 대체. 홈 최상단에 "오늘 진료, 기록으로 남겨서 환자에게 전달해요" 헤드라인 + "상담 기록 시작" CTA, 그 아래 대시보드(미연결 기록·환자검색·최근활동) 펼침. **기능 동일**(체어 칩/직접입력 → `openOverlay`). 기존 plain 헤더 제거, `quick-record-trigger.tsx` 삭제, architecture.md 갱신. **프로덕션 배포 완료** |
| 참여자(원장·직원·담당자) 선택 — 멤버 디렉터리 | ✅ **마이그레이션 적용·배포 완료(세션 16)**. 녹음 시작 시 참여자 선택 + 마스킹(송정훈→송정*). 신규: `clinic_members` 테이블(체어 패턴) + `consultation.participants` jsonb 스냅샷. 액션 `clinic-members.ts`(getClinicMembers·upsertClinicMember), 설정 '멤버 관리' UI, 히어로 참여자 칩, `saveChairRecord`에 participants 저장, 오버레이 참여자 표시. 이름은 추후 EO 이관 예정. 마이그레이션 `20260607000001_clinic_members.sql` Supabase 적용 완료. 빌드 통과 |
| 홈 히어로 카피 미세조정 (#1) | 서브카피 "…검토 후 보내면 **환자가 직접 받아 보관해요**"로 환자가치 강조(이전 다온 문구 반영). 88915aa(zen-cerf)는 옛 헤더 수정이라 무효·미병합 |
| 이미지 줌/팬 (#2) | **보기 라이트박스**(`consultation-history`): 재사용 `ZoomableImage`(휠/버튼/핀치/드래그/더블클릭) 적용. **주석 화면**(`image-annotator`): CSS transform 줌(그리기 좌표 보존) + ✋이동 툴(팬) + 핀치 + 휠 + 줌버튼. 외부 라이브러리 없음. 빌드 통과·프리뷰 확인 |

> ⚠️ **세션 환경 한계**: 이 세션은 `carelog` 단독 클론(`../eo`·`../iris` 미존재) + GitHub MCP 범위 `gungang83/carelog` 한정. 카드26 지시1(EO 암호화·RRN 처리 이식)·지시2(EO 기존 피드백 기획 대조)는 **EO 소스 접근 확보 후** 수행 — 추측 산출물 배제.
>
> ⏳ **다음**: 헤임달 관문계약(카드219·spec-048) 확인 → Q3·전송 스키마 확정 → `specs/007-eo-bridge-feedback` 스펙 착수.
> 🌿 작업 브랜치: 이 세션은 `claude/dreamy-cerf-7LI1q` (CLAUDE.local.md 표기 `claude/zen-cerf-hWuUw`와 상이 — 세션별 브랜치 차이 확인 요).

---

## 2026-06-01 세션 13 작업 내용 (빠른 기록 4종 개선/버그픽스)

| 작업 | 결과 |
|---|---|
| ① 녹음 중 화면 잠금 대응 | `chair-provider.tsx`에 Screen Wake Lock 추가(녹음 중 화면 꺼짐 방지) + 복귀 시 재획득 + `recorder.onerror` 트랙 정리. 모바일 잠금으로 인한 녹음 손상/에러 방지 |
| ② 신규 환자 임시 등록 | `createPatientAndLink`는 기존 구현 — 검색 화면에 "새 환자 등록" 버튼을 **항상** 노출하도록 개선(`chair-patient-search.tsx`) |
| ③ 줄바꿈 손실 | 저장 시 평문 전사 텍스트를 HTML로 정규화(`ensureHtml`/`plainTextToHtml` in `sanitize-html.ts`) → `saveChairRecord`/`updateChairRecordContent` 적용. 기존 평문 기록도 마이그레이션에서 일괄 변환 |
| ④ 연결 후 최근 활동 미노출/클릭불가 | `activity_logs` INSERT 트리거가 draft(patient_id NULL)는 건너뛰고, **UPDATE 트리거 신설**로 연결/재연결/해제 시 동기화. 기존 NULL 로그 정리 (migration 20260601000001) |
| 문서 | `supabase/schema.sql`에 activity_logs 섹션 현행화, `docs/database.md` 갱신 |

> ✅ **DB 마이그레이션 적용 완료**: `20260601000001_activity_log_patient_sync.sql` — Supabase SQL Editor 실행 완료, 폰 테스트로 ①~④ 정상 확인됨.

---

## 2026-05-31 세션 12 작업 내용 (조직 공통 PLAYBOOK 도입)

> 실비(EO 기획) 핸드오프: EO·Carelog·Iris 공통 운영 플레이북 도입.

| 작업 | 결과 |
|---|---|
| `PLAYBOOK.md` 신규 (루트) | EO 원본 기준 조직 공통 운영 플레이북 — 커뮤니케이션·에이전트 정의·커밋 컨벤션·협업 규칙·핸드오프 카드·배포 정책·운영 철학·동기화 프로토콜. §2 Daon 성격란 채움 |
| `CLAUDE.md` 정리 | 최상단에 PLAYBOOK 우선 참조 줄 추가; 공통 규칙(협업·커밋컨벤션·에이전트 정의) 제거 → **Carelog 특화(운영 주체·브랜치·Vercel 배포)만** 남김 |
| 정체성 추적 방침 명시 | 원격 web 세션이라 `CLAUDE.local.md`를 레포에 커밋(추적)해 정체성 유지 — PLAYBOOK의 "git 미추적"과 다른 Carelog 예외임을 CLAUDE.md에 기록 |
| EO 제안서 후속 | 디자인 공통화 제안(`proposal-eo-design-system.md`)과 별개로, 운영 방식 공통화가 PLAYBOOK으로 먼저 도입됨 |

> 📌 **동기화 의무**: EO `PLAYBOOK.md`가 바뀌면 실비가 "동기화 카드"를 보냄 → 다온이 Carelog `PLAYBOOK.md`에 반영. 두 레포 상단 버전(날짜) 일치로 확인. (PLAYBOOK §7)

---

## 2026-05-30 세션 11 작업 내용 (멀티 에이전트 협업 체계 이식)

| 작업 | 결과 |
|---|---|
| `docs/multi-agent-playbook-template.md` 신규 | EO 검증 멀티 에이전트 협업 모델(원격 웹세션판) 이식용 템플릿 전문 |
| `.gitattributes` 신규 | `CLAUDE.local.md merge=ours` — 정체성 파일 머지 보호 |
| `CLAUDE.md` 협업 섹션 추가 | 2역할(기획 PM / 시니어 개발·배포) 소유권·브랜치 전략·커밋 컨벤션·협업 규칙 |
| `roadmap.md` 신규 | 기획 PM 로드맵 골격 |
| `specs/000-backlog/README.md` 신규 | 핸드오프 큐 골격 |
| `CLAUDE.local.md` 신규 | **다온(🟣) 정체성 — 기획 PM + 시니어 개발·배포 겸임** |
| `dev` 브랜치 생성 | main/dev 2단 브랜치 구조 확립 |
| 운영 체제 확정 | 현재 다온이 기획·개발·배포 전 역할 겸임 (추후 분리 가능) |
| **VAPID 빌드 취약점 수정** | `push.ts`·`patient-portal.ts`가 모듈 로드/호출 시 `setVapidDetails`를 비널 단언으로 호출 → 환경변수 없는 환경(Vercel Preview)에서 빌드 붕괴. 지연 초기화 + env 가드로 변경(없으면 푸시만 건너뜀, 빌드는 통과) |
| dev Preview 배포 실패 대응 | `dev` 브랜치 push가 Preview 배포를 트리거했으나 Preview 환경에 `VAPID_*` 미설정으로 실패 → 위 코드 가드로 해결 |
| `vercel.json` 신규 | `git.deploymentEnabled`로 `dev`·작업 브랜치 자동 배포 비활성 → **main(Production)만 배포**, Preview 노이즈/크레딧 제거 |

---

## 2026-05-27 세션 10 작업 내용 (문서 정리 + 미연결 기록 성능 개선)

| 작업 | 결과 |
|---|---|
| `README.md` 업데이트 | 주요 기능 목록 현행화 (체어 즉시 기록·환자 포털·Web Push·다중 테넌트 추가); 프로젝트 구조 라우트 그룹 반영; 문서 표에 `docs/design.md` 추가 |
| `docs/architecture.md` 수정 | 체어 즉시 기록 데이터 흐름 전면 재작성 — 삭제된 ChairButtons·ChairRecordList 제거, QuickRecordTrigger·UnlinkedRecordsSection·RelinkControls 반영; unlinkChairRecord·relinkChairRecord 흐름 추가 |
| `docs/database.md` 수정 | 마이그레이션 목록에 `20260517000002_patient_auth_links.sql` 추가; `chair_audit_logs.event_type`에 `patient_unlinked` / `patient_relinked` 추가 |
| 미연결 기록 로딩 성능 개선 | `page.tsx`에서 `getAllUnlinkedRecords`를 서버 사이드로 병렬 페칭 후 prop으로 전달 → 클라이언트 `useEffect` 왕복 제거, 화면 로드 즉시 표시 |
| 빌드 검증 | `npm run build` ✅ 통과 |

---

## 2026-05-25 세션 9 작업 내용 (빠른 기록 UX 고도화)

| 작업 | 결과 |
|---|---|
| 헤더 A/B/C 체어 버튼 제거 | `header.tsx`에서 `ChairButtons` 완전 제거 |
| `chair-buttons.tsx` 삭제 | 불필요 파일 삭제 |
| `chair-record-list.tsx` 삭제 | 홈 인라인 섹션으로 대체되어 삭제 |
| `getAllUnlinkedRecords` 액션 | 모든 체어 미연결 기록 통합 조회 (chair_id, prescriptions 포함) |
| `unlinkChairRecord` 액션 | 연결된 기록을 미연결 상태로 되돌리기 + 감사 로그 |
| `relinkChairRecord` 액션 | 다른 환자로 재연결 + 감사 로그 |
| `saveChairRecord` / `updateChairRecordContent` 업데이트 | prescriptions 파라미터 추가 |
| `prescription-picker.tsx` 생성 | 컴팩트 칩 형태의 처방 선택 컴포넌트 |
| `chair-overlay.tsx` 업그레이드 | has_records 상태에 PrescriptionPicker 추가; DB 기록만 있는 경우 idle 표시 |
| `unlinked-records-section.tsx` 생성 | 홈 화면 미연결 기록 인라인 섹션 (RichTextEditor + PrescriptionPicker + 환자 연결 + 삭제) |
| `quick-record-trigger.tsx` 단순화 | amber 배지 버튼 제거, "빠른 기록 시작" 단일 버튼 |
| 홈 페이지 업데이트 | `UnlinkedRecordsSection` 추가 (QuickRecordTrigger와 PatientHome 사이) |
| `getConsultationsByPatientId` 업데이트 | `chair_id` 컬럼 포함 조회 |
| `ConsultationHistoryItem` 타입 업데이트 | `chair_id: string \| null` 추가 |
| `consultation-history.tsx` 업데이트 | `RelinkControls` 컴포넌트 추가 (체어 기록에만 표시) |
| 빌드 검증 | `npm run build` ✅ 통과 (TypeScript 포함) |

---

## 2026-05-25 세션 8 작업 내용 (체어 즉시 기록 — spec 006)

| 작업 | 결과 |
|---|---|
| speckit 006 전체 실행 | spec.md → plan.md → tasks.md → 구현 완료 |
| DB 마이그레이션 | `chairs`, `chair_audit_logs` 테이블 추가; `consultation` 수정 (patient_id nullable, chair_id/linked_at/linked_by 추가) |
| `app/actions/chairs.ts` | 체어 CRUD + 체어 기록 CRUD + 환자 연결 + 감사 로그 Server Actions |
| `components/chair/chair-provider.tsx` | Context + useReducer 전역 상태; MediaRecorder ref 보관 |
| `components/chair/chair-buttons.tsx` | 헤더 내 체어 상태 버튼 (idle/recording/has_records 배지) |
| `components/chair/chair-overlay.tsx` | createPortal(body) 다이얼로그; 4단계 상태 UI |
| `components/chair/chair-record-list.tsx` | 미연결 기록 목록 + 삭제 |
| `components/chair/chair-patient-search.tsx` | 환자 검색 + 연결 |
| `components/chair/chair-settings.tsx` | 설정 페이지 체어 관리 (admin/owner) |
| `app/(dashboard)/layout.tsx` 수정 | maxDuration=120, ChairProvider 래핑, ChairOverlay 삽입 |
| `components/layout/header.tsx` 수정 | ChairButtons 추가 |
| `app/(dashboard)/settings/page.tsx` 수정 | ChairSettings 섹션 추가 |
| `lib/types/database.ts` 수정 | ChairRow, ChairAuditLogRow 타입 추가; ConsultationRow 필드 갱신 |
| `supabase/schema.sql` 업데이트 | chairs, chair_audit_logs DDL + RLS; consultation 변경 반영 |
| 빌드 검증 | `npm run build` ✅ 통과 (TypeScript 포함, 19 static pages) |

---

## 2026-05-17 세션 7 작업 내용 (환자 앱 — Google OAuth 가입 + 이중 역할 + 환자 푸시)

| 작업 | 결과 |
|---|---|
| speckit 005 계획 수립 | research.md, data-model.md, contracts/, quickstart.md, plan.md, tasks.md 생성 |
| DB 마이그레이션 | `patient_auth_links`, `patient_push_subscriptions` 테이블 추가 (migration 20260517000002) |
| getPatientSession 업데이트 | OTP 쿠키 → Supabase Google 세션 폴백 지원 |
| /auth/patient-callback | 환자 Google OAuth 전용 콜백 라우트 생성 |
| /portal/signup-cta | OTP 인증 후 상담 미리보기 + Google 가입 CTA 페이지 |
| /portal/link-account | Google 로그인 했지만 환자 계정 미연결 시 안내 |
| PatientSignupCta 컴포넌트 | Google OAuth 가입 버튼 (pending 쿠키 설정 + OAuth 리디렉션) |
| PatientLoginForm 업데이트 | OTP 폼 아래 Google 로그인 버튼 추가 |
| PatientOtpForm 업데이트 | isNewAccount + invitationToken 시 /portal/signup-cta 리디렉션 |
| 직원 헤더 업데이트 | "내 진료 기록" 링크 추가 (/portal/records) |
| /portal/records 업데이트 | PatientPushBanner 추가, "직원 화면" 링크 추가 |
| PatientPushBanner 생성 | 환자용 Web Push 구독 배너 (patient_push_subscriptions 사용) |
| consultations.ts 업데이트 | 상담 저장 시 환자에게도 푸시 알림 fire-and-forget |
| 빌드 검증 | `npm run build` ✅ 통과 |

---

## 2026-05-11 세션 3 작업 내용 (리치 에디터 + 이미지 주석)

| 작업 | 결과 |
|---|---|
| Tiptap 리치 텍스트 에디터 통합 | `components/rich-text-editor.tsx` 생성 — StarterKit + Placeholder, 툴바 (B/I/S/H1~H3/목록/인용/구분선/실행취소) |
| 상담 폼 textarea → RichTextEditor 교체 | `consultation-form.tsx` 수정 |
| 상담 이력 HTML 렌더링 | `consultation-history.tsx` `dangerouslySetInnerHTML` 적용 |
| globals.css rich text 스타일 추가 | Tiptap placeholder + h1~h3/bold/italic/list/blockquote/hr 스타일 |
| `@tiptap/extension-image` 설치 | Tiptap 인라인 이미지 지원 |
| ResizableImage 커스텀 확장 | `ReactNodeViewRenderer` + 모서리 드래그 크기 조절 핸들 |
| 이미지 Supabase Storage 즉시 업로드 | 저장 버튼 누르기 전에 브라우저 클라이언트로 업로드, URL을 HTML에 포함 |
| 이미지 주석 도구 (`ImageAnnotator`) | `components/image-annotator.tsx` — 펜·직선·화살표·사각형·텍스트·지우개, 색상 7종, 두께 3단계, Ctrl+Z, 터치 지원 |
| 이미지 삽입 흐름 통합 | 툴바 버튼 / 드래그 앤 드롭 / Ctrl+V → 주석 도구 → Supabase 업로드 → 에디터 인라인 삽입 |
| 기존 별도 이미지 첨부 섹션 제거 | `consultation-form.tsx` 단순화 |
| 빌드 검증 | `npm run build` ✅ 통과 |

---

## 2026-05-14 세션 5 작업 내용 (어드민 패널 — 기관 전환 + 직원 권한 관리)

| 작업 | 결과 |
|---|---|
| `supabase/migrations/20260514000001_admin_panel.sql` | `institution_members.is_active` 컬럼 추가 (Supabase SQL Editor에서 적용 완료) |
| `lib/admin.ts` 생성 | `isSuperAdmin(email)` 유틸리티 함수 |
| `lib/auth/institution.ts` 재작성 | `getMyInstitutions()`, `getMyInstitutionId()` (쿠키 우선), `getMyInstitution()` |
| `app/actions/admin.ts` 생성 | `switchInstitution`, `getStaffList`, `setStaffActive`, `getAllInstitutions`, `getInstitutionStaff`, `setStaffActiveAsAdmin`, `updateInstitutionName` |
| `components/layout/institution-switcher.tsx` 생성 | 기관 전환 드롭다운 클라이언트 컴포넌트 |
| `components/layout/header.tsx` 수정 | props 교체 (`institutionName` → `institutions`/`activeInstitutionId`), 설정 링크 추가 |
| `app/(dashboard)/layout.tsx` 수정 | `getMyInstitutions()` + `getMyInstitutionId()` 사용, is_active=false 접근 차단 |
| `components/settings/staff-list.tsx` 생성 | 직원 목록 테이블 + is_active 토글 |
| `components/settings/staff-invite-form.tsx` 생성 | 직원 초대 폼 |
| `components/settings/institution-name-form.tsx` 생성 | 기관명 수정 폼 |
| `app/(dashboard)/settings/page.tsx` 생성 | 설정 페이지 (owner: 기관 프로필 + 직원 관리 / admin: 직원 관리 / staff: 안내) |
| `components/admin/institution-list.tsx` 생성 | 기관 목록 + 기관별 직원 펼치기/권한 토글 |
| `app/(dashboard)/admin/page.tsx` 생성 | 최고 관리자 패널 (슈퍼 어드민 전용) |
| 빌드 검증 | `npm run build` ✅ 통과 |

---

## 2026-05-12 세션 4 작업 내용 (Google OAuth 로그인)

| 작업 | 결과 |
|---|---|
| Google 로그인 버튼 추가 | `components/auth/login-form.tsx` — Google 아이콘 버튼, `signInWithOAuth({ provider: "google" })` |
| 온보딩 플로우 구현 | `app/(auth)/onboarding/page.tsx` + `components/auth/onboarding-form.tsx` — 신규 Google 사용자 기관명 입력 |
| `setupInstitution` Server Action | `app/actions/auth.ts` — institution + member 생성, 이미 기관 있으면 스킵 |
| `/auth/callback` 수정 | institution_members 존재 여부 확인 → 없으면 `/onboarding` 리다이렉트 |
| 빌드 검증 | `npm run build` ✅ 통과 |

---

## 2026-05-10 세션 2 작업 내용 (환자 포털 구현)

| 작업 | 결과 |
|---|---|
| solapi 패키지 설치 | v6.0.1 (패키지명: solapi, not @solapi/node-sdk) |
| 마이그레이션 파일 생성 | supabase/migrations/20260510000001_patient_portal.sql (5개 테이블) |
| app/(patient)/ 라우트 그룹 생성 | /p/[token], /portal/login, /portal/verify, /portal/records |
| lib/sms/solapi.ts 생성 | sendSms() 함수 구현 |
| lib/patient-session.ts 생성 | getPatientSession() 함수 구현 |
| 미들웨어 공개 경로 추가 | /p/, /portal/login, /portal/verify |
| DB 타입 추가 | PatientInvitationRow 등 5개 신규 타입 |
| app/actions/patient-portal.ts 생성 | sendPatientInvitation, requestPatientOtp, verifyPatientOtp, getPatientRecords, patientLogout |
| SendInvitationButton 컴포넌트 | 직원용 모달 UI + 동의 체크 |
| PatientLoginForm 컴포넌트 | 주민번호 앞/뒤 + 전화번호 입력 |
| PatientOtpForm 컴포넌트 | 6자리 OTP 입력 |
| PatientRecordsList 컴포넌트 | 상담 카드 펼치기/닫기 |
| 환자 상세 페이지 업데이트 | "환자 포털" 섹션 + SendInvitationButton 추가 |
| DB 마이그레이션 실행 | 사용자가 Supabase SQL Editor에서 직접 실행 완료 |
| 빌드 검증 | npm run build ✅ 통과 |
| 문서 현행화 | architecture.md, database.md, schema.sql, project_status.md 업데이트 |

---

## 2026-05-10 세션 1 작업 내용

| 작업 | 결과 |
|---|---|
| BOM 인코딩 오류 수정 | `SUPABASE_SERVICE_ROLE_KEY` BOM(U+FEFF) 제거 |
| Vercel env var 재설정 | printf로 BOM 없이 production/development 환경변수 재추가 |
| /auth/callback 라우트 추가 | PKCE 이메일 인증 코드 교환 → 자동 로그인 |
| Supabase Site URL 수정 | localhost:3000 → carelog-tau.vercel.app |
| 이메일 인증 수동 처리 | SQL로 email_confirmed_at 직접 설정 |
| 기존 데이터 기관 귀속 | patient 1건, consultation 8건 → 예미안치과로 UPDATE |
| 전체 동작 검증 | 로그인 + 환자 검색 정상 확인 |
| 문서 현행화 | architecture.md, database.md, schema.sql, tasks.md 전면 업데이트 |

---

## 알려진 이슈 / 남은 작업

| 이슈 | 심각도 | 상태 |
|---|---|---|
| Solapi 실제 API 키 미설정 | 높음 | ⏳ .env.local과 Vercel에 실제 키 입력 필요 |
| Google OAuth 외부 설정 미완료 | 높음 | ⏳ Google Cloud Console + Supabase Dashboard 설정 필요 (아래 참조) |
| NEXT_PUBLIC_SITE_URL 환경변수 미설정 | 낮음 | Vercel에 https://carelog-tau.vercel.app 추가 권장 |
| spec 002 quickstart 시나리오 수동 검증 | 낮음 | ⏳ Solapi 키 설정 후 전체 흐름 테스트 필요 |
| 어드민 패널 DB 마이그레이션 | 완료 | ✅ 20260514000001_admin_panel.sql 적용 완료 |
| **chair_quick_record DB 마이그레이션** | 높음 | ⏳ 20260526000001_chair_quick_record.sql Supabase에 적용 필요 |
| **activity_log_patient_sync 마이그레이션** | — | ✅ 20260601000001 적용 완료 (세션 13) — 최근 활동 환자 연결 동기화 + 기존 줄바꿈 변환 |
| Vercel Preview 환경 VAPID 미설정 | 낮음 | dev/Preview 빌드는 코드 가드로 통과하나 Preview에서 푸시는 비활성. 필요 시 Vercel Preview 스코프에 VAPID_* 추가 |
| **EO 연동 마이그레이션 적용** | — | ✅ `20260608000001_eo_integration.sql` Supabase 적용 완료 (세션 17) — clinic_members EO 컬럼 + consultation 작성자 컬럼 |
| **`CARELOG_GATEWAY_SECRET` 양쪽 Vercel 등록** | 높음 | ⏳ EO·Carelog 양쪽에 동일 시크릿 등록 전까지 게이트웨이 동기화는 config 사유로 조용히 스킵됨 |

---

## 다음 우선순위

1. **chair_quick_record DB 마이그레이션 적용** — Supabase SQL Editor에서 `supabase/migrations/20260526000001_chair_quick_record.sql` 실행
2. **체어 기록 기능 수동 검증** — 헤더 A/B/C 버튼 → 녹음 → AI 변환 → 환자 연결 전체 흐름
3. **Google OAuth 외부 설정** — Google Cloud Console + Supabase Dashboard 설정 (아래 설명 참조)
4. **Solapi 계정 생성** + 발신번호 등록 후 `.env.local` 및 Vercel에 API 키 입력
5. **spec 002 quickstart 7개 시나리오** 수동 검증 (환자 포털 전체 흐름)

### Google OAuth 설정 가이드

**1. Google Cloud Console**
- console.cloud.google.com → 프로젝트 선택 또는 생성
- APIs & Services → OAuth consent screen → External → 앱 정보 입력
- APIs & Services → Credentials → Create Credentials → OAuth client ID
  - Application type: Web application
  - Authorized redirect URIs:
    - `https://svffiungfijiybvrrnpu.supabase.co/auth/v1/callback`
- Client ID와 Client Secret 복사

**2. Supabase Dashboard**
- supabase.com → 프로젝트 → Authentication → Providers → Google
- Client ID와 Client Secret 붙여넣기 → Save

---

## 중장기 로드맵

| Phase | 내용 | 상태 |
|---|---|---|
| Phase 1 | 직원 로그인 + 기관 계정 + RLS | ✅ 완료 |
| Phase 2 (spec 002) | 환자 포털 — SMS 초대 + OTP 가입 + 상담 조회 | ✅ 완료 (Solapi 키 입력 대기) |
| Phase 2.5 | 리치 에디터 + 인라인 이미지 + 주석 도구 | ✅ 완료 |
| Phase 3 (spec 003) | 어드민 패널 — 기관 전환 + 직원 권한 관리 + 최고 관리자 | ✅ 완료 |
| Phase 4 | 콘텐츠 블록 모델 + Audit log | 미착수 |
| Phase 4 | AI 기능 (오디오 전사, 상담 요약) | ✅ 체어 기록 통해 구현 완료 |
| Phase 5 (spec 006) | 체어 즉시 기록 — 헤더 오버레이 + 환자 연결 + 감사 로그 | ✅ 완료 |

---

## 개발 원칙

모든 기능 개발은 Spec-Driven Development:
`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`

Constitution: `.specify/memory/constitution.md` (v1.1.0)

## 인프라 현황

| 항목 | 값 |
|---|---|
| 배포 URL | https://carelog-tau.vercel.app |
| Supabase 프로젝트 | svffiungfijiybvrrnpu |
| Supabase Site URL | https://carelog-tau.vercel.app |
| Redirect URLs | https://carelog-tau.vercel.app/**, http://localhost:3000/** |
| DB 마이그레이션 적용 완료 | 20260509000001_staff_auth_institution.sql, 20260510000001_patient_portal.sql |
