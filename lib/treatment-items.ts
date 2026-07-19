// spec 028 견적 빌더 — 치료 항목 사전 타입 + [치료비 견적] 평문 블록 조립.
// 표가 아닌 평문 블록인 이유: 차트 '전체 복사'(평문) 유지 + 요약 [라벨] 문법과 일관 +
// 후속 '상담 데이터화'에서 파싱 가능(형식 고정).

export type TreatmentItem = {
  id: string;
  institution_id: string;
  name: string;
  price: number; // 참고 단가(원)
  display_order: number;
  active: boolean;
  created_at: string;
};

export type EstimateRow = {
  name: string;
  qty: number; // 1 이상. 할인 등은 qty 1 + 음수 금액으로
  price: number; // 단가(원) — 음수 허용(할인)
};

export const fmtWon = (n: number) => n.toLocaleString("ko-KR");

/** [치료비 견적] 평문 블록 생성. 형식은 고정(후속 데이터화 파싱 대상) — 임의 변경 금지. */
export function formatEstimateBlock(rows: EstimateRow[], memo?: string): string {
  const valid = rows.filter((r) => r.name.trim());
  const lines = valid.map((r) => {
    const amount = r.qty * r.price;
    const qtyPart = r.qty > 1 ? ` ${r.qty}개 × ${fmtWon(r.price)}원` : "";
    return `- ${r.name.trim()}${qtyPart} = ${fmtWon(amount)}원`;
  });
  const total = valid.reduce((s, r) => s + r.qty * r.price, 0);
  const out = ["[치료비 견적]", ...lines, `합계: ${fmtWon(total)}원`];
  if (memo?.trim()) out.push(`※ ${memo.trim()}`);
  return out.join("\n");
}
