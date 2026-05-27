# Carelog

치과 클리닉 전용 환자 상담 기록 관리 앱.
환자 등록·검색, 상담 내용 기록, 이미지 첨부, 체어(station) 관리를 지원합니다.

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프레임워크 | Next.js 16.2.2 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| 데이터베이스 | Supabase (PostgreSQL) |
| 언어 | TypeScript (strict) |
| 배포 | Vercel |

## 주요 기능

- **환자 관리** — 등록, 수정, 통합 검색 (이름 / 전화번호 / 차트번호 / 주민번호 앞자리)
- **상담 기록** — 리치 텍스트 에디터, 이미지 첨부 + 캔버스 주석, 처방 메모
- **체어 즉시 기록** — 환자 선택 없이 즉시 녹음·저장, AI 전사(Whisper), 나중에 환자 연결; 연결 후 재연결·해지 지원
- **직원 초대 / 다중 테넌트** — 기관별 완전 격리, 역할(owner / admin / staff) 기반 권한
- **환자 포털** — SMS 초대 → 주민번호+전화번호 인증(OTP) → 상담 내역 자기 열람; Google OAuth 연동 가능
- **Web Push 알림** — 직원용: 새 환자 푸시 알림 구독; 환자용: 새 진료 기록 수신 동의
- **주민번호 처리** — 입력·저장·마스킹(880101-1\*\*\*\*\*\*) 및 SHA-256 해시 기반 중복 방지

## 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정 (.env.local)
cp .env.example .env.local   # 파일이 없으면 직접 생성 (docs/development.md 참고)

# 3. 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 문서

| 문서 | 내용 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | 시스템 구조, 디렉터리 레이아웃, 데이터 흐름 |
| [docs/database.md](docs/database.md) | DB 스키마, 테이블 정의, RLS 정책 |
| [docs/development.md](docs/development.md) | 로컬 개발 환경, 환경변수, 배포 |
| [docs/design.md](docs/design.md) | 디자인 시스템 (컬러·타이포·컴포넌트 패턴) |
| [project_status.md](project_status.md) | 현재 진행 상황, 알려진 이슈, 다음 목표 |
| [.specify/memory/constitution.md](.specify/memory/constitution.md) | 프로젝트 개발 원칙 (Constitution) |

## 프로젝트 구조

```
carelog/
├── app/
│   ├── (auth)/           # 공개 라우트 그룹 (로그인 불필요)
│   │   ├── login/        # 직원 로그인 (이메일+비밀번호, Google OAuth)
│   │   ├── signup/       # 직원 회원가입 + 기관 생성
│   │   ├── onboarding/   # Google OAuth 신규 가입 시 기관명 입력
│   │   └── invite/[token]/  # 직원 초대 수락
│   ├── (dashboard)/      # 인증 필요 라우트 그룹 (직원 전용)
│   │   ├── page.tsx      # 홈: 환자 검색 + 빠른 기록 + 미연결 기록 목록
│   │   ├── patients/[patientId]/  # 환자 상세 + 상담 이력 (환자 동석 화면)
│   │   └── view/[consultationId]/  # 상담 기록 상세
│   ├── (patient)/        # 환자 포털 라우트 그룹
│   │   ├── p/[token]/    # SMS 초대 링크 → 주민번호+전화번호 입력
│   │   └── portal/       # OTP 인증, 상담 내역 조회
│   ├── actions/          # Server Actions (DB 접근 레이어)
│   │   ├── auth.ts       # 직원 인증
│   │   ├── chairs.ts     # 체어 CRUD, 즉시 기록, 환자 연결/해지/재연결, 감사 로그
│   │   ├── consultations.ts  # 상담 기록 CRUD
│   │   ├── patients.ts   # 환자 CRUD, 검색
│   │   ├── push.ts       # 직원 Web Push 구독·발송
│   │   └── patient-portal.ts  # 환자 포털 전용 (초대·OTP·Google 가입)
│   └── auth/             # OAuth 콜백 라우트 핸들러
├── components/
│   ├── chair/            # 체어 즉시 기록 UI 컴포넌트
│   ├── auth/             # 직원 인증 폼
│   ├── patient/          # 환자 포털 컴포넌트
│   ├── layout/           # 헤더, 세션 관리
│   └── ui/               # 공통 UI 컴포넌트
├── lib/
│   ├── supabase/         # Supabase 클라이언트 (client / server / admin)
│   ├── types/            # TypeScript 타입 정의
│   ├── sms/              # Solapi SMS 발송
│   ├── auth/             # institution 조회 헬퍼 (React.cache)
│   ├── rrn-core.ts       # 주민번호 파싱·정규화
│   └── rrn-hash.ts       # 주민번호 SHA-256 해시 (중복 방지)
├── public/
│   └── sw.js             # Service Worker (Web Push 수신)
├── supabase/
│   ├── migrations/       # SQL 마이그레이션 파일
│   └── schema.sql        # 전체 DB 스키마 (참조용)
├── docs/                 # 설계 문서
├── specs/                # Spec-Driven Development 스펙 파일
└── proxy.ts              # Next.js 16 미들웨어 (세션 갱신 + 미인증 리다이렉트)
```

## 개발 워크플로

모든 비자명한 기능은 **Spec-Driven Development** 원칙을 따릅니다:

```
/speckit-specify  →  /speckit-plan  →  /speckit-tasks  →  /speckit-implement
```

자세한 내용은 [.specify/memory/constitution.md](.specify/memory/constitution.md) 참고.
