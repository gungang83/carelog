# 환자 포털 및 확장 아키텍처 비전

**작성일**: 2026-05-08  
**상태**: 기획 중 (구현 전)  
**연관 문서**: [docs/architecture.md](architecture.md), [docs/database.md](database.md)

---

## 1. 핵심 주체 재정의

```
Institution (의료기관)
  └── Members (직원/의사)          ← Supabase Auth 계정
  └── Stations (체어/위치)         ← 계정 아님, 메타데이터
  └── Patients (환자 레코드)
        └── Consultations (상담 기록)
              └── ContentBlocks (콘텐츠 블록들)

Patient (환자)                     ← Supabase Auth 계정 (별도)
  └── IdentityClaim (주민번호 인증) ← 기관 레코드와 연결 키
```

### 위치(Station)는 계정이 아니다

체어 번호(3번 체어 등)는 **상담 기록의 메타데이터**로 처리.
별도 로그인 불필요 — 직원이 자기 계정으로 로그인 후 "현재 위치: 3번 체어" 선택.
→ 현재 `station-storage.ts`의 로컬스토리지 방식을 **서버 기반 세션 설정**으로 업그레이드.

### 기록 주체(Source) 구분

| Source | 의미 | 검증 필요 여부 |
|---|---|---|
| `staff` | 직원 계정으로 클리닉 기기에서 작성 | 기본 신뢰 |
| `patient` | 환자 본인이 자기 기기에서 제출 | 기관 검증 필요 |
| `ai` | AI가 생성(녹음 전사, 요약 등) | 직원 검토 필요 |
| `joint` | 상담 중 환자와 직원이 함께 확인 | 검증 완료 |

---

## 2. 상담 기록 콘텐츠 모델

### 기존 문제

현재 `consultation` 테이블은 `content text`, `image_urls jsonb`로 단순 구조.
다양한 콘텐츠 타입을 수용하려면 **콘텐츠 블록(Content Block)** 모델로 전환 필요.

### 콘텐츠 블록 타입

| type | 설명 | 저장 방식 |
|---|---|---|
| `text` | 텍스트 상담 메모 | DB text 컬럼 |
| `audio` | 녹음 파일 원본 | Storage (consultation-audio 버킷) |
| `audio_transcript` | AI 전사 텍스트 | DB text + AI 메타데이터 |
| `audio_summary` | AI 요약 정리본 | DB text + structured jsonb |
| `image` | 일반 이미지/사진 | Storage (consultation-images 버킷) |
| `xray_snapshot` | 엑스레이 스냅샷 + 주석 | Storage + annotations jsonb |
| `consultation_board` | 사전 설정 템플릿 보드 | template_id + 마킹 데이터 jsonb |
| `document` | 처방전, 동의서 등 문서 | Storage (consultation-docs 버킷) |
| `prescription` | 처방 구조화 데이터 | jsonb (현재 prescriptions 컬럼 대체) |

### 제안 스키마

```sql
-- 상담 기록 (컨테이너)
consultation_records (
  id uuid PK,
  patient_id,
  institution_id,
  station_name text,          -- 체어 번호
  created_by uuid,            -- staff user_id 또는 patient user_id
  source text,                -- 'staff' | 'patient' | 'joint'
  verification_status text,   -- 'trusted' | 'pending' | 'verified' | 'rejected'
  verified_by uuid,           -- 검증한 직원 user_id
  verified_at timestamptz,
  created_at timestamptz
)

-- 콘텐츠 블록 (내용 단위)
consultation_content_blocks (
  id uuid PK,
  record_id uuid FK,
  type text,                  -- 위 타입 목록
  display_order int,          -- 화면 표시 순서
  source text,                -- 'staff' | 'patient' | 'ai'
  content text,               -- 텍스트 계열
  file_url text,              -- 파일 계열
  metadata jsonb,             -- 타입별 추가 데이터 (AI 결과, 주석, 템플릿 ID 등)
  ai_processed boolean,       -- AI 처리 여부
  ai_model text,              -- 사용된 AI 모델명 (추적용)
  created_at timestamptz
)
```

### AI 처리 파이프라인 여지

```
audio 블록 업로드
  → 비동기 트리거: AI 전사 작업 큐
  → Whisper(또는 동등) → audio_transcript 블록 자동 생성
  → (옵션) LLM 요약 → audio_summary 블록 자동 생성
  → 직원에게 "AI 초안 검토 필요" 알림
```

*구체적 AI 모델·API는 구현 단계에서 결정. 스키마는 `ai_model` 필드로 어떤 AI든 수용.*

---

## 3. 검증(Verification) 시스템

### 환자 제출 → 기관 검증 흐름

```
환자 앱에서 상담 내용 제출
  → verification_status: 'pending'
  → 의료기관 대시보드에 "검증 대기" 알림
  → 직원이 내용 확인 후:
      승인 → 'verified' (verified_by, verified_at 기록)
      거부 → 'rejected' (거부 사유 메모 가능)
  → 환자 앱에 결과 통보
```

### 검증 완료 후 효과

- 환자 앱: "의료기관 확인 완료" 뱃지 표시
- 양측 법적 분쟁 시 근거 자료로 활용 가능
- 기관 미검증 레코드는 "참고용" 표시로 구분

---

## 4. 감사 로그 (Audit Log)

의료 기록의 특성상 **누가, 언제, 어디서, 무엇을** 했는지 추적 필수.

```sql
consultation_audit_log (
  id uuid PK,
  record_id uuid,
  action text,              -- 'created' | 'edited' | 'verified' | 'rejected' | 'viewed'
  actor_id uuid,            -- 행위자 user_id
  actor_type text,          -- 'staff' | 'patient' | 'system' | 'ai'
  institution_id uuid,
  station_name text,        -- 체어 번호 (해당 시)
  device_hint text,         -- 'clinic_device' | 'staff_mobile' | 'patient_mobile'
  ip_address text,          -- 선택적
  metadata jsonb,           -- 변경 전/후 스냅샷 등
  created_at timestamptz
)
```

로그는 **삭제 불가** 정책 (INSERT only, RLS로 UPDATE/DELETE 차단).

---

## 5. 전체 데이터 모델 (목표 상태)

```
institutions
├── institution_members  (직원 소속, role 관리)
├── patients             (+ institution_id, + source, + verification fields)
│   └── consultation_records  (+ institution_id, + source, + verification)
│       ├── consultation_content_blocks  (다형성 콘텐츠)
│       └── consultation_audit_log
└── consultation_boards  (기관별 상담 템플릿)

auth.users (Supabase Auth)
├── → institution_members (직원)
└── → patient_identity_claims (환자 본인 인증)

storage buckets
├── consultation-images  (기존)
├── consultation-audio   (신규: 녹음)
└── consultation-docs    (신규: 문서/처방전)
```

---

## 6. 구현 로드맵 (단계별)

### Phase 1 — 인증 기반 도입 (직원 로그인)
- Supabase Auth 도입
- `institutions` 테이블 + `institution_members` 테이블
- RLS 정책 교체 (현재 전체 허용 → 기관 격리)
- 직원 계정으로 로그인 후 station 선택 흐름

### Phase 2 — 콘텐츠 모델 전환
- `consultation_content_blocks` 테이블 도입
- 기존 text/image 데이터 마이그레이션
- 오디오 업로드 지원
- Audit log 도입

### Phase 3 — 환자 포털
- 환자 Supabase Auth 계정
- 주민번호 인증 + `patient_identity_claims`
- 환자 전용 뷰 (cross-institution 상담 이력 열람)
- 환자 제출 + 기관 검증 워크플로우

### Phase 4 — AI 기능
- 오디오 → 텍스트 전사 파이프라인
- AI 상담 요약
- 상담 보드 템플릿 시스템
- 엑스레이 주석 도구

---

## 7. 미결 결정 사항 (구현 전 확정 필요)

| 항목 | 옵션 | 권장 |
|---|---|---|
| 환자 인증 방식 | 이메일 / 카카오 / 휴대폰 | 카카오 (장기), 이메일 (Phase 3 MVP) |
| 오디오 전사 AI | OpenAI Whisper / 클로바 / 자체 | 구현 시 결정 |
| 상담 보드 형식 | SVG 기반 / 이미지 마킹 / 전용 에디터 | 구현 시 결정 |
| 환자 앱 형태 | 웹 (반응형) / 별도 모바일 앱 | Phase 3: 웹 우선 |
| 기관 구독 과금 | 기관당 플랫 / 직원수 기반 / 기록수 기반 | 미결 |
