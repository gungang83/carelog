# Carelog 로드맵

> 소유: 기획 PM(다온). 우선순위·방향을 기록한다. (사실 기록은 `project_status.md`, 비전 SSOT는 `docs/product-vision.md`)

## 지금 (In Progress)

- **EO ↔ Carelog 연동 안정화** — 직원 마스터 게이트웨이 캐시 + SSO 작성자 귀속 라이브(2026-06-10). 잔여: SSO 작성자 귀속 **실사용 1회 확인**, (선택) `CRON_SECRET` 하드닝.

## 다음 (Next)

- **상담 데이터화 1단계 — 상담 결과/유형 + 상담 성공률** 〔성장 축〕
  - 방향: [`docs/consult-analytics-crm-vision.md`](docs/consult-analytics-crm-vision.md)
  - 첫 걸음: `consultation`에 결과(outcome)·유형·전환단계·금액 필드 + 저장 시 1~2클릭 입력 → 담당자/유형/기간별 **상담 성공률** 집계.
  - 후보 스펙: `specs/007-consult-outcomes`(가칭).

## 나중 (Later)

- **변호사(의료법) 자문 — 전자 동의서** 〔대표 액션〕: 스테이지 펜 서명의 법적 효력·설명의무 입증 요건·무결성(시각/식별/위변조) 검토. 자문 결과에 따라 동의서 (a)"서명 흔적 기록"(현행 확정, spec 026 §6.5) → (b)정식 전자동의 워크플로 승격 여부 결정.

- **경영관리 대시보드** — 직원별/체어별/상담유형별 성공률·전환율·매출 기여 가시화(원장·관리자용).
- **상담 CRM** — 환자별 상담 이력 기반 팔로업·리마인드·재상담 넛지, 보류·미동의 환자 리타게팅.
- **상담지표 → EO 피드** — 조직 차원 경영지표는 Carelog 상담 데이터를 EO로 정합 전달(중복 구축 금지).
- **의료기관 일반 도메인 확장** — "치과"는 현재 적용 도메인일 뿐(비전 SSOT §확장).

> 성장 축 전체 사다리(상담 기록 → 데이터·지표 → 경영관리·CRM): [`docs/consult-analytics-crm-vision.md`](docs/consult-analytics-crm-vision.md)
