# Research: 환자 포털

**Date**: 2026-05-10  
**Feature**: specs/002-patient-portal

---

## Decision 1: SMS 발송 서비스

**Decision**: Solapi (솔라피, 구 CoolSMS) 채택

**Rationale**:
- 한국 기업 문자 발송 표준 서비스. 건당 과금(약 9원/건), 월정액 없음
- REST API 단순: `POST https://api.solapi.com/messages/v4/send`
- 010 발신번호 등록 절차 필요 (사업자 기준) — 개인 발신번호도 가능
- npm 공식 SDK: `@solapi/node-sdk`

**Alternatives considered**:
- Twilio: 국제 서비스, 한국 010 번호 직접 발송 불안정. Supabase Phone Auth 기본 연동이나 국내 환경 부적합
- 네이버 클라우드 SMS: 한국 특화이나 사업자 인증 절차 복잡, API 연동 레이어 두꺼움
- Supabase Phone OTP 네이티브: Twilio/Vonage만 지원, Solapi 미지원

---

## Decision 2: 환자 OTP 인증 구현 방식

**Decision**: 자체 OTP 테이블 + 세션 토큰 방식 (Supabase Auth Phone OTP 미사용)

**Rationale**:
- Supabase Auth Phone OTP는 Twilio/Vonage만 지원 → 한국 환경 부적합
- 환자 계정은 직원 계정(Supabase Auth)과 완전 분리 → 역할 혼선 없음
- 자체 구현 흐름: `patient_otps` 테이블 (6자리 코드, 5분 만료) → 검증 성공 시 `patient_sessions` 토큰 쿠키 발급
- 환자 포털은 읽기 전용이므로 Supabase Auth 수준의 보안이 불필요

**Alternatives considered**:
- Supabase Auth Phone OTP: Solapi 미지원으로 탈락
- Magic Link (이메일): 환자 이메일 수집 불필요하고 SMS 흐름 유지 위해 탈락
- Supabase Auth custom SMS hook: 가능하나 설정 복잡, 환자 계정 분리 불가

---

## Decision 3: 환자 세션 관리

**Decision**: `patient_sessions` 테이블 + HttpOnly 쿠키 (`patient_session_token`)

**Rationale**:
- Supabase Auth JWT를 사용하지 않으므로 자체 세션 토큰 필요
- UUID v4 기반 랜덤 토큰, 30일 만료, HttpOnly Secure 쿠키로 전달
- `proxy.ts` 미들웨어에서 `/patient/records` 등 보호 경로 접근 시 쿠키 검증
- Service Role Admin Client를 통해서만 세션 테이블 읽기/쓰기 (RLS 없이 Admin만 접근)

**Alternatives considered**:
- JWT (자체 서명): 서명 키 관리 부담, 테이블 기반 세션보다 복잡
- Supabase Auth Session: 환자 계정과 직원 계정이 동일 auth.users에 섞여 역할 관리 복잡

---

## Decision 4: PatientAccount ↔ patient 레코드 연결 전략

**Decision**: `patient_account_links` 중간 테이블로 M:N 연결

**Rationale**:
- 한 환자가 여러 치과에 다닐 수 있고, 각 치과마다 `patient` 레코드가 별도 존재
- `patient_account_links (patient_account_id, patient_id, institution_id)` 로 연결
- 가입 시 초대 토큰으로 `patient_id` 확인 → 링크 생성
- 재방문(기존 계정) 시 phone으로 `patient_account_id` 조회 → 이미 있는 링크는 skip, 새 링크 추가

**Alternatives considered**:
- `patient` 테이블에 `patient_account_id` 컬럼 직접 추가: 단일 치과 연결만 가능, 확장성 없음
- 환자가 직접 치과 코드 입력 후 연결: 마찰 높음, 자동화 불가

---

## Decision 5: SMS 초대 발송 시점

**Decision**: 환자 상세 페이지에 "상담 공유" 버튼 추가 → 모달에서 전화번호 확인 + 동의 체크 후 발송

**Rationale**:
- 상담 완료 후 자연스러운 흐름 (환자 상세 페이지에서 바로 발송)
- 전화번호가 이미 patient 테이블에 있으면 자동 채워짐 (수정 가능)
- 동의 체크가 없으면 발송 불가 (개인정보보호법 준수)

**Alternatives considered**:
- 상담 저장 시 자동 발송: 동의 확인 절차 불명확, 자동 발송 거부감
- 별도 메뉴에서 발송: 상담 흐름과 분리되어 사용성 낮음

---

## Decision 7: 환자 계정 영구 식별자

**Decision**: 주민번호 해시(`rrn_hash`) = `patient_accounts`의 영구 식별자. 전화번호는 식별자 아님.

**Rationale**:
- 전화번호는 언제든 바뀔 수 있어 다기관 통합 계정의 영구 키로 부적합
- 주민번호는 한국에서 평생 불변 → 기관 간 동일인 매칭 신뢰도 100%
- 기존 `patient.resident_no_hash` (SHA-256)와 동일 알고리즘 → 별도 해시 없이 크로스 매칭 즉시 가능
- 전화번호는 OTP 수신 수단으로만 사용. `patient_accounts`에 전화번호 저장 불필요.
- 가입 시 주민번호 입력 → 초대장의 환자 레코드 `resident_no_hash`와 대조 → 본인 확인 동시 처리

**Alternatives considered**:
- 전화번호 식별자: 번호 변경 시 계정 접근 불가. 다기관 매칭 신뢰도 낮음. 탈락.
- 이메일 식별자: 환자에게 이메일 수집 불필요. 모바일 환경에서 SMS보다 마찰 높음. 탈락.
- 전화번호 + 생년월일 복합키: 고유성 부족 (동명이인/동일 생년월일 가능). 탈락.

---

## Decision 6: 환자 포털 URL 구조

**Decision**: `/p/[token]` (초대 링크) + `/portal` (환자 포털 홈/로그인)

**Rationale**:
- `/p/[token]`: SMS에 들어가는 짧은 URL, 초대 토큰 포함
- `/portal`: 환자 포털 진입점 (로그인 + 상담 목록)
- 공개 경로 (`/p/*`, `/portal/login`, `/portal/verify`)와 보호 경로 (`/portal/records`) 분리
- `(patient)` route group으로 직원 포털과 완전 분리

**Alternatives considered**:
- `/patient/*`: 기존 `/patients/*` 경로와 혼동 가능
- 서브도메인: `patient.carelog-tau.vercel.app` — Vercel 무료 플랜에서 서브도메인 설정 복잡
