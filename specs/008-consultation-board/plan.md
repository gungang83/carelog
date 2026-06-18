# Implementation Plan: 상담보드 (Consultation Board) — record-first 통합 상담 기록

**Branch**: `claude/amazing-fermi-bk359u` (spec dir `008-consultation-board`) | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/008-consultation-board/spec.md`

## Summary

체어 즉시기록의 진입을 **"선택 게이트 → 녹음"에서 "녹음 → 채워넣기"로 역전**한다. 사용자는 체어·참여자 선택 없이 1탭으로 녹음을 시작하고, 녹음이 백그라운드로 도는 동안(또는 끝난 뒤) 같은 **보드 화면**에서 본문·그림·체어·참여자·처방을 채운 뒤 한 번에 저장한다.

**기술 접근(핵심 결정)**: 현재 녹음 상태·MediaRecorder가 `chairId`로 키잉되어 "체어를 먼저 골라야 녹음"하는 구조다. 이를 **단일 draft 세션 슬롯**(`__draft__` sentinel 키)으로 분리해, 체어 없이 녹음을 시작하고 **저장 시점에 선택한 체어로 귀속**한다. 기존 `saveChairRecord({chairId, content, participants, prescriptions})`가 이미 이 형태이므로 **DB 스키마·서버 액션 시그니처 변경이 없다(MVP)**. 보드 UI는 기존 자산(RichTextEditor·ImageAnnotator·PrescriptionPicker·chair-provider 백그라운드 녹음)을 재사용해 한 화면으로 합친다. 참여자 과부하는 **검색 + '나' 자동포함 + 최근순 + 역할 후순위화**로 푼다(최근 참여자만 신규 read 액션 1개).

## Technical Context

**Language/Version**: TypeScript strict · Next.js 16.2.2 App Router(RSC 기본) · React 19
**Primary Dependencies**: 기존 재사용 — `chair-provider`(useReducer Context, 브라우저 MediaRecorder 백그라운드 녹음), `RichTextEditor`(Tiptap, 인라인 이미지·`ImageAnnotator` 그림 주석), `PrescriptionPicker`, `transcribeChairAudio`(Whisper+요약), `clinic_members` 디렉터리, `getMyAuthorInfo`(작성자 귀속). 신규 라이브러리 없음.
**Storage**: Supabase — `consultation`(체어 기록=patient_id null + chair_id, `participants` jsonb, `prescriptions`), `chairs`, `clinic_members`, `chair_audit_logs`. **MVP 신규 마이그레이션 없음**(기존 컬럼으로 충분).
**Testing**: `npm run build` 그린 + Vercel 프로덕션 수동 검증(quickstart 시나리오). 별도 테스트 하네스 없음.
**Target Platform**: Web PWA — PC/안드로이드 Chromium 우선. iOS 백그라운드 녹음 신뢰성은 별건(파킹).
**Project Type**: Web application(Next.js 풀스택, Server Actions + RSC)
**Performance Goals**: 녹음 시작 1탭/마음먹은 뒤 5초 이내(SC-001·002), 녹음 중 본문·그림 입력해도 녹음 끊김 0(SC-005)
**Constraints**: 녹음=브라우저 MediaRecorder(백그라운드 지속, 보드 닫아도 유지) · 모든 mutation은 Server Action · 실시간 알림 전송선에 PII/진료본문 0(기존 `chair_audit_logs` 유지) · Vercel 서버리스 호환
**Scale/Scope**: 단일 의원, 멤버 수십 명. 신규 컴포넌트 1~2(보드 + 참여자 피커 개선) + provider 확장(draft 세션) + read 액션 1(최근 참여자). DB 변경 0(MVP).

## Constitution Check

*GATE: Phase 0 전 통과 필수. Phase 1 후 재확인.*

- [x] **I. Patient Privacy First** — 보드는 진료 본문을 다루나 `resident_no`는 무관. 실시간 알림은 기존 `chair_audit_logs`(체어·작성자만, PII 0) 구독 유지(FR-012). 참여자 이름은 UI에서 `maskName` 적용(기존). 신규 PII 필드·로그 없음.
- [x] **II. Server-Side Data Authority** — 저장은 기존 `saveChairRecord`/`updateChairRecordContent`(Server Action). 신규 `getRecentParticipants`는 **읽기** 액션. 녹음/그림은 클라이언트 캡처(표시·수집)이며 영속화는 액션 경유. 목록 갱신은 `revalidatePath`/`router.refresh`. RLS 기존 정책.
- [x] **III. Clinical Reliability** — 기존 액션의 `{ok,message}` 유지. 신규 read 액션도 명시 결과. 미저장 draft 보존(FR-016)으로 실수 유실 방지. **MVP 스키마 변경 없음 → 마이그레이션 불요**.
- [x] **IV. Simplicity Over Abstraction** — 신규 추상화는 "draft 세션 슬롯" 1개로 한정(단일 진행 세션, 투기적 다중 세션 프레임워크 없음). 보드는 기존 컴포넌트 조합. 참여자 정렬·필터는 보드 안 인라인 로직.
- [x] **V. Spec-Driven Development** — `specs/008-consultation-board/spec.md` 존재·검증 통과(NEEDS CLARIFICATION 0).
- [x] **VI. Documentation as Living Artifact** — 갱신 대상: `project_status.md`, `docs/architecture.md`(보드·draft 세션 데이터흐름). DB 변경 없으므로 `database.md`·`schema.sql`은 해당 없음(P3에서 변경 발생 시 동반). 마무리 프로토콜 준수 예정.

## Project Structure

### Documentation (this feature)

```text
specs/008-consultation-board/
├── plan.md              # 이 파일
├── research.md          # Phase 0 — 기술 결정
├── data-model.md        # Phase 1 — 엔티티/세션 모델
├── quickstart.md        # Phase 1 — 검증 절차(수용 시나리오 매핑)
├── contracts/
│   └── consultation-board.md   # 보드 UI 계약 + getRecentParticipants 읽기 계약
├── checklists/
│   └── requirements.md  # (specify 단계 산출)
└── tasks.md             # (/speckit-tasks 단계 — 이 명령에서 생성 안 함)
```

### Source Code (repository root)

```text
app/
└── actions/
    └── chairs.ts                 # [재사용] saveChairRecord/updateChairRecordContent — 시그니처 불변
        └── getRecentParticipants()   # [신규·읽기] 최근 상담 participants에서 distinct 후보(최근순)
components/
└── chair/
    ├── chair-provider.tsx        # [수정] draft 세션 슬롯(__draft__) — chairId 없이 녹음 시작/중지,
    │                             #         저장 시 선택 체어로 귀속. 기존 per-chair 동작 회귀 없음
    ├── consultation-board.tsx    # [신규] 풀 보드(녹음바 + RichTextEditor/ImageAnnotator
    │                             #         + 체어 선택 + ParticipantPicker + PrescriptionPicker + 저장)
    ├── participant-picker.tsx    # [신규] 검색 + '나' 자동포함 + 최근순 + 역할 후순위(보드·히어로 공용)
    ├── chair-overlay.tsx         # [수정] 보드로 승격(P3) 또는 record-first 진입 경유(P1)
    └── consult-hero.tsx          # [수정] "바로 녹음" → draft 세션으로 녹음 시작 + 보드 오픈
lib/
└── types/database.ts             # [재사용] Participant·ConsultationRow — 변경 없음(MVP)
```

**Structure Decision**: 기존 Next.js 앱 확장. 핵심은 `chair-provider`에 **draft 세션 슬롯**을 더해 녹음을 체어와 분리하고, `consultation-board`가 녹음·편집·메타·저장을 한 화면으로 묶는다. 참여자 개선은 재사용 가능한 `participant-picker`로 분리(보드·히어로 공용). MVP(P1·P2)는 DB 변경 없이 클라이언트 + 읽기 액션 1개로 완결되고, P3(풀 캔버스)는 같은 보드에 그림·처방 동시 편집을 얹는다.

## Complexity Tracking

> 헌법 위반 없음 — 비움.
