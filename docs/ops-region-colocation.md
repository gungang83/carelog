# 운영 노트 — 리전 코로케이션 (Vercel ↔ Supabase)

> **한 줄 요약**: 서버리스 함수(Vercel)와 DB·Auth(Supabase)가 **다른 리전**에 있으면,
> 요청당 왕복(N회)마다 대륙 간 지연이 N배로 증폭된다. **둘을 같은 리전에 두면** 그 세금이 사라진다.
> EO 조직의 모든 Vercel+Supabase 서비스에 **표준 점검 항목**으로 적용한다.

발견: Carelog 카드 479 (2026-06-20). SSO 로그인 후 대시보드 웜 4~5초의 진짜 원인.

---

## 1. 왜 생기나 (원리)

한 HTTP 요청에서 DB·Auth 왕복이 **순차로 N번** 일어난다(예: `auth.getUser` 1회 + 쿼리 5~9회).
함수와 DB가 멀면 각 왕복에 **편도 거리 + TLS**가 붙는다.

| 함수 리전 | DB 리전 | 왕복 1회 | 왕복 8회 |
|---|---|---|---|
| 미국 `iad1` | 도쿄 `ap-northeast-1` | ~300ms | **~2.4초** (+TLS·콜드면 더) |
| 도쿄 `hnd1` | 도쿄 `ap-northeast-1` | ~1~5ms | **~수십 ms** |

→ **리전만 일치시켜도 수 초 → 수십 ms.** 코드 최적화(쿼리 통합·dedupe)보다 레버리지가 훨씬 크다.

### 두 조건이 겹치면 무조건 발생
1. **컴퓨트와 DB가 다른 리전** — Vercel 기본 함수 리전이 미국 `iad1`이라, 한국팀이 Supabase를 도쿄/서울에 두면 거의 항상 밟는다.
2. **요청당 왕복이 많음** — auth + 여러 쿼리를 하는 대시보드형 앱은 대부분 해당.

---

## 2. 진단 레시피 (그대로 복사해서 쓰기)

### ① Supabase DB가 실제로 어느 AWS 리전인지 확인
REST API 호스트(`<ref>.supabase.co`)는 **Cloudflare 뒤에 가려져** 리전이 안 보인다.
**직결 DB 호스트**(`db.<ref>.supabase.co`)는 AWS IP로 바로 해석되므로 그걸 역추적한다.

```bash
# 1) DB 호스트 IP 확인
getent hosts db.<프로젝트ref>.supabase.co
#   예) 2406:da14:311:1500:...  (IPv6)

# 2) AWS 공식 IP 레인지에서 리전 매칭
curl -sS https://ip-ranges.amazonaws.com/ip-ranges.json -o /tmp/awsip.json
python3 - <<'PY'
import json, ipaddress
ip = ipaddress.ip_address("2406:da14:311:1500:8e9f:3f8b:fb52:d2f8")  # ← 위 IP로 교체
d = json.load(open("/tmp/awsip.json"))
hits = [(p["ipv6_prefix"], p["region"]) for p in d["ipv6_prefixes"]
        if ip in ipaddress.ip_network(p["ipv6_prefix"])]            # IPv4면 d["prefixes"]/p["ip_prefix"]
hits.sort(key=lambda x: ipaddress.ip_network(x[0]).prefixlen, reverse=True)
print(hits[:3])
PY
#   예 출력: [('2406:da14::/35', 'ap-northeast-1')]  → 도쿄
```

> ⚠️ `cf-ray: ...-ICN/ORD` 같은 Cloudflare 엣지 코드는 **요청자(함수)에서 가까운 엣지**일 뿐,
> Supabase 오리진 리전이 **아니다.** 반드시 직결 DB 호스트로 확인할 것.

### ② Vercel 함수 리전 확인
- `vercel.json`에 `"regions"`가 **없으면 기본값 = `iad1`(미국 워싱턴)**.
- 또는 Vercel 대시보드 → Project → Settings → Functions → Function Region.

### ③ 둘을 일치시킨다
`vercel.json`:
```jsonc
{ "regions": ["<DB와 같은 리전의 Vercel 코드>"] }
```

**리전 코드 매핑**(자주 쓰는 것):

| AWS 리전(Supabase) | Vercel 리전 코드 |
|---|---|
| `ap-northeast-1` 도쿄 | `hnd1` |
| `ap-northeast-2` 서울 | `icn1` |
| `us-east-1` 버지니아 | `iad1` |
| `ap-southeast-1` 싱가포르 | `sin1` |
| `eu-central-1` 프랑크푸르트 | `fra1` |

배포 후 함수가 새 리전에서 재기동되어야 체감된다(배포 직후 첫 호출은 콜드).

---

## 3. ⚠️ 주의점 (그대로 복붙 금지)

- **서비스마다 Supabase 리전을 먼저 확인.** Carelog가 도쿄라고 EO도 도쿄란 보장 없음. **틀린 리전 = 오히려 악화.**
- **함수는 사용자보다 DB 가까이.** 요청당 DB 왕복(N회)이 사용자↔함수 왕복(1회)보다 훨씬 많아서, DB 옆이 거의 항상 정답. (한국 사용자 + 도쿄 DB라도 `hnd1`이 맞다 — 서울↔도쿄 ~30ms라 사용자 쪽 손해 미미.)
- **Vercel 플랜**: 멀티 리전은 **Pro** 필요. 단일 리전 지정은 Hobby도 가능.
- **Supabase 리전은 프로젝트 생성 시 고정** — 이전이 비싸다. 그래서 **싼 쪽(Vercel 함수)을 DB에 맞춘다.**
- Edge Functions(Edge Runtime)는 리전 개념이 달라 별도 검토. 이 노트는 **Node 서버리스 함수** 기준.

---

## 4. 코드 레벨 보조 최적화 (리전 다음 순위)

리전이 1순위지만, 함께 하면 좋은 것들:
- **요청당 `auth.getUser`를 1회로 dedupe** — React `cache()`로 감싼 `getSessionUser()` 하나만 쓰고, Server Action에서 `supabase.auth.getUser()`를 또 부르지 말 것. (Carelog: `lib/auth/institution.ts`의 `getSessionUser`)
- **레이아웃이 받은 데이터는 prop으로** 자식 클라이언트에 전달 — 마운트 시 같은 데이터를 서버액션으로 재호출하지 말 것.
- **중복 쿼리 통합** — 같은 테이블을 여러 함수가 각자 치면 한 번으로 합칠 여지 검토.

---

## 5. Carelog 사례 (레퍼런스)

| | 값 |
|---|---|
| 증상 | SSO 로그인 후 대시보드 웜 **4~5초** |
| DB | Supabase `svffiungfijiybvrrnpu` → IPv6 `2406:da14:311::` → **AWS `ap-northeast-1`(도쿄)** |
| 함수(수정 전) | `vercel.json`에 `regions` 없음 = **`iad1`(미국)** → 왕복마다 태평양 횡단 |
| 수정 | `vercel.json` `"regions": ["hnd1"]` + `getActivityLogs`의 캐시 우회 `getUser` 제거 |
| 결과 | 웜 대시보드 체감 즉시 개선(대표 확인) |
| 커밋 | `573b5e5` (→ main `5c8a120`) · 카드 479 · `project_status.md` 세션 32 |
