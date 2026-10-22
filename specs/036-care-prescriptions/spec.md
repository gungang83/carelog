# spec 036 — 처방: EO 제품 기반 처방 + 기록 템플릿 (치간칫솔 차트 1호)

> 상태: **설계 (2026-10-22)** — 대표 방향 확정, EO 제품 게이트웨이 대기.
> 대표 방향: "환자에게 나가는 처방은 EO에 등록된 판매 가능 제품으로. 상담 중 사이즈·종류를 기록하는
> 템플릿(치간칫솔 차트 등)을 그 제품과 엮어 같이 내보낸다." / "지금은 예미안치과의 Carelog↔EO.
> 나중에는 Carelog 처방이 수완홀딩스나 다른 워크스페이스로 주문으로 들어가게 한다 — 염두에 두고 설계."
> 연계: EO spec-120(대표상품+옵션축+SKU) · spec-114(커머스·주문→거래 자동배선) · Carelog spec 035(게이트웨이 패턴).

## 1. 개념 — 세 층

| 층 | 무엇 | 정본 |
|---|---|---|
| **제품** | 처방할 수 있는 것. 대표상품 + 옵션축(예: 사이즈) + SKU | **EO** (Carelog는 만들지 않는다 — 기공소 목록과 같은 원칙) |
| **기록 템플릿** | 상담 중 "어디에 무엇을" 기록하는 도구. 치간칫솔 차트(치아 사이 26곳 × 사이즈)가 1호 | **Carelog** (데이터 정의 — 코드 아님) |
| **처방** | 이 환자에게 나가는 제품 목록(SKU × 수량) + 템플릿 결과 | **Carelog** (기록) → 2차에 **EO 주문**으로 |

템플릿은 **대표상품 하나와 그 옵션축에 연결**된다. 치간칫솔 차트의 선택지 = "큐라프록스 치간칫솔"의
"사이즈" 옵션값(CPS 07·08·09…). 차트를 찍으면 사용된 옵션값마다 해당 SKU가 처방 줄로 자동 생성된다.

## 2. ★판매처(seller)를 처음부터 들고 다닌다 — 2차 주문 대비

처방의 각 줄은 **어느 워크스페이스가 파는 어떤 SKU인지**를 담는다. 1차는 판매처가 병원 자신(예미안)뿐이지만,
2차에 수완홀딩스·다른 공급처 제품이 섞여도 **처방 구조가 바뀌지 않는다.**

```
prescription_line {
  seller: { workspace_id, name, channel: "self" | "store" },  // 1차는 self(병원 자체 판매)뿐
  product_id, sku_id, code,                                    // EO 식별자
  name, option_values, price, image_url,                       // ★처방 시점 스냅샷(거래 증빙 원칙 — spec 035와 동일)
  qty,                                                         // 기본 1(사이즈당 1팩), 직원 수정 가능 — 대표 확정
  source: "manual" | "template:<template_id>",
  template_note?: "14곳"                                        // 템플릿에서 왔으면 사용 부위 수 등
}
```

- **스냅샷**: 이름·가격·옵션값을 처방 시점 값으로 박제한다. EO에서 가격이 바뀌어도 과거 처방은 그대로.
- **판매처가 여럿이면 처방은 판매처별로 쪼개져 주문된다**(2차) — 한 처방 = 판매처 수만큼의 주문.

## 3. 데이터 (Carelog — 마이그레이션은 구현 시)

- `care_templates` — 기록 템플릿 정의(전역/기관). `kind`(interdental_chart 등) · `def` jsonb
  (사이트 정의 = 치아 사이 FDI 쌍 26곳, 옵션값별 색) · `product_ref`(EO product_id + 옵션축 이름) · active.
- `care_prescriptions` — 처방 1건. `id`(uuid — **2차 주문의 멱등 키**) · consultation_id · patient_id ·
  `lines` jsonb(§2) · `template_results` jsonb(예: {"16-15":"CPS 08", …}) · `status`
  (draft → delivered(환자 전달) → ordered(2차, 판매처별 주문 생성)) · `order_refs` jsonb(2차: [{seller, eo_order_id}]).
- 기존 `consultation.prescriptions`(문자열 칩)는 하위호환으로 유지하고, 새 처방은 위 테이블을 쓴다.

## 4. 화면 흐름

1. 상담보드 처방 섹션 — **EO 제품 목록에서 선택**(검색·카테고리, 옵션 있는 제품은 옵션 선택 → SKU).
   하드코딩 칩 4개는 제거.
2. 템플릿이 연결된 제품(치간칫솔)은 **[사이즈 차트]** 버튼 → 전체화면 차트(상하악 도식, 치아 사이 26곳을
   눌러 사이즈 순환, 하단 사이즈별 개소 요약) → [처방에 담기] → 사이즈별 SKU 줄 자동 생성(qty 1).
3. 처방 목록에서 수량 조정·제품 추가·삭제.
4. 저장 → 상담 기록에 **[처방]** 블록(차트 이미지 + 부위별 사이즈 + 제품 목록) 삽입.
5. 환자 전달 — 기존 문자 링크(`/p/토큰`)로 한 묶음(차트 + 사이즈 + 제품 이름·이미지·가격 + 사용법).
   알림톡·이메일은 같은 내용의 다른 경로(후속).

⚠️ 치열 도식은 **Carelog가 직접 그린다**(대표가 보여준 참고 화면은 © 한국SOOD교육협회 저작물 — 그대로 쓰지 않는다).

## 5. EO 계약 (요청 — 마르코)

**1차 — 읽기**
```
GET /api/gateway/products?institution_id=...
→ { sellers: [
      { workspace_id, name, channel: "self",          // 1차는 병원 자신만
        products: [{ product_id, name, brand, category, image_url,
                     option_types: [{ name, values[] }],
                     skus: [{ sku_id, code, option_values, price, active }] }] }
    ] }
```
- 응답을 처음부터 `sellers[]` 배열로 받는다 — 2차에 수완홀딩스 등이 배열에 추가될 뿐, Carelog 코드는 그대로.
- "환자 판매 가능" 품목만 내려준다(구분 필드는 EO 결정).

**2차 — 주문(예약)**
```
POST /api/gateway/prescription-orders
{ carelog_prescription_id, seller_workspace_id, institution_id,
  lines: [{ sku_id, qty, price_snapshot }], fulfillment: ..., patient?: ... }
→ { eo_order_id, status }
```
- 멱등 키 = (carelog_prescription_id, seller_workspace_id). spec-114 주문→거래 자동배선 재사용.

## 6. 미결

1. **2차 주문 모델**(대표 결정 필요 — 2차 착수 전): ⒜ 병원이 판매처에서 사서 환자에게 파는 B2B(병원 매입·환자
   판매) ⒝ 판매처가 환자에게 직접 파는 B2C(병원은 추천·수수료). 개인정보 범위·배송·정산이 갈린다.
2. EO spec-120(대표상품·옵션축) 구현 여부 — 치간칫솔 사이즈를 옵션축으로 받는 것이 이 설계의 전제.
3. "환자 판매 가능" 구분 필드(EO).
4. 1차에 판매·재고 차감을 EO로 돌려보낼지(병원 자체 판매분) — 제안: 1차는 읽기만, 2차에 주문과 함께.

## 7. 단계

| | 내용 | 의존 |
|---|---|---|
| A | 치간칫솔 차트 화면(도식·26곳·요약) + 템플릿 데이터 정의 | 없음 — 먼저 착수 가능 |
| B | 제품 게이트웨이 클라이언트 + 처방 섹션 교체 + 차트→SKU 자동 생성 + care_prescriptions | EO 1차 계약 |
| C | 환자 전달 화면(처방 묶음) — 기존 문자 링크 | B |
| D | 2차 주문(판매처별) | EO 2차 계약 + 미결 1 |
