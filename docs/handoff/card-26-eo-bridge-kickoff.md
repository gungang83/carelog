# 카드 26 — EO 연동 새 다온 세션 킥오프

> 발신→수신: 다온(Carelog 세션) → 다온(EO연동 새 세션) · 2026-06-07
> 성격: 🟡 일반 · 아키텍처·연동 · 큰범위(spec-kit 전 조사)
> 환경: `../eo` `../iris` `../carelog` 3개 레포 클론됨 · 네트워크 전체

## 먼저 읽기 (경로)
- `../carelog/docs/eo-carelog-integration.md` — 카드25 제안·미결 6문항
- `../carelog/project_status.md` (세션14) — 현재 상태·보류 목록(UX #1 배포, #2~#8 후보)
- `../carelog/PLAYBOOK.md` §5 격리/SSOT · §4 협업
- `../eo/` — 암호화/보안 모듈 + 환자 피드백·연동 기획 탐색(grep)

## 지시 (목표)
1. **EO 보안 파악**: `../eo`의 암호화·RRN/민감정보 처리 방식 →
   Carelog 환자 단계적 가입(#7·#8)에 **재사용** 이식 계획 작성.
2. **EO 피드백 기획 탐색**: `../eo`에서 환자 피드백/NPS/직원평가 관련
   기존 기획·코드를 찾아 카드25 제안과 대조(중복/충돌/공백).
3. **브리지 계약 초안**: EO→CL(직원·클리닉 마스터), CL→EO(피드백·동의
   이벤트) 전송방식·인증·스키마 1차 정의.
4. **산출물**: `../carelog/docs/eo-carelog-integration.md` 갱신 +
   합의되면 `specs/007-eo-bridge-feedback` 초안.

## 가드레일
- 쓰기는 **carelog 브랜치 `claude/zen-cerf-hWuUw`** 만. `../eo` `../iris`는
  **읽기 전용(참조)**. EO 레포에 commit/push 금지.
- main 직접 배포는 "마무리" 때만. **비밀키는 코드/문서에 남기지 말 것.**

## 미결
- 카드25 6문항 — EO 실비 회신 오면 반영.
