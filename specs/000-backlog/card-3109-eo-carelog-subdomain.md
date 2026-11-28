# 핸드오프 카드 3109 — 케어로그 새 주소 carelog.eo.ai.kr 반영 · ✅ 완료

```
┌─ 핸드오프 카드 (EO 채번 요청) ─────────────────────────
[발신→수신] 다온(Carelog) → 테오(EO)
[성격]      🟢 낮음 · 설정/링크 교체 · EO 2곳(환경변수 1 + 코드 1줄)
[지시]      specs/042-eo-subdomain/spec.md §2·§5
[착수 전]   케어로그 도메인 연결 확인(https://carelog.eo.ai.kr 열림) 후 진행
└──────────────────────────────────────────────────────
```

## 배경
대표 결정(2026-11-27): 케어로그 주소를 EO 하위 도메인 **carelog.eo.ai.kr**로 옮긴다(경로 방식 eo.ai.kr/carelog는 안 함 — 접속 경로를 묶지 않기 위해).
옛 주소 carelog-tau.vercel.app은 계속 살아 있음(환자 문자 링크·설치 앱 보호).

## 요청
1. **EO Vercel 환경변수** `CARELOG_APP_URL` → `https://carelog.eo.ai.kr` (대표가 Vercel에서 바꿔도 됨 — 코드 변경 없음, `src/app/api/carelog/sso-token/route.ts`).
2. **코드 1줄**: `src/app/suwant/_content.ts:118` `href: "https://carelog-tau.vercel.app"` → `"https://carelog.eo.ai.kr"`.

## 케어로그 쪽(완료)
- 케어로그 → EO 호출 기본 주소를 `https://eo.ai.kr`로(옛 eo-ten.vercel.app 308 한 번 거치던 것 제거). `EO_APP_URL` 환경변수 우선.
- SSO 받는 쪽(`/api/auth/sso`)은 주소와 무관 — 토큰 검증만.

## 완료 회신
[완료] 브랜치·커밋해시 · EO 환경변수 반영 여부

## 회신 (2026-11-28 테오 → 다온) — ✅
```
┌─ 핸드오프 카드 3109 · 회신 ─────────
[발신→수신] 테오 → 다온(Carelog)
[결과]      [완료] 브랜치 dev · 커밋 a3e38e71a · 배포 main@d412e679
            src/app/suwant/_content.ts:118 href → https://carelog.eo.ai.kr
            eo.ai.kr/suwant 에서 새 주소로 나가는 것 확인 · 옛 주소(carelog-tau) EO 레포 내 잔존 0
└────────────────────────────────
```
