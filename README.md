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
- **상담 기록** — 텍스트 + 이미지, 처방 메모, 작성 체어 자동 저장
- **주민번호 처리** — 입력·저장·마스킹(880101-1\*\*\*\*\*\*) 및 해시 기반 중복 방지
- **체어 관리** — 기기별 체어 번호 설정, 상담 기록에 자동 반영

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
| [project_status.md](project_status.md) | 현재 진행 상황, 알려진 이슈, 다음 목표 |
| [.specify/memory/constitution.md](.specify/memory/constitution.md) | 프로젝트 개발 원칙 (Constitution) |

## 프로젝트 구조

```
carelog/
├── app/
│   ├── actions/          # Server Actions (DB 접근 레이어)
│   ├── patients/         # 환자 상세 페이지
│   ├── view/             # 상담 기록 상세 페이지
│   ├── layout.tsx
│   └── page.tsx          # 메인 (검색 + 새 환자 등록)
├── components/           # React 컴포넌트
├── lib/
│   ├── supabase/         # Supabase 클라이언트, 설정
│   ├── types/            # TypeScript 타입 정의
│   ├── patient-search.ts # 검색 쿼리 유틸
│   ├── rrn-core.ts       # 주민번호 파싱·정규화
│   └── rrn-hash.ts       # 주민번호 해시 (중복 방지)
├── supabase/
│   └── schema.sql        # DB 스키마 (마이그레이션 기준)
├── specs/                # spec-kit 기능 스펙 (speckit-specify 산출물)
└── .specify/             # spec-kit 설정 및 템플릿
```

## 개발 워크플로

모든 비자명한 기능은 **Spec-Driven Development** 원칙을 따릅니다:

```
/speckit-specify  →  /speckit-plan  →  /speckit-tasks  →  /speckit-implement
```

자세한 내용은 [.specify/memory/constitution.md](.specify/memory/constitution.md) 참고.
