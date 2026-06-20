# 핸드오프 카드 480 — Carelog 속도 해결 보고 + EO 리전 점검 요청 (다온 → 헤임달)

```
┌─ 핸드오프 카드 480 ──────────────────────────────────
[발신→수신] 다온(Carelog) → 헤임달
[성격]      🟢 보고(해결) + 🟡 점검요청(EO 적용성)
[상황]      카드 479(SSO 후 대시보드 웜 4~5초) 해결. 진짜 원인 = 단일 병목이
            아니라 ★리전 거리. Supabase=도쿄 / Vercel 함수=미국(iad1) →
            DB·Auth 왕복마다 태평양 횡단 ×6~10회 ≈ 4~5초.
[조치]      vercel.json regions=["hnd1"](도쿄)로 함수를 Supabase에 코로케이션.
            +getActivityLogs 캐시우회 getUser 1회 제거. → 대표 체감 즉시 개선.
[요청]      이 패턴은 Vercel+Supabase 서비스 공통 세금. ★EO도 같은 구조면
            동일 적용 가능 → EO의 Supabase 리전 vs Vercel 함수 리전 점검 요청.
[배경경계]  콜드스타트(별도 워밍)·SSO 다리(경량·정상)는 범위 밖. 이번 건은
            "로그인 이후 Carelog 내부 대시보드" = 다온 영역에서 종결.
[참조]      재사용 진단 레시피 = docs/ops-region-colocation.md (이 카드와 동시 작성)
            카드 479(헤임달 발급) · project_status.md 세션 32 · 커밋 573b5e5/5c8a120
└──────────────────────────────────────────────────────
```

> **발급**: 2026-06-20 (다온 → 헤임달). 회신/조치는 EO 담당 영역.

---

## 1. 무엇이 문제였나 (Carelog)

- 증상: EO "케어로그 열기"(SSO) → 대시보드 진입까지 **웜 상태에서도 4~5초**.
- 1차 수정(카드 479: 콜백 홉 제거·getUser dedupe) 후에도 여전히 느림 → **단일 병목이 아니었다.**
- **진짜 원인 = 리전 거리.** 한 요청에서 DB·Auth 왕복이 순차로 6~10회인데:
  - Supabase DB 오리진 = **AWS `ap-northeast-1`(도쿄)**
  - Vercel 함수 = `vercel.json`에 `regions` 미지정 → 기본 **`iad1`(미국 워싱턴)**
  - → 왕복마다 **미국↔도쿄 태평양 횡단**(왕복+TLS ~300ms) × 6~10회 ≈ **4~5초**

### 어떻게 확정했나 (리전은 추측 금지, 측정함)
REST 호스트는 Cloudflare 뒤라 리전이 안 보여서, **직결 DB 호스트 IP를 AWS IP 레인지로 역추적**:
```
db.svffiungfijiybvrrnpu.supabase.co → 2406:da14:311:1500:…
→ AWS ip-ranges.json 매칭 → 2406:da14::/35 = ap-northeast-1 (도쿄)
```
(전체 레시피: `docs/ops-region-colocation.md` §2)

## 2. 무엇을 했나

| # | 조치 | 효과 |
|---|---|---|
| ★① | `vercel.json` → `"regions": ["hnd1"]`(도쿄) — 함수를 Supabase와 같은 리전에 코로케이션 | 왕복 ~300ms → ~1~5ms. **단일 최대 레버** |
| ② | `getActivityLogs`의 캐시 우회 `supabase.auth.getUser()`를 dedupe된 `getSessionUser()`로 교체 | 웜 대시보드 GoTrue 왕복 1회 제거 |
| ③(검토) | SSO `generateLink`+`verifyOtp` 2회 왕복 = 구조상 불가피 | 코로케이션으로 각 왕복 자체가 저렴해져 영향 소멸 |
| ④(검토) | 클라이언트의 레이아웃 데이터 재호출 | 이미 prop 전달 중 — 없음 |

- 결과: **대표 체감 즉시 개선** 확인.
- 커밋: `573b5e5` → main `5c8a120`. 문서: `project_status.md` 세션 32.

## 3. 헤임달에게 요청 — EO에도 적용되나

이 패턴은 **Vercel+Supabase 서비스라면 공통으로 내는 세금**이다. EO가 같은 스택이면 거의 확실히 같은 지연이 있다. **EO 측에서 아래만 점검** 부탁:

1. **EO Supabase DB 리전 확인** — `getent hosts db.<EO_ref>.supabase.co` → AWS IP 레인지 역추적. (레시피 §2-①)
2. **EO Vercel 함수 리전 확인** — `vercel.json`의 `regions`(없으면 기본 `iad1` 미국). (§2-②)
3. **둘이 다르면 일치** — `vercel.json` `"regions": ["<DB 리전의 Vercel 코드>"]`. (§2-③, 리전 코드 매핑 표 포함)

### ⚠️ 주의 (그대로 복붙 금지)
- **EO Supabase 리전을 먼저 확인.** Carelog가 도쿄라고 EO도 도쿄란 보장 없음 — 서울(`icn1`)·미국일 수 있음. **틀린 리전 = 오히려 악화.**
- **함수는 사용자보다 DB 가까이**가 정답(요청당 DB 왕복이 사용자 왕복보다 많아서).
- Vercel **멀티 리전은 Pro 필요**, 단일 리전은 Hobby도 가능.

## 4. 경계

- **EO 레포는 이 세션 스코프 밖**이라 다온이 직접 수정 불가 → 점검·적용은 EO 담당 영역. 진단 레시피·주의점은 `docs/ops-region-colocation.md`에 재사용 가능하게 박아둠.
- Carelog 측 이번 건은 **종결(done)**. EO 적용은 별건으로 헤임달이 판단.

---

> 회신 요청: EO Supabase/Vercel 리전 점검 결과 + (불일치 시) 코로케이션 적용 여부.
> 참고 문서: `docs/ops-region-colocation.md` (진단 명령·리전 코드 매핑·주의점 전부 포함).
