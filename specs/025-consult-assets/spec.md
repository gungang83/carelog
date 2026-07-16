# spec 025 (기획) — 상담 이미지 라이브러리 + 상담 템플릿

> 상태: **기획 단계 — 구현 착수 전, 대표님 논점 확정 대기.**
> 대표 요청(세션 66): "미리 넣어둔 이미지를 활용해 상담할 수 있게. Carelog 제공 이미지 + 기관 업로드 이미지. 상담 템플릿을 만들자."
> 작성: 다온 · 2026-07-08

## 1. 배경 · 문제

상담(임플란트·신경치료·교정 등)마다 반복해서 쓰는 설명 자료(단계 그림, 치식도, 장치 사진, 전후 사례)가 있는데, 지금은 상담 때마다 에디터에 이미지를 새로 업로드해야 한다. 자주 쓰는 자료를 **미리 등록해 두고 상담 중 골라 쓰는** 구조가 필요하다.

## 2. 개념 — 2계층

1. **이미지 라이브러리(consult assets)** — 재사용 설명 자료 단건. 출처 2종:
   - **전역(Carelog 제공)**: 모든 기관 공통. 슈퍼어드민이 발행·관리. *(spec 022에서 검증한 "전역 = institution_id NULL + service_role write" 패턴 재사용)*
   - **기관**: 각 기관의 owner/admin이 업로드·관리하는 자기 자산.
2. **상담 템플릿(consult templates)** — 이미지(들) + 기본 문구 골격을 묶은 프리셋.
   예: "임플란트 1차 상담" = 단계 이미지 3장 + 비용·기간 안내 골격 텍스트. 상담 시작 시 템플릿을 깔고 그 위에 녹음 요약/메모를 얹는 흐름.

## 3. 사용 흐름 (UX 초안)

- 상담 에디터(체어 에디터·카드 인라인 편집·상담 폼 — 전부 공용 `rich-text-editor`) 툴바에 **"📚 자료" 버튼** → 픽커 팝업:
  - 탭: [우리 기관] [Carelog 제공] + 카테고리 필터 + 검색(제목).
  - 이미지 클릭 → 에디터 커서 위치에 삽입(딸린 설명 문구가 있으면 캡션으로 함께).
  - 템플릿 탭: 템플릿 선택 → 이미지+문구 골격이 본문에 한 번에 깔림.
- **환자에게 보여주기(프레젠테이션)**: 픽커에서 이미지를 크게 띄워 태블릿으로 환자에게 보여주며 설명하는 뷰어 모드. *(논점 B — v1 포함 여부)*
- 삽입된 이미지는 기존 content HTML 인라인 방식 그대로 → 환자 포털·전체 복사·카드 표시에 추가 작업 없음. (전체 복사는 평문이라 이미지는 원래 제외 — 현행과 동일)

## 4. 데이터 모델 (초안)

```sql
-- 라이브러리 (전역+기관 통합 — announcements 패턴)
create table consult_assets (
  id uuid pk,
  institution_id uuid null references institutions(id) on delete cascade,  -- null = 전역(Carelog 제공)
  title text not null,
  category text not null default 'general',   -- lib config 확장형 (임플란트/신경치료/보철/교정/치주/예방/장치/기타)
  image_url text not null,                    -- consult-assets 버킷, webp 압축(spec 017 재사용)
  caption text,                               -- 삽입 시 딸려가는 설명 문구(선택)
  display_order int default 0,
  active boolean default true,
  created_by text, created_at timestamptz
);
-- RLS: read = 전역(institution_id is null and active) or 자기 기관 멤버십(my_institution_ids)
--      기관 write = owner/admin 멤버십 / 전역 write = service_role(슈퍼어드민 서버액션)

-- 템플릿 (논점 A에서 v1 포함 확정 시)
create table consult_templates (
  id uuid pk,
  institution_id uuid null,                   -- null = 전역 제공 템플릿
  title text not null, category text,
  body_html text,                             -- 문구 골격(이미지 자리 포함 렌더된 HTML)
  active boolean default true, display_order int, created_by text, created_at
);
```

- **스토리지**: 신규 `consult-assets` 버킷 — `global/` + `<institution_id>/` 폴더. 업로드 시 기존 webp 압축·리사이즈 파이프라인 재사용(이그레스 절감 spec 017 준수). 표시엔 optimize+lazy 기존 경로.
- 템플릿을 별도 테이블 대신 **body_html 하나**로 두는 이유: 에디터로 템플릿을 "그냥 문서처럼" 작성하게 하면 관리 UI가 에디터 재사용으로 끝남(이미지 자리·문구·순서 자유). asset_ids 배열 조인보다 단순.

## 5. 관리 화면

- **기관**: `/settings` 안 "상담 자료" 섹션(체어·멤버 관리와 같은 패턴) — 업로드(제목·카테고리·캡션), 목록(활성 토글·순서·삭제). owner/admin.
- **전역**: `/admin/assets`(슈퍼어드민) — 같은 UI + 전역 발행. *(공지 발행과 같은 구도)*
- 템플릿 관리: 같은 화면의 "템플릿" 탭 — 에디터로 작성·수정.

## 6. 범위 논점 (대표 결정 필요)

| # | 논점 | 옵션 | 다온 의견 |
|---|---|---|---|
| A | v1 범위 | ① 라이브러리(이미지 단건 픽커 삽입)만 ② 템플릿(이미지+문구 묶음)까지 | **②까지.** "상담 템플릿"이 요청의 본질이고, body_html 방식이면 증분 비용이 작음 |
| B | 프레젠테이션 뷰어(환자에게 크게 보여주기) | v1 포함 / 후속 | **후속 권장.** 삽입 워크플로 먼저 검증. 다만 픽커에서 이미지 확대 미리보기는 v1에 포함(사실상 절반 커버) |
| C | 전역(Carelog 제공) 초기 콘텐츠 | 대표님이 준비한 이미지를 슈퍼어드민으로 등록 | **저작권 주의**: 외부 이미지 소싱 시 라이선스 확인 필수. 초기엔 예미안 자산을 전역 승격하는 방법도 |
| D | 카테고리 초안 | 임플란트 · 신경치료 · 보철 · 교정 · 치주 · 예방 · 장치 · 기타 | lib config 확장형(공지 레벨과 같은 방식) — 언제든 한 줄 추가 |
| E | 환자 포털 노출 | 삽입 이미지는 현행대로 포털에 보임 | 유지 권장(설명자료는 환자에게 보여서 좋은 콘텐츠). 단 "원내 전용" 자산 플래그는 후속 |

## 7. 구현 스케치 (확정 후)

- 마이그레이션: `consult_assets`(+`consult_templates`) + RLS + `consult-assets` 버킷(공개 read).
- `lib/consult-assets.ts` — 타입·카테고리 config.
- `app/actions/consult-assets.ts` — 목록(전역+기관 병합)·업로드·수정·삭제(기관=멤버십 가드, 전역=isSuperAdmin).
- `components/consult-assets/asset-picker.tsx` — 에디터 툴바 버튼+픽커. `rich-text-editor.tsx`에 삽입 훅.
- 관리: `/settings` 섹션 + `/admin/assets`.
- 문서: database.md·architecture.md·업데이트 피드.

## 8. 비범위 (후속 후보)

- 프레젠테이션 모드(전체화면 뷰어, 환자용 태블릿 흐름) — 논점 B 후속 시.
- 자산 사용 통계(어떤 자료가 상담에 많이 쓰이나 → 전역 콘텐츠 큐레이션 근거).
- "원내 전용"(포털 비노출) 플래그, 동영상 자산.
