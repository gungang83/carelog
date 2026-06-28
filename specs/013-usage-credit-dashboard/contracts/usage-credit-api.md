# Contract: 사용량 · 크레딧 API + lib (spec 013)

인증: `getSessionUser()` 필수. 집계/충전은 `isSuperAdmin(email)` 필수(401/403). 결과 JSON.

## Route Handlers

### `POST /api/menu-usage/track`  body `{ menuId }`
- 세션에서 institution·user·role 확인. `MENU_IDS` 화이트리스트만. KST 일자로 `increment_menu_usage`.
- 실패/미인증/비화이트리스트 모두 조용히 **204**(UX 무방해).

### `GET /api/menu-usage/summary?days=30&institution=`
- 슈퍼어드민 전용. 응답: `{ days, total, activeUsers, scope, institutions[], byInstitution[], menus[]{id,label,total,byRole}, unused[] }`.

### `GET /api/credits/summary?days=30&institution=`
- 슈퍼어드민 전용. 응답: `{ days, totalSpent, totalGranted, scope, institutions[], features[]{feature,label,credits,count}, byInstitution[]{credits}, topUsers[]{email,credits,count}, balances[]{balance}, recent[]{at,institution,user,label,delta,balance_after,memo} }`.
- 사용량=차감(delta<0)만 집계. 충전(grant)은 totalGranted·잔액에만 반영.

### `POST /api/credits/grant`  body `{ institutionId, amount, memo? }`
- 슈퍼어드민 전용. `grantCredit` 위임. 응답 `{ ok, balance }`. amount 음수 가능(조정).

## lib/credits.ts (서버)
```ts
CREDIT_PRICES: Record<CreditFeature, number>
featureLabel(feature): string
getCreditBalance(institutionId): Promise<number>
deductCredit(institutionId, feature, byEmail, refId?, memo?): Promise<void>   // ★비차단·비throw
grantCredit(institutionId, amount, byEmail, memo?): Promise<number>           // 충전 후 잔액
```

## lib/usage/menu-config.ts
```ts
MENU_ITEMS: {id,label}[]
MENU_IDS: Set<string>
menuLabel(id): string
menuIdFromPath(pathname): string   // '/'·빈값 → 'home', 그 외 첫 세그먼트
```

## 배선 계약 (app/actions/transcribe.ts)
- 각 전사 성공 직후 `recordUsage(feature, refId?)` 호출(내부에서 institution·user 확인 → `deductCredit`).
- 매핑: 실제 사용 엔진 기준 — basic/quick/detailed/dental/multilingual/comparison, 청크 구간=transcribe_chunk_segment, 청크 요약=summarize_chunk.
- **비차단**: recordUsage 실패가 전사 결과를 바꾸지 않음.

## 클라이언트 (components/usage/route-tracker.tsx)
- `usePathname` 변경 시 `menuIdFromPath` → `navigator.sendBeacon('/api/menu-usage/track', {menuId})`(폴백 fetch keepalive). 대시보드 레이아웃에 1회 마운트.
