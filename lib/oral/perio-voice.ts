// spec 040 §5-3 — 잇몸 기록 말로 입력: 전사 문장 → 기록 동작(규칙 기반 해석, 화면·서버 공용 순수 모듈).
//   "17번 협측 원심부터 근심 방향으로 깊이 기록합니다" → 위치·방향·지표를 정하고
//   "3 2 3 4 3 5"            → 그 방향으로 차례로 채운다
//   "출혈" · "퇴축 2" · "동요 투플러스" · "타진 플러스" · "결손" · "취소" · "건너뛰기" 는 그때그때.
//   한국어 숫자(삼 이 삼 / 셋), 영어(three two three), 붙은 숫자(323)를 모두 받는다.
//   규칙으로 못 알아들은 문장은 화면이 AI 해석(spec 041 chart_parse)으로 넘긴다 — 같은 동작 모양으로 받는다.

import type { Fdi } from "@/lib/dental/teeth";
import type { Pos, Side } from "@/lib/oral/perio";

export type VoiceAction =
  | { k: "ctx"; t?: Fdi; s?: Side; p?: Pos; toward?: "M" | "D"; mode?: "pd" | "rec" }
  | { k: "val"; v: number | "F" }
  | { k: "bop" }
  | { k: "mob"; v: number }
  | { k: "perc"; v: number }
  | { k: "missing" }
  | { k: "undo" }
  | { k: "skip" };

const FDI = /^[1-4][1-8]$/;

const KO_DIGIT: Record<string, number> = { 영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 륙: 6, 칠: 7, 팔: 8, 구: 9 };
// "한 번"·"두 개"처럼 흔한 말과 겹치는 짧은 꼴(한·두·세·네)은 받지 않는다
const KO_NATIVE: Record<string, number> = { 하나: 1, 둘: 2, 셋: 3, 넷: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10 };
const EN: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
};

/** "십이" → 12, "삼" → 3, "삼이삼" → [3,2,3] (붙은 한 자리 숫자열) */
function koreanNumberToken(tok: string): number[] | null {
  if (/^십[일이삼사오]?$/.test(tok)) return [10 + (tok.length > 1 ? KO_DIGIT[tok[1]] : 0)];
  if (/^[영공일이삼사오육륙칠팔구]+$/.test(tok)) return [...tok].map((c) => KO_DIGIT[c]);
  return null;
}

/** 치아 번호 말 → "17" (일칠번 · 십칠번 · 이십칠번 · 17번 · #17) */
function toothWord(a: string): string | null {
  const s = a.replace(/\s+/g, "");
  if (/^\d{2}$/.test(s)) return FDI.test(s) ? s : null;
  let m = /^([일이삼사])([일이삼사오육칠팔])$/.exec(s);
  if (m) return `${KO_DIGIT[m[1]]}${KO_DIGIT[m[2]]}`;
  m = /^십([일이삼사오육칠팔])$/.exec(s);
  if (m) return `1${KO_DIGIT[m[1]]}`;
  m = /^([이삼사])십([일이삼사오육칠팔])$/.exec(s);
  if (m) return `${KO_DIGIT[m[1]]}${KO_DIGIT[m[2]]}`;
  return null;
}

// 표시 토큰(§…)으로 바꿔 끼우는 규칙 — 순서가 중요(긴 말 먼저)
const RULES: [RegExp, string][] = [
  // 방향(부터·쪽으로)
  [/(원심|distal|디스탈|디스틀)\s*(에서|부터|으로부터)/g, " §FROM_D "],
  [/(근심|mesial|메지알|메시알|메지얼)\s*(에서|부터|으로부터)/g, " §FROM_M "],
  [/from\s*(the\s*)?distal/g, " §FROM_D "],
  [/from\s*(the\s*)?mesial/g, " §FROM_M "],
  [/(근심|mesial|메지알|메시알)\s*(방향|쪽)(으로)?|근심으로|앞쪽으로|앞으로|앞쪽|(to|toward|towards)\s*(the\s*)?mesial/g, " §TO_M "],
  [/(원심|distal|디스탈)\s*(방향|쪽)(으로)?|원심으로|뒤쪽으로|뒤로|뒤쪽|(to|toward|towards)\s*(the\s*)?distal/g, " §TO_D "],
  // 면
  [/협측|바깥\s*쪽|바깥|볼\s*쪽|순측|buccal|labial|facial|버칼|부칼/g, " §B "],
  [/구개\s*측|구개|설측|혀\s*쪽|안\s*쪽|palatal|lingual|팔라탈|링구알|링궐/g, " §L "],
  // 부위(단독)
  [/원심|distal|디스탈/g, " §P_D "],
  [/근심|mesial|메지알|메시알/g, " §P_M "],
  [/중앙|가운데|center|centre|middle|mid|미들/g, " §P_C "],
  // 지표
  [/깊이|포켓|probing\s*depth|probing|프로빙|pocket/g, " §PD "],
  [/퇴축|리세션|recession/g, " §REC "],
  [/출혈|블리딩|bleeding|bop/g, " §BOP "],
  [/동요도?|모빌리티|mobility/g, " §MOB "],
  [/타진|퍼커션|percussion/g, " §PERC "],
  [/결손|발치된|빠진\s*치아|missing/g, " §MISS "],
  [/취소|다시|잘못|지워|undo/g, " §UNDO "],
  [/건너\s*뛰[기어고]?|넘어가|패스|skip|pass/g, " §SKIP "],
  // 단계(동요·타진)
  [/쓰리\s*플러스|three\s*plus|\+\+\+|세\s*개|삼\s*플러스/g, " §L3 "],
  [/투\s*플러스|two\s*plus|더블\s*플러스|\+\+|이\s*플러스/g, " §L2 "],
  [/원\s*플러스|one\s*plus|일\s*플러스|플러스|plus|\+/g, " §L1 "],
  [/음성|없음|negative/g, " §L0 "],
];

/** 전사 한 문장 → 기록 동작들. 알아들은 게 없으면 [] */
export function parsePerioUtterance(raw: string): VoiceAction[] {
  let s = ` ${raw.toLowerCase()} `;
  // 치아 번호(번·#·tooth·치아 붙은 것) → §T17
  s = s.replace(/#\s*(\d{2})/g, (_, d) => (FDI.test(d) ? ` §T${d} ` : ` ${d} `));
  s = s.replace(/(?:tooth|치아)\s*(\d{2})/g, (_, d) => (FDI.test(d) ? ` §T${d} ` : ` ${d} `));
  s = s.replace(/([일이삼사오육칠팔십\d]{2,4})\s*번(?!째)/g, (m0, a) => {
    const t = toothWord(a);
    return t ? ` §T${t} ` : m0;
  });
  // 음수(퇴축: 잇몸이 덮여 올라옴)
  s = s.replace(/(마이너스|minus)\s*(\d+|[일이삼])/g, (_, __, n) => ` §NEG${/\d/.test(n) ? n : KO_DIGIT[n]} `);
  for (const [re, rep] of RULES) s = s.replace(re, rep);
  s = s.replace(/[,.·/~\-:;!?()]/g, " ");
  // F(뿌리 끝까지) — 문장부호를 지운 뒤에(“5, 에프, 3”)
  s = s.replace(/(^|\s)(에프|풀|full|f)(?=\s|$)/g, " §F ");

  const toks = s.split(/\s+/).filter(Boolean);
  const out: VoiceAction[] = [];
  let ctx: Extract<VoiceAction, { k: "ctx" }> | null = null;
  const flush = () => {
    if (ctx) out.push(ctx);
    ctx = null;
  };
  const C = () => (ctx ??= { k: "ctx" });

  const vals: (number | "F")[] = [];
  const pushNum = (n: number) => vals.push(n);
  const drain = () => {
    for (const v of vals) out.push({ k: "val", v });
    vals.length = 0;
  };

  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i];
    const next = toks[i + 1];
    if (tk.startsWith("§")) {
      const tag = tk.slice(1);
      if (/^T\d{2}$/.test(tag)) {
        drain();
        C().t = tag.slice(1);
        continue;
      }
      if (tag.startsWith("NEG")) {
        flush();
        pushNum(-Number(tag.slice(3)));
        continue;
      }
      switch (tag) {
        case "B":
        case "L":
          drain();
          C().s = tag as Side;
          continue;
        case "FROM_D":
        case "FROM_M":
          drain();
          C().p = tag === "FROM_D" ? "D" : "M";
          C().toward ??= tag === "FROM_D" ? "M" : "D";
          continue;
        case "TO_M":
        case "TO_D":
          drain();
          C().toward = tag === "TO_M" ? "M" : "D";
          continue;
        case "P_D":
        case "P_M":
        case "P_C":
          drain();
          C().p = tag === "P_D" ? "D" : tag === "P_M" ? "M" : "C";
          continue;
        case "PD":
        case "REC":
          drain();
          C().mode = tag === "PD" ? "pd" : "rec";
          continue;
        case "F":
          flush();
          vals.push("F");
          continue;
        case "BOP":
          flush();
          drain();
          out.push({ k: "bop" });
          continue;
        case "MOB":
        case "PERC": {
          flush();
          drain();
          // 바로 뒤의 단계(§L0~3) 또는 숫자 0~3
          let lv: number | null = null;
          if (next?.startsWith("§L")) lv = Number(next.slice(2));
          else if (next && /^[0-3]$/.test(next)) lv = Number(next);
          else if (next && koreanNumberToken(next)?.length === 1 && koreanNumberToken(next)![0] <= 3) lv = koreanNumberToken(next)![0];
          if (lv !== null) {
            out.push({ k: tag === "MOB" ? "mob" : "perc", v: lv });
            i++;
          }
          continue;
        }
        case "MISS":
          flush();
          drain();
          out.push({ k: "missing" });
          continue;
        case "UNDO":
          flush();
          drain();
          out.push({ k: "undo" });
          continue;
        case "SKIP":
          flush();
          drain();
          out.push({ k: "skip" });
          continue;
        default:
          continue; // 단독 단계 표시 등은 무시
      }
    }
    // 숫자
    let nums: number[] | null = null;
    if (/^\d+$/.test(tk)) {
      // 맨 앞의 두 자리 치아 번호 + 면이 바로 뒤에 오면 치아로("17 협측 …")
      if (tk.length === 2 && FDI.test(tk) && next && /^§[BL]$|^§FROM_|^§P_/.test(next)) {
        drain();
        C().t = tk;
        continue;
      }
      if (tk.length === 1) nums = [Number(tk)];
      else if (tk.length === 2 && Number(tk) >= 10 && Number(tk) <= 15) nums = [Number(tk)];
      else nums = [...tk].map(Number); // "323" → 3,2,3
    } else if (tk in EN) nums = [EN[tk]];
    else if (tk in KO_NATIVE) nums = [KO_NATIVE[tk]];
    else nums = koreanNumberToken(tk);
    if (nums) {
      flush();
      nums.forEach(pushNum);
    }
  }
  flush();
  drain();
  return out;
}

/** 동작 요약(화면 칩) — "17 바깥 D→M 깊이" */
export function describeCtx(a: Extract<VoiceAction, { k: "ctx" }>): string {
  return [
    a.t,
    a.s === "B" ? "바깥" : a.s === "L" ? "안쪽" : null,
    a.p ? `${a.p}부터` : null,
    a.toward ? (a.toward === "M" ? "→근심" : "→원심") : null,
    a.mode === "pd" ? "깊이" : a.mode === "rec" ? "퇴축" : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** AI 해석 결과(JSON) 검증 — 모르는 모양은 버림 */
export function sanitizeActions(raw: unknown): VoiceAction[] {
  if (!Array.isArray(raw)) return [];
  const out: VoiceAction[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    switch (o.k) {
      case "ctx": {
        const c: Extract<VoiceAction, { k: "ctx" }> = { k: "ctx" };
        if (typeof o.t === "string" && FDI.test(o.t)) c.t = o.t;
        if (o.s === "B" || o.s === "L") c.s = o.s;
        if (o.p === "D" || o.p === "C" || o.p === "M") c.p = o.p;
        if (o.toward === "M" || o.toward === "D") c.toward = o.toward;
        if (o.mode === "pd" || o.mode === "rec") c.mode = o.mode;
        out.push(c);
        break;
      }
      case "val":
        if (o.v === "F" || (typeof o.v === "number" && Number.isInteger(o.v) && o.v >= -3 && o.v <= 15)) out.push({ k: "val", v: o.v as number | "F" });
        break;
      case "mob":
      case "perc":
        if (typeof o.v === "number" && o.v >= 0 && o.v <= 3) out.push({ k: o.k, v: Math.round(o.v) });
        break;
      case "bop":
      case "missing":
      case "undo":
      case "skip":
        out.push({ k: o.k });
        break;
    }
  }
  return out;
}
