# Carelog 프로젝트 상태

**최종 업데이트**: 2026-05-08  
**현재 버전**: main 브랜치 기준

---

## 구현 완료 기능

| 기능 | 상태 | 비고 |
|---|---|---|
| 환자 등록 | ✅ 완료 | 이름, 차트번호, 전화번호, 주민번호 |
| 환자 수정 | ✅ 완료 | 수정 모달, 주민번호 포함 |
| 통합 검색 | ✅ 완료 | 이름 / 전화번호 / 차트번호 / 주민번호 앞자리 |
| 상담 기록 작성 | ✅ 완료 | 텍스트, 이미지, 처방 메모 |
| 상담 이력 조회 | ✅ 완료 | 환자 상세 페이지 |
| 체어 번호 관리 | ✅ 완료 | 로컬스토리지 기반, 상담 기록에 자동 저장 |
| 주민번호 마스킹 | ✅ 완료 | 목록/상세 화면 880101-1****** 형식 |
| 주민번호 해시 | ✅ 완료 | SHA-256, unique index로 중복 방지 |
| Vercel 배포 | ✅ 완료 | GitHub main 연동 자동 배포 |

---

## 2026-05-08 세션 작업 내용

| 작업 | 결과 |
|---|---|
| spec-kit 설치 | `.claude/commands/`, `.claude/skills/` 구성 완료 |
| Constitution v1.1.0 | 6개 원칙 확정 (Privacy, Server-Side, Reliability, Simplicity, Spec-Driven, Docs) |
| 문서 체계 구축 | README.md, docs/architecture.md, docs/database.md, docs/development.md 신규 작성 |
| 마무리 프로토콜 | CLAUDE.md에 wrap-up 5단계 체크리스트 추가 |
| 환자 포털 비전 | docs/patient-portal-vision.md — Phase 1~4 로드맵, 콘텐츠 블록 모델, 검증 시스템 |
| spec 001 작성 | specs/001-staff-auth-institution/spec.md — 직원 로그인 + 기관 계정 |
| plan 001 작성 | research.md, data-model.md, contracts/, quickstart.md, plan.md 전체 완성 |

---

## 알려진 이슈

| 이슈 | 심각도 | 상태 |
|---|---|---|
| 운영 RLS 정책 미적용 | 높음 | ⏳ spec 001 Phase 1 구현 시 해결 예정 |
| 환자 ID bigint vs uuid 불일치 | 중간 | 미해결 — 마이그레이션 전 확인 필요 |
| `.env.example` 파일 없음 | 낮음 | docs/development.md 참고로 대체 중 |

---

## 다음 개발 목표

### 즉시 다음 세션: Phase 1 구현

| 순서 | 작업 | 명령 |
|---|---|---|
| 1 | 태스크 목록 생성 | `/speckit-tasks` |
| 2 | DB 마이그레이션 실행 | Supabase SQL Editor (data-model.md 참고) |
| 3 | Phase 1 구현 | `/speckit-implement` |

**구현 상세 계획**: `specs/001-staff-auth-institution/plan.md` 참고

### 중장기 로드맵

| Phase | 내용 | 스펙 |
|---|---|---|
| Phase 1 | 직원 로그인 + 기관 계정 + RLS 전환 | ✅ 스펙/플랜 완료 |
| Phase 2 | 콘텐츠 블록 모델 + 오디오 + Audit log | 미착수 |
| Phase 3 | 환자 포털 (cross-institution 열람, 검증) | 미착수 |
| Phase 4 | AI 기능 (오디오 전사, 상담 요약) | 미착수 |

자세한 비전: `docs/patient-portal-vision.md`

---

## 기술 부채

- `supabase/schema.sql`의 `id` 타입이 uuid 예시인데 실제 운영 DB는 bigint — 마이그레이션 전 정합성 확인 필요
- 계정(users) 테이블이 존재하지만 Supabase Auth와 미연동 — Phase 1에서 해결 예정

---

## 개발 원칙

모든 기능 개발은 Spec-Driven Development:
`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`

Constitution: `.specify/memory/constitution.md` (v1.1.0)
