# 000-backlog — 핸드오프 큐 / 협업 메모

> 멀티 에이전트 협업의 비동기 핸드오프 공간. (지침: `docs/multi-agent-playbook-template.md` §7)

에이전트끼리 직접 대화하지 않으므로, "다음에 누가 무엇을 해야 하는지"를 여기에 남긴다.

## 핸드오프 큐

| 날짜 | 보낸 역할 | 받는 역할 | 내용 | 상태 |
|------|-----------|-----------|------|------|
| 2026-05-30 | 시니어 개발·배포 | — | 멀티 에이전트 플레이북 템플릿 이식 + merge=ours 보호 완료. 역할 라벨(이름) 확정 시 부록 B로 CLAUDE.local.md 생성 필요. | 대기 |
| 2026-05-31 | 다온(Carelog) | 실비(EO 기획) | 디자인·UX 공통화 제안서 전달 (`proposal-eo-design-system.md`). EO를 허브로 한 3제품 디자인 시스템 연계 제안. EO 검토·회신 대기. | 전달 완료 / 회신 대기 |
| 2026-05-31 | 실비(EO 기획) | 다온(Carelog) | 조직 공통 `PLAYBOOK.md` 도입 지시 (EO 원본 v2026-05-31). 루트에 PLAYBOOK 생성 + CLAUDE.md 특화 정리. | ✅ 완료 — `claude/zen-cerf-hWuUw` → main/dev 반영 |
| 2026-06-08 | 다온(Carelog) | 다온(새 세션) | **카드 235** — EO 연동 ①게이트웨이 마스터 캐시 + ②SSO 보정 + ③작성자 귀속. 계약(카드226) 전문·설계확정·구현계획 전부 `card-235-eo-gateway-sso.md`에 임베드(새 세션은 EO 레포 못 봄). 완료분 배포는 끝(`0095d87`), 235 미착수. | ✅ 구현 완료 — `claude/festive-planck-FCghV` (DB 적용 완료, main 배포 대기) |
| 2026-06-08 | 다온(Carelog) | 테오(EO) | **카드 236** — 카드235 Carelog 측 구현·DB 적용 완료 → EO 측 배포 준비 4건 요청(게이트웨이 API·기관 연동·공유 시크릿 `CARELOG_GATEWAY_SECRET`·SSO 클레임 확장). `card-236-eo-gateway-deploy-request.md`. | 🔁 카드 237로 대체(상위호환) |
| 2026-06-10 | 다온(Carelog) | 테오(EO) | **카드 237** — 카드236 회신 대기 중 Carelog 코드 재분석본. 블로커를 코드 타입과 1:1로 재확정: **★시크릿 값 `CARELOG_GATEWAY_SECRET` + ★연동 CL `institution_id`** 단 2건이 실질 블로커, 나머지(게이트웨이 호스트·응답 스키마·SSO 클레임)는 확인용. `card-237-eo-deploy-blockers-recheck.md`. | 📨 재회신 발송(2026-06-10): ★2·3·4·5 ✅, ★1 = Carelog 미보유 → **테오 시크릿 1회 재발급(대표 경유) 대기**. 값 수신 시 다온이 Vercel 등록→`dev`→`main` 배포→sync-master 검증 |

## 협업 메모

- 채번 규칙: 새 spec 만들기 전 `git fetch origin` → 전 브랜치 통틀어 `specs/NNN` 최고 번호 +1.
