# 개발 환경 가이드

## 필수 도구

- Node.js 20+
- npm 10+
- Supabase 프로젝트 (무료 플랜 가능)

## 로컬 설정

### 1. 환경변수

프로젝트 루트에 `.env.local` 파일 생성:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# 테이블명 (기본값: patient / consultation / users)
# 실제 DB 테이블명이 다를 경우에만 설정
# NEXT_PUBLIC_SUPABASE_PATIENT_TABLE=patient
# NEXT_PUBLIC_SUPABASE_CONSULTATION_TABLE=consultation
# NEXT_PUBLIC_SUPABASE_USERS_TABLE=users

# 이미지 버킷명 (기본값: consultation-images)
# NEXT_PUBLIC_SUPABASE_CONSULTATION_BUCKET=consultation-images
```

Supabase URL과 anon key는 Supabase 대시보드 → Project Settings → API에서 확인.

### 2. DB 스키마 적용

Supabase 대시보드 → SQL Editor에서 `supabase/schema.sql` 전체 실행.
이미 테이블이 있다면 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 라인만 선택 실행.

### 3. 이미지 버킷 생성

`supabase/schema.sql` 하단 Storage 섹션을 실행하면 `consultation-images` 버킷이 생성됨.
또는 Supabase 대시보드 → Storage → New bucket → `consultation-images` (Public) 수동 생성.

### 4. 개발 서버 실행

```bash
npm install
npm run dev
```

## 주요 npm 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 실행 (localhost:3000) |
| `npm run build` | 프로덕션 빌드 (배포 전 반드시 확인) |
| `npm run lint` | ESLint 검사 |

## 배포 (Vercel)

GitHub `main` 브랜치 push 시 Vercel 자동 배포.

**Vercel 환경변수 설정 위치**: Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
`.env.local`의 모든 변수를 동일하게 등록해야 함.

## 코드 컨벤션

- **Server Actions**: `app/actions/` 폴더, 파일 최상단에 `"use server"` 선언
- **Client Components**: `"use client"` 선언, 데이터 mutation 없이 UI만 담당
- **타입**: `lib/types/database.ts`에서 DB Row 타입 정의 및 import
- **환경변수 접근**: 직접 `process.env` 대신 `lib/supabase/config.ts` 상수 사용
- **주민번호**: `lib/rrn-core.ts`와 `lib/rrn-hash.ts`를 통해서만 처리, 평문을 UI에 직접 출력 금지

## 트러블슈팅

### 빌드 에러: 모듈을 찾을 수 없음
```bash
npm install  # node_modules 재설치
```

### Supabase 연결 실패
- `.env.local` 파일 존재 여부 확인
- `NEXT_PUBLIC_SUPABASE_URL`이 `https://` 로 시작하는지 확인
- Supabase 프로젝트가 Paused 상태가 아닌지 확인 (무료 플랜은 비활성 시 일시정지)

### 이미지 업로드 실패
- Supabase Storage에 `consultation-images` 버킷이 있는지 확인
- 버킷 Public 설정 및 Storage 정책이 `schema.sql`대로 적용됐는지 확인
