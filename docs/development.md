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

마이그레이션을 **순서대로** Supabase SQL Editor에서 실행:

| 파일 | 내용 |
|---|---|
| `supabase/migrations/20260509000001_staff_auth_institution.sql` | 기관·멤버·초대 테이블 + RLS |
| `supabase/migrations/20260510000001_patient_portal.sql` | 환자 포털 5개 테이블 |
| `supabase/migrations/20260517000001_push_subscriptions.sql` | 직원 Web Push 구독 |
| `supabase/migrations/20260517000002_patient_auth_links.sql` | 환자 Google OAuth 연결 + 환자 푸시 구독 |
| `supabase/migrations/20260526000001_chair_quick_record.sql` | 체어·감사 로그 테이블 + consultation 컬럼 추가 |

전체 신규 설치 시 `supabase/schema.sql`을 한 번에 실행해도 됩니다.

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

## 필수 환경변수 전체 목록

| 변수 | 필수 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | 브라우저 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service Role 키 (서버 전용, RLS 우회) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | 사이트 기준 URL (예: https://carelog-tau.vercel.app) |
| `OPENAI_API_KEY` | ✅ | 음성 전사(Whisper) + 요약(GPT) |
| `SOLAPI_API_KEY` | 선택 | SMS 발송 (환자 초대·OTP) |
| `SOLAPI_API_SECRET` | 선택 | Solapi 인증 |
| `SOLAPI_FROM_NUMBER` | 선택 | 발신 전화번호 |
| `VAPID_PUBLIC_KEY` | 선택 | Web Push 공개 키 |
| `VAPID_PRIVATE_KEY` | 선택 | Web Push 개인 키 |

## 코드 컨벤션

- **Server Actions**: `app/actions/` 폴더, 파일 최상단에 `"use server"` 선언
- **응답 형태**: `{ ok: true, ... }` / `{ ok: false, message: string }` 통일
- **Client Components**: `"use client"` 선언, 데이터 mutation은 Server Action으로만
- **타입**: `lib/types/database.ts`에서 DB Row 타입 정의 및 import
- **환경변수 접근**: 직접 `process.env` 대신 `lib/supabase/config.ts` 상수 사용
- **주민번호**: `lib/rrn-core.ts`와 `lib/rrn-hash.ts`를 통해서만 처리, 평문을 UI에 직접 출력 금지
- **오버레이 컴포넌트**: 헤더에 `backdrop-filter` 있으므로 모달은 반드시 `createPortal(content, document.body)` 사용
- **Route Segment Config** (`maxDuration` 등): `"use server"` 파일이 아닌 page/layout 파일에만 선언

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
