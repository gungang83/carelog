# Phase 0 Research: 상담보드 (Consultation Board)

스펙의 미해결 결정들을 코드 실태 위에서 확정한다. 모든 NEEDS CLARIFICATION 해소.

## R1. record-first 디커플링 — 체어 없이 녹음 시작

**Decision**: `chair-provider`에 **단일 draft 세션 슬롯**을 도입한다. 녹음 상태(`recording`)와 MediaRecorder refs(`mediaRefsMap`)를 키잉하는 식별자에 예약 키 `__draft__`(sentinel)를 허용해, 체어가 없을 때 이 키로 녹음을 시작/중지한다. 저장 시 사용자가 고른 실제 `chairId`로 `saveChairRecord`를 호출하고, draft 슬롯을 reset한다.

**Rationale**:
- 현재 `recording: Record<chairId, ChairRecordingState>`와 `mediaRefsMap: Record<chairId, MediaRefs>` 구조를 그대로 두고 키 하나만 더 받으면 되어 변경이 국소적(헌법 IV).
- `saveChairRecord({chairId, content, participants, prescriptions})`가 이미 체어를 인자로 받으므로 **서버·스키마 변경 0**. draft는 순수 클라이언트 임시 상태.
- 스펙 가정("체어는 저장 시 필수", 단일 진행 세션)과 일치.

**Alternatives considered**:
- 세션 전면 sessionId화(녹음을 uuid 세션으로 일반화): 더 일반적이나 provider 전반 리팩터 + 다중 세션 동시성 고려가 필요 → 투기적 일반화(헌법 IV 위배). 단일 draft로 충분.
- 임시 체어 row 생성 후 저장 시 이동: DB 쓰기·정리 부담, draft 유실 시 dangling row. 기각.

**Edge**: 녹음 중 사용자가 체어를 고르면 draft 슬롯은 그대로 두고 "선택된 체어"는 보드 로컬 상태로만 들고 있다가 저장 때 적용(녹음 키를 바꾸지 않음 → 녹음 끊김 0, SC-005).

## R2. 녹음 백그라운드 지속 (보드 닫아도 유지)

**Decision**: 기존 동작 재사용. MediaRecorder·chunks는 `chair-provider`의 `useRef`(`mediaRefsMap`)에 보관되어 오버레이/보드 언마운트와 무관하게 살아있다. Wake Lock도 기존 로직 유지(녹음 중 화면 꺼짐 방지).

**Rationale**: 이미 "오버레이를 닫아도 녹음은 계속됩니다" 구조가 존재(FR-003 토대). draft 슬롯도 동일 메커니즘에 얹는다.

## R3. 전사 결과 본문 합류 시점

**Decision**: 기존대로 **녹음 중지 시** 전사(`transcribeChairAudio`) → 본문에 합친다. 보드의 본문 에디터에 전사 텍스트를 채워 편집 가능 상태로 둔다. 실시간 받아쓰기는 범위 밖.

**Rationale**: 기존 파이프라인 재사용, 스펙 가정과 일치. 실시간 STT는 비용·복잡도 큼 → MVP 제외.

## R4. 본문 편집 — textarea → RichTextEditor + 그림 주석

**Decision**: 보드 본문은 `RichTextEditor`(Tiptap, 인라인 이미지 + `ImageAnnotator` 그림 주석)를 사용한다. 현재 오버레이는 평문 `textarea`라 그림이 불가했는데, 보드에서는 미연결 기록 인라인 편집에 이미 쓰이는 `RichTextEditor`로 통일한다.

**Rationale**: "에디터에서 그림을 그려가며 상담"(US3) 요구 직결. 자산이 이미 존재(unlinked-records-section에서 사용 중) → 재사용(헌법 IV). 저장 시 기존 `ensureHtml`/`sanitizeRichHtml` 정규화 경로와 호환.

**Note(P1 범위)**: P1만 먼저 낼 경우 본문은 최소 textarea로도 가능하나, 그림은 P3에서 RichTextEditor로 들어온다. tasks에서 P1/P3 경계를 명확히 한다.

## R5. 참여자 '나' 자동 포함 — 현재 사용자 식별

**Decision**: 로그인 사용자의 표시명을 **`getMyAuthorInfo()`의 `author_name`**(또는 institution_members display_name)에서 얻어, 보드 진입 시 참여자에 기본 포함한다. 서버 컴포넌트(대시보드 layout/page)에서 현재 사용자 표시명을 구해 `ChairProvider`/보드에 prop으로 전달(클라이언트에서 인증 재호출 불필요).

**Participant 형태 매핑**: `Participant = {id, name, role}`. '나'는 `clinic_members`에 동명 항목이 있으면 그 `{id, role}`을 쓰고, 없으면 `{id: 현재 user.id, name: author_name, role: null}`로 채운다(스냅샷 보존이라 무방).

**Rationale**: 작성자 귀속 정보가 이미 존재. clinic_members와 1:1 매핑이 불확실해도 스냅샷(name) 기준이라 안전. 추가 조인·매핑 테이블 불요(헌법 IV).

**Alternatives**: clinic_members에 "현재 사용자" 플래그/매핑 추가 → 데이터모델 확장 필요, 과함. 기각.

## R6. 최근 함께한 참여자 — `getRecentParticipants`

**Decision**: 신규 **읽기 전용** Server Action `getRecentParticipants(limit=8)`. 해당 기관의 최근 `consultation`(예: 최근 50건, `created_at desc`)의 `participants` jsonb를 펼쳐 **distinct(name 기준)** 후 최근 등장순으로 상위 N명을 반환한다.

**Rationale**: 기존 데이터(participants 스냅샷)만으로 "최근 함께 기록한 사람"을 도출 → 스키마 변경 0. 소규모(수십 건)라 메모리 집계로 충분(헌법 IV, 성능 문제 없음).

**Contract**: 입력 없음(또는 limit). 출력 `Participant[]`(최근순). 실패 시 `[]`(읽기 액션은 비차단, 보드는 전체 목록으로 폴백).

## R7. 참여자 역할 필터 (비진료·테스트 후순위화)

**Decision**: **숨김이 아니라 정렬 후순위 + 기본 접힘**. 검색으로는 누구나 도달 가능하게 두되, 기본 노출 순서를:
1) '나'(자동) → 2) 최근 함께한 사람 → 3) 진료/현장 역할(치과위생사·페이닥터·진료스텝·팀원·팀장·실장 등) → 4) 비진료·미분류·테스트성(대표/owner, role=null, 명백한 노이즈) 후순위.

판정은 **소프트 휴리스틱**(역할 문자열 기반 제외 셋: 예 `대표`, owner)으로 시작하고, 정확 매핑은 실데이터 확인 후 조정. 하드 삭제·DB 변경 없음.

**Rationale**: 데이터가 EO 동기화로 노이즈를 포함(대표·한량·테스트). 숨기면 필요한 사람을 못 찾는 위험 → 후순위+검색이 안전. 휴리스틱이라 오분류해도 검색으로 복구 가능(헌법 IV·III).

**Alternatives**: clinic_members에 "상담참여 후보" 플래그 컬럼 추가 → 정확하나 스키마 변경 + 운영 부담. MVP 후 필요 시 별도 검토.

## R8. 녹음 일시정지/재개 (선택)

**Decision**: P3 선택사항. MediaRecorder.pause()/resume()은 Chromium 지원. MVP(P1)는 시작/중지만. 보드 녹음바에 일시정지 버튼은 P3에서 얹는다.

**Rationale**: 핵심 가치(record-first·과부하 해소)와 무관. 과적재 방지.

## R9. 단계 경계 (MVP vs 확장)

**Decision**:
- **P1(MVP)**: draft 세션 디커플링 + 1탭 즉시 녹음 + 저장 시 체어 귀속 + 최소 본문 편집. → 기록 유실 0.
- **P2**: `participant-picker`(검색·나 자동·최근·후순위) — 보드와 기존 히어로 양쪽 적용.
- **P3**: `consultation-board` 풀 캔버스(RichTextEditor+그림 주석+처방+체어를 한 화면 동시 편집, 일시정지).

**Rationale**: 각 단계 독립 배포 가능(스펙 US 우선순위와 일치). 파일럿 피드백으로 P2/P3 우선순위 조정 여지.

---

**모든 NEEDS CLARIFICATION 해소됨.** 미해결 없음 → Phase 1 진행.
