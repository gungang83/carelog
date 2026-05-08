# 시스템 아키텍처

## 개요

Carelog는 Next.js App Router 기반의 풀스택 웹 앱입니다.
클라이언트는 UI 렌더링만 담당하고, 모든 데이터 처리는 Server Actions를 통해 서버에서 수행됩니다.

```
브라우저 (Client Components)
    │  form submit / server action call
    ▼
Next.js Server Actions  ←→  Supabase (PostgreSQL)
    │
    ▼
Vercel Edge / Serverless 환경
```

## 디렉터리 구조

```
app/
├── actions/
│   ├── patients.ts       # 환자 CRUD, 검색
│   ├── consultations.ts  # 상담 기록 CRUD, 이미지 업로드
│   └── users.ts          # 계정 유형 조회
├── patients/
│   └── [patientId]/
│       └── page.tsx      # 환자 상세 + 상담 이력
├── view/
│   └── [consultationId]/
│       └── page.tsx      # 상담 기록 상세
├── globals.css
├── layout.tsx
└── page.tsx              # 홈 (검색 + 등록)

components/
├── patient-home.tsx      # 검색 UI + 새 환자 등록 버튼
├── patient-form.tsx      # 새 환자 등록 폼
├── patient-edit-form.tsx # 환자 정보 수정 모달
├── consultation-form.tsx # 상담 기록 작성 폼
├── consultation-history.tsx # 상담 이력 목록
├── station-manager.tsx   # 체어 번호 설정
└── ui/
    └── dropdown-menu.tsx # Radix UI 드롭다운 래퍼

lib/
├── supabase/
│   ├── client.ts         # 브라우저용 Supabase 클라이언트
│   ├── server.ts         # 서버용 Supabase 클라이언트
│   └── config.ts         # 테이블명·버킷명 환경변수 매핑
├── types/
│   └── database.ts       # PatientRow, ConsultationRow 타입
├── patient-search.ts     # ilike 쿼리 유틸 (escapeIlike, fragments)
├── rrn-core.ts           # 주민번호 파싱·정규화·검색 패턴
├── rrn-hash.ts           # 주민번호 SHA-256 해시 (중복 방지용)
├── station-storage.ts    # 로컬스토리지 체어 번호 관리
├── user-type.ts          # 계정 유형 enum
└── utils.ts              # 공통 유틸

supabase/
└── schema.sql            # 전체 스키마 (마이그레이션 기준 파일)
```

## 데이터 흐름

### 환자 검색
```
PatientHome (Client)
  → searchPatients(query) [Server Action]
    → Supabase .or([name, phone, chart_no, resident_no ilike])
    → 클라이언트 사이드 스코어 기반 재정렬
  → 결과 리스트 렌더
```

### 상담 기록 작성
```
ConsultationForm (Client)
  → 이미지 선택 → Supabase Storage 직접 업로드 (consultation-images 버킷)
  → createConsultation(formData) [Server Action]
    → image_urls, content, prescriptions, station_name 저장
    → revalidatePath('/patients/[id]')
```

### 주민번호 처리
```
입력 (앞 6자리 + 뒤 7자리)
  → mergeResidentNoParts() → rrn-core.ts
  → normalizeFullResidentNo() → "XXXXXX-XXXXXXX" 형식
  → hashResidentNoForMatching() → SHA-256 해시 (resident_no_hash 컬럼)
  → DB 저장: resident_no (원본), resident_no_hash (중복방지 unique index)
  → UI 표시: maskResidentNo() → "880101-1******"
```

## 핵심 설계 결정

| 결정 | 이유 |
|---|---|
| Server Actions만으로 DB 접근 | 클라이언트에 Supabase 자격증명 노출 방지, RLS + 서버 검증 이중화 |
| `resident_no_hash` 별도 컬럼 | 평문 주민번호로 unique index 불가(개인정보 보호), 해시로 중복 방지 |
| 테이블명 환경변수화 | 개발/운영 DB 분리 시 코드 변경 없이 테이블명 전환 가능 |
| `mapPatientRow()` 정규화 함수 | Supabase 응답 타입이 `unknown`이므로 안전한 타입 변환 단일화 |
