# Implementation Plan: 환자 포털

**Branch**: `002-patient-portal` | **Date**: 2026-05-10 | **Spec**: [spec.md](spec.md)  
**Input**: specs/002-patient-portal/spec.md

---

## Summary

치과 직원이 상담 후 환자에게 SMS 초대를 발송하면, 환자는 링크를 통해 전화번호 OTP로 케어로그에 가입하고 모든 치과의 상담 내역을 통합 조회할 수 있다.

**기술 접근**:
- SMS: Solapi REST API (`@solapi/node-sdk`)
- 환자 인증: 자체 OTP 테이블 + 세션 토큰 쿠키 (Supabase Auth Phone OTP 미사용 — 한국 번호 지원 이슈)
- 환자 계정: 직원 계정(Supabase Auth)과 완전 분리된 자체 `patient_accounts` 테이블
- 다기관 연결: `patient_account_links` 중간 테이블

---

## Technical Context

**Language/Version**: TypeScript (strict) / Next.js 16.2.2 App Router  
**Primary Dependencies**: Supabase (@supabase/ssr), @solapi/node-sdk, Tailwind CSS v4  
**Storage**: Supabase PostgreSQL (5개 신규 테이블)  
**Target Platform**: Vercel (Serverless), 모바일 웹 우선  
**Project Type**: Web service (기존 Carelog에 기능 추가)  
**Performance Goals**: 가입 완료 5분 이내 (SC-001), SMS 발송 3초 이내  
**Constraints**: Vercel serverless (stateless), Service Role Admin Client 전용 테이블 접근  
**Scale/Scope**: 기관당 수십~수백 환자, OTP 동시 발송 일일 수십 건

---

## Constitution Check

- [x] **I. Patient Privacy First** — `consent_given` 필드 의무화. 동의 없이 SMS 발송 불가. 상담 내역 마스킹 정책 유지. 환자 포털에서 주민번호 미노출.
- [x] **II. Server-Side Data Authority** — 모든 OTP 발송/검증/세션 생성/상담 조회는 Server Actions. 환자 포털 클라이언트는 렌더링만.
- [x] **III. Clinical Reliability** — 모든 Server Actions `{ok, message}` 반환. 마이그레이션 파일 포함. SMS 발송 실패 시 초대 레코드 롤백.
- [x] **IV. Simplicity Over Abstraction** — `patient_session.ts` 유틸은 2곳 이상(미들웨어 + Server Action)에서 사용. Solapi 클라이언트는 1개 파일로 중앙화.
- [x] **V. Spec-Driven Development** — specs/002-patient-portal/spec.md 승인됨.
- [x] **VI. Documentation as Living Artifact** — architecture.md, database.md, schema.sql 마무리 시 업데이트 예정.

---

## Project Structure

### Documentation (this feature)

```text
specs/002-patient-portal/
├── spec.md           ✅ 완료
├── research.md       ✅ 완료
├── data-model.md     ✅ 완료
├── quickstart.md     ✅ 완료
├── contracts/
│   └── server-actions.md  ✅ 완료
├── checklists/
│   └── requirements.md    ✅ 완료
└── tasks.md          ⏳ /speckit-tasks 명령으로 생성
```

### Source Code

```text
app/
├── (patient)/                        # 환자 포털 라우트 그룹 (신규)
│   ├── layout.tsx                    # 환자 세션 검증
│   ├── p/[token]/page.tsx            # 초대 링크 진입 (공개)
│   └── portal/
│       ├── login/page.tsx            # 전화번호 입력 (공개)
│       ├── verify/page.tsx           # OTP 입력 (공개)
│       └── records/page.tsx          # 상담 내역 목록 (보호)
├── actions/
│   └── patient-portal.ts             # 환자 포털 Server Actions (신규)

components/
├── patient/                          # 환자 포털 전용 컴포넌트 (신규)
│   ├── send-invitation-button.tsx    # 직원용 "문자 발송" 버튼 + 모달
│   ├── patient-login-form.tsx        # 전화번호 입력 폼
│   ├── patient-otp-form.tsx          # OTP 입력 폼
│   └── patient-records-list.tsx      # 상담 내역 목록
└── [기존 환자 상세 페이지에 버튼 추가]

lib/
├── sms/
│   └── solapi.ts                     # Solapi SMS 발송 클라이언트 (신규)
├── patient-session.ts                # 환자 세션 토큰 검증 유틸 (신규)
└── types/database.ts                 # 신규 타입 추가

supabase/
└── migrations/
    └── 20260510000001_patient_portal.sql  # 신규 5개 테이블
```

---

## Phase 구분

### Phase 1 (MVP): US1 + US2 + US3
- 직원 SMS 발송 + 환자 가입 + 상담 내역 조회
- 독립 배포 가능, 실제 사용 가능한 최소 기능

### Phase 2: US4
- 재방문 로그인 (/portal/login)
- Phase 1과 코드 대부분 공유, 빠른 추가 가능
