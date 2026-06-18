# Contract: 상담보드 UI · getRecentParticipants

웹앱이므로 외부 API가 아니라 **(a) 보드 UI 상호작용 계약**과 **(b) 신규 읽기 액션 계약**을 정의한다.

## A. 보드 UI 계약 (consultation-board.tsx)

### 진입
- 홈 히어로 "바로 녹음"(원탭) 또는 "상담 기록 시작" → **draft 세션 녹음 시작 + 보드 오픈**.
- 진입 시 참여자에 '나'(로그인 사용자) 자동 포함.

### 녹음 바 (상단, 항상)
- `idle`: [● 녹음 시작] (1탭). 클릭 제스처 안에서 `startRecording("__draft__")` 호출(getUserMedia 사용자 제스처 보존).
- `recording`: 타이머 + [⏹ 중지] (P3: [⏸ 일시정지]).
- `processing`: "음성 인식 중…".
- 보드를 닫아도 녹음 지속(provider ref). 재진입 시 상태·경과 유지.

### 본문 영역
- `has_records`: 전사 결과가 채워진 편집 가능 본문.
  - P1: 최소 편집(textarea 허용).
  - P3: `RichTextEditor`(인라인 이미지 + `ImageAnnotator` 그림 주석). 녹음 중에도 입력 가능(녹음 끊김 0).

### 메타 영역 (녹음 중/후 병행)
- 체어: 한 줄 칩 선택(미선택 허용). 저장 시 필수.
- 참여자: `participant-picker`(검색·나 자동·최근·후순위).
- 처방: `PrescriptionPicker`(P3).

### 저장
- [저장] → `selectedChairId` 있으면 `saveChairRecord({chairId, content, participants, prescriptions})`.
  - 없으면 빠른 체어 선택 유도(차단 아님).
- 성공: "저장됨 ✓" + draft reset + 미연결 수 갱신 + (이어서) 환자 연결 가능.
- 실패: 한국어 메시지 표시(헌법 III).

### 불변/회귀 금지
- 기존 per-chair 오버레이 동작(특정 체어 칩에서 진입) 회귀 없음.
- 실시간 알림은 기존 `chair_audit_logs` 경로 그대로(보드 저장도 `record_created` INSERT).

## B. getRecentParticipants (신규 읽기 Server Action)

```
getRecentParticipants(limit?: number = 8): Promise<Participant[]>
```

- **입력**: `limit`(선택, 기본 8).
- **동작**: 현재 기관의 최근 consultation(최근 ~50건) `participants`를 펼쳐 `name` 기준 distinct, 최근 등장순 상위 `limit`명.
- **출력**: `Participant[]`(`{id, name, role}`), 최근순.
- **권한**: 기관 격리(RLS + `getMyInstitutionId`). 읽기 전용, 부수효과 없음.
- **실패**: `[]` 반환(비차단). 보드는 전체 `clinic_members`로 폴백.
- **PII**: 이름·역할만. resident_no 등 무관.

## C. participant-picker 계약 (participant-picker.tsx)

```
props: {
  members: ClinicMemberRow[];        // 전체 후보
  recent: Participant[];             // getRecentParticipants 결과
  me: Participant | null;            // '나' 자동 포함 대상
  value: Participant[];              // 선택됨
  onChange: (next: Participant[]) => void;
}
```

- 렌더 순서: 선택됨 → 검색창 → ['나' 기본] → [최근] → [진료/현장 역할] → [기타·후순위].
- 검색: 이름 부분일치로 전체 후보 즉시 필터(후순위 항목도 검색되면 노출).
- 마스킹: 표시에 `maskName` 적용(기존).
- 비선택 허용(빈 배열 유효).
