# spec 042 — 케어로그 주소를 EO 하위 도메인으로 (carelog.eo.ai.kr) + EO 연동 방향

- 상태: 1단계 코드 준비 완료(2026-11-27) · 도메인 연결은 대표 작업 대기
- 요청(2026-11-23 대표): "carelog 주소가 vercel 주소 형식인데 eo.ai.kr 하위 주소로 — eo.ai.kr/carelog 또는 carelog.eo.ai.kr"
  → 추가(대표): "EO와 다른 레포지만 엮고 싶다 — EO 개발이 케어로그에 영향 주도록" → "응 진행하자"

## 1. 결정 — 하위 도메인(carelog.eo.ai.kr), 경로(eo.ai.kr/carelog)는 안 함

| | carelog.eo.ai.kr | eo.ai.kr/carelog |
|---|---|---|
| 접속 경로 | 케어로그로 바로 | 항상 EO 앱을 거쳐 넘겨받음(EO rewrites) |
| EO 배포 사고 시 | 케어로그 영향 없음 | 케어로그 접속까지 막힘(환자 문자 링크 포함) |
| 케어로그 코드 | 주소 값만 | basePath·로그인 콜백·PWA scope·푸시 범위 전부 `/carelog` 기준으로 |
| 로그인 연동 | 같은 eo.ai.kr 아래 → 쿠키 공유로 더 강한 연동도 가능 | 가능 |

- "엮기"는 **기능 연동(①창구·②공용 부품)으로** 하고, **접속 경로는 묶지 않는다** — 진료 중 쓰는 화면이 EO 사고에 같이 멈추면 안 됨.
- 현황(2026-11-27 확인): eo.ai.kr DNS = **가비아**(ns.gabia.*), A → Vercel(76.76.21.21). EO는 이미 eo.ai.kr로 이전(eo-ten.vercel.app → 308).

## 2. 1단계 — 새 주소 열기 (옛 주소 유지)

### 대표 작업(다온은 Vercel·가비아·Supabase 콘솔 접근 불가)
1. Vercel 케어로그 프로젝트 → Settings → Domains → `carelog.eo.ai.kr` 추가.
2. 가비아 DNS 관리 → 레코드 추가: 타입 **CNAME**, 호스트 `carelog`, 값 = Vercel이 보여 주는 값(보통 `cname.vercel-dns.com.`). Vercel에 Valid 표시 + 인증서 자동 발급.
3. Vercel 환경변수(Production): `NEXT_PUBLIC_SITE_URL = https://carelog.eo.ai.kr` (+ 확인: `EO_APP_URL = https://eo.ai.kr`) → Redeploy.
4. Supabase(케어로그) → Authentication → URL Configuration: Site URL = 새 주소, Redirect URLs에 `https://carelog.eo.ai.kr/**` 추가(옛 주소 항목은 남김).
5. EO Vercel 환경변수 `CARELOG_APP_URL = https://carelog.eo.ai.kr` (EO SSO 토큰 발급 `src/app/api/carelog/sso-token`이 이 값으로 보냄 — 코드 변경 없음).

### 코드(이번 커밋)
- `lib/site-url.ts` — `siteUrl()`(NEXT_PUBLIC_SITE_URL, 없으면 옛 주소) · `isOldHost()`. 가입 메일·직원 초대 메일·환자 문자 링크가 모두 여기서.
  - 직원 초대 메일(`institutions.ts`)은 값이 없으면 상대 주소가 되던 것도 함께 바로잡음.
- `lib/eo/app-url.ts` — EO 주소 한 곳(기본 `https://eo.ai.kr`; 옛 eo-ten.vercel.app은 한 번 더 넘겨받던 것 제거). SSO·마스터·크레딧·기공 창구·헤더 [EO로 돌아가기]가 사용.
- `components/layout/old-host-banner.tsx` — 옛 주소로 들어온 직원에게 노란 띠 "주소가 바뀌었어요 → [새 주소로 열기]". **NEXT_PUBLIC_SITE_URL이 새 주소일 때만** 보임.
- `proxy.ts` — 옛 주소 → 새 주소 308 넘기기, **기본 꺼짐**(2단계).

### 주의
- **옛 주소(carelog-tau.vercel.app)는 끄지 않는다.** 이미 보낸 환자 문자 링크, 홈 화면에 설치한 앱, 푸시 구독이 그 주소(origin)에 묶여 있음.
- 로그인 상태·설치 앱·알림 허용은 주소별 → 새 주소에서 한 번씩 다시(직원 안내 필요).

## 3. 2단계 — 옛 주소 넘기기 (대표 결정 후)
- 예미안치과 직원 기기를 새 주소로 옮긴 뒤(로그인·앱 설치·알림 허용) Vercel 환경변수 `CARELOG_REDIRECT_OLD_HOST=1` → 옛 주소 화면 요청을 새 주소로 308.
- `/api/*`는 넘기지 않음(EO SSO·서버 호출), `sw.js`·아이콘도 제외 → 옛 주소의 설치 앱·푸시는 계속 동작(눌러 열면 새 주소로).
- 환자 푸시 구독은 옛 주소 것을 그대로 쓴다(환자는 다시 허용할 필요 없음 — 알림을 누르면 새 주소로 열림).

## 4. EO 연동 방향(대표 "EO 개발이 케어로그에 영향 주도록")
1. **창구(API) 늘리기 — 지금 방식, 주력.** 이미: SSO · 마스터(병원·멤버) · 크레딧 · 기공소/기공 의뢰. EO가 창구를 열면 케어로그가 붙여 씀. 장애가 번지지 않음.
2. **공용 부품 묶음**(디자인 토큰·화면 부품·데이터 모양) — 케어로그가 버전을 올릴 때 반영(반영 시점은 케어로그가 정함).
3. ~~한 레포 합치기~~ — EO 실수가 케어로그 배포에 그대로 → 보류.
- 다음에 정할 것(대표): 무엇을 함께 쓸지 — 로그인 통합(eo.ai.kr 쿠키) · 알림 한곳 · 디자인 통일 · 환자·병원 정보 공유.

## 5. EO 핸드오프
- `specs/000-backlog/card-eo-carelog-subdomain.md` — EO 소개 페이지(suwant) 케어로그 링크 하드코딩 교체 요청 + `CARELOG_APP_URL` 안내.
