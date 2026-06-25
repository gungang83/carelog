/**
 * 한글 초성 검색 헬퍼 — 참여자/이름 피커용.
 * "ㄱㄷㅇ"으로 "김도은"을 찾거나, "도은" 부분일치 둘 다 매칭한다.
 * 외부 라이브러리 없음.
 */

// 초성 19자 (유니코드 음절 분해 순서와 동일)
const CHOSEONG = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];
const CHOSEONG_SET = new Set(CHOSEONG);

const SYLLABLE_BASE = 0xac00; // '가'
const SYLLABLE_LAST = 0xd7a3; // '힣'
const CHO_DIVISOR = 588; // 21(중성) × 28(종성)

/** 음절 문자열을 초성 문자열로 변환. 음절이 아닌 문자는 그대로 둔다. */
export function toChoseong(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= SYLLABLE_BASE && code <= SYLLABLE_LAST) {
      out += CHOSEONG[Math.floor((code - SYLLABLE_BASE) / CHO_DIVISOR)];
    } else {
      out += ch;
    }
  }
  return out;
}

/** 쿼리가 초성 자모로만 이루어졌는지(예: "ㄱㄷㅇ"). 비어 있으면 false. */
function isChoseongQuery(q: string): boolean {
  if (!q) return false;
  for (const ch of q) if (!CHOSEONG_SET.has(ch)) return false;
  return true;
}

/**
 * 이름이 쿼리에 매칭되는지. 쿼리가 초성만이면 초성 매칭, 아니면 부분일치.
 * 빈 쿼리는 항상 매칭(전체 노출).
 */
export function matchesQuery(name: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (name.includes(q)) return true;
  if (isChoseongQuery(q)) return toChoseong(name).includes(q);
  return false;
}
