// spec 040 — 구강 지표 기록: 지표 등록부 · 기록 모델 · 진행 순서 · 요약 계산(화면·서버 공용 순수 모듈).
// ★지표 하나 = MEASURES 정의 하나. 입력·그림·요약이 정의를 읽는다 — 새 인덱스는 여기에 추가(이후 DB 정의로 이전).
// ★진단·병기 판정 문구를 만들지 않는다(spec 040 §9) — 측정값·계산 수치만.
// 좌표 약속은 lib/dental/teeth.ts와 같다(FDI, 화면 왼쪽 = 환자 우측).

import { archTeeth, isUpper, isPatientRight, type Fdi } from "@/lib/dental/teeth";

export type Side = "B" | "L"; // 협측 / 구개·설측(상악은 화면에 P)
export type Pos = "D" | "C" | "M"; // 원심 · 중앙 · 근심
export type Surface = "M" | "D" | "B" | "L"; // 치태(O'Leary) 4면
export type Level = "site" | "tooth" | "surface";

export type MeasureId = "pd" | "rec" | "bop" | "mob" | "plq" | "state";
export type MeasureValue = number | string | boolean;

export type MeasureDef = {
  id: MeasureId;
  label: string;
  short: string;
  /** 환자용 쉬운 말 */
  plain: string;
  level: Level;
  /** 고를 수 있는 값(화면 숫자판·눈금) */
  options: MeasureValue[];
  format: (v: MeasureValue) => string;
};

export const PD_OPTIONS: MeasureValue[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, "F"];
export const REC_OPTIONS: MeasureValue[] = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const MOB_LABEL = ["0", "+", "++", "+++"];

export const MEASURES: Record<MeasureId, MeasureDef> = {
  pd: { id: "pd", label: "Probing depth", short: "PD", plain: "잇몸 주머니 깊이", level: "site", options: PD_OPTIONS, format: (v) => String(v) },
  rec: {
    id: "rec",
    label: "치은 퇴축",
    short: "REC",
    plain: "잇몸이 내려간 정도(음수 = 잇몸이 덮여 올라옴)",
    level: "site",
    options: REC_OPTIONS,
    format: (v) => String(v),
  },
  bop: { id: "bop", label: "출혈(BOP)", short: "BOP", plain: "잴 때 피가 난 곳", level: "site", options: [true, false], format: (v) => (v ? "●" : "") },
  mob: { id: "mob", label: "동요도", short: "MOB", plain: "치아 흔들림", level: "tooth", options: [0, 1, 2, 3], format: (v) => MOB_LABEL[Number(v)] ?? String(v) },
  plq: { id: "plq", label: "치태(O'Leary)", short: "PLQ", plain: "치태가 묻은 면", level: "surface", options: [true, false], format: (v) => (v ? "■" : "") },
  state: {
    id: "state",
    label: "결손·임플란트",
    short: "상태",
    plain: "빠진 치아·임플란트",
    level: "tooth",
    options: ["missing", "implant"],
    format: (v) => (v === "missing" ? "결손" : v === "implant" ? "임플란트" : ""),
  },
};

/** 기록 한 줄 = 한 위치·한 지표. 위치: 부위(t·s·p) / 치아(t) / 면(t·f) */
export type Entry = {
  m: MeasureId;
  t: Fdi;
  s?: Side;
  p?: Pos;
  f?: Surface;
  v: MeasureValue;
  at?: string;
  src?: "click" | "keypad" | "voice";
  /** 말로 입력 · 검토 전(spec 040 §5-3) */
  review?: boolean;
  utt?: string;
};

export type PerioData = {
  v: 1;
  thirdMolars: boolean;
  entries: Entry[];
  utterances?: { id: string; text: string; at: string }[];
};

export const emptyPerio = (): PerioData => ({ v: 1, thirdMolars: false, entries: [] });

export function entryKey(e: Pick<Entry, "m" | "t" | "s" | "p" | "f">): string {
  return [e.m, e.t, e.s ?? "", e.p ?? "", e.f ?? ""].join(":");
}

/** 저장된 JSON을 안전하게 읽기(모르는 지표·잘못된 값은 버림) */
export function normalizePerio(raw: unknown): PerioData {
  const o = (raw ?? {}) as Partial<PerioData>;
  const entries = Array.isArray(o.entries) ? o.entries : [];
  const map = new Map<string, Entry>();
  for (const e of entries) {
    if (!e || !(e.m in MEASURES) || typeof e.t !== "string" || !/^[1-4][1-8]$/.test(e.t)) continue;
    map.set(entryKey(e), e);
  }
  return {
    v: 1,
    thirdMolars: o.thirdMolars === true,
    entries: [...map.values()],
    ...(Array.isArray(o.utterances) ? { utterances: o.utterances } : {}),
  };
}

// ── 조회 도우미 ─────────────────────────────────────────────────────────
export type PerioIndex = Map<string, Entry>;
export const indexOf = (d: PerioData): PerioIndex => new Map(d.entries.map((e) => [entryKey(e), e]));

export function siteVal(ix: PerioIndex, m: MeasureId, t: Fdi, s: Side, p: Pos) {
  return ix.get(entryKey({ m, t, s, p }))?.v;
}
export function toothVal(ix: PerioIndex, m: MeasureId, t: Fdi) {
  return ix.get(entryKey({ m, t }))?.v;
}
export function surfaceVal(ix: PerioIndex, t: Fdi, f: Surface) {
  return ix.get(entryKey({ m: "plq", t, f }))?.v;
}

/** PD 숫자값(F = 그 치아 뿌리 끝까지 — 계산에는 13으로) */
export const pdNum = (v: MeasureValue | undefined): number | null =>
  v === undefined || v === "" ? null : v === "F" ? 13 : typeof v === "number" ? v : null;

/** 깊이 색: ≤3 초록 · 4~5 주황 · ≥6 빨강 */
export function pdColor(n: number | null): string {
  if (n === null) return "#94a3b8";
  if (n >= 6) return "#dc2626";
  if (n >= 4) return "#d97706";
  return "#16a34a";
}

// ── 진행 순서(★순서 고정 없음 — 사용자가 고른 칸에서 진행 방향을 이어 감) ──
export type Cursor = { t: Fdi; s: Side; p: Pos };

/** 화면 왼→오른쪽 순서의 치아 */
export function rowTeeth(upper: boolean, thirdMolars: boolean): Fdi[] {
  return archTeeth(upper, thirdMolars);
}

/** 화면 왼→오른쪽 순서의 부위(환자 우측 치아는 D·C·M, 좌측 치아는 M·C·D) */
export function sitesInScreenOrder(t: Fdi): Pos[] {
  return isPatientRight(t) ? ["D", "C", "M"] : ["M", "C", "D"];
}

/** 한 줄(같은 턱·같은 면)의 모든 부위 — 결손 치아는 건너뜀 */
export function rowSites(upper: boolean, thirdMolars: boolean, missing: Set<Fdi>): { t: Fdi; p: Pos }[] {
  return rowTeeth(upper, thirdMolars)
    .filter((t) => !missing.has(t))
    .flatMap((t) => sitesInScreenOrder(t).map((p) => ({ t, p })));
}

/** "distal부터 앞쪽으로": 그 치아의 D에서 시작해 근심 방향(화면 기준 +1/−1) */
export function mesialDir(t: Fdi): 1 | -1 {
  return isPatientRight(t) ? 1 : -1;
}

/** 다음 칸 — 같은 줄에서 dir 방향으로 한 칸. 줄 끝이면 null */
export function stepCursor(c: Cursor, dir: 1 | -1, thirdMolars: boolean, missing: Set<Fdi>): Cursor | null {
  const sites = rowSites(isUpper(c.t), thirdMolars, missing);
  const i = sites.findIndex((x) => x.t === c.t && x.p === c.p);
  const n = sites[i + dir];
  return i < 0 || !n ? null : { t: n.t, s: c.s, p: n.p };
}

// ── 요약(저장 시 계산 — 목록·추이·기록에 담기) ────────────────────────────
export type PerioSummary = {
  sites: number;
  meanPd: number | null;
  pd4: number;
  pd6: number;
  maxPd: number | null;
  bopPct: number | null;
  pcr: number | null;
  meanCal: number | null;
  mobile: { t: Fdi; v: number }[];
  missing: Fdi[];
  implants: Fdi[];
  /** 깊은 부위(≥4) 상위 */
  deep: { t: Fdi; s: Side; p: Pos; v: number }[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarize(d: PerioData): PerioSummary {
  const ix = indexOf(d);
  const teeth = [...rowTeeth(true, d.thirdMolars), ...rowTeeth(false, d.thirdMolars)];
  const missing = teeth.filter((t) => toothVal(ix, "state", t) === "missing");
  const implants = teeth.filter((t) => toothVal(ix, "state", t) === "implant");
  const present = teeth.filter((t) => !missing.includes(t));

  const pds: { t: Fdi; s: Side; p: Pos; v: number }[] = [];
  const cals: number[] = [];
  let bleeding = 0;
  for (const t of present)
    for (const s of ["B", "L"] as Side[])
      for (const p of ["D", "C", "M"] as Pos[]) {
        const v = pdNum(siteVal(ix, "pd", t, s, p));
        if (v === null) continue;
        pds.push({ t, s, p, v });
        if (siteVal(ix, "bop", t, s, p) === true) bleeding++;
        const rec = siteVal(ix, "rec", t, s, p);
        cals.push(v + (typeof rec === "number" ? rec : 0));
      }

  const plqRecorded = d.entries.some((e) => e.m === "plq");
  const plqCount = d.entries.filter((e) => e.m === "plq" && e.v === true && present.includes(e.t)).length;

  return {
    sites: pds.length,
    meanPd: pds.length ? round1(pds.reduce((a, b) => a + b.v, 0) / pds.length) : null,
    pd4: pds.filter((x) => x.v >= 4).length,
    pd6: pds.filter((x) => x.v >= 6).length,
    maxPd: pds.length ? Math.max(...pds.map((x) => x.v)) : null,
    bopPct: pds.length ? Math.round((bleeding / pds.length) * 100) : null,
    pcr: plqRecorded && present.length ? Math.round((plqCount / (present.length * 4)) * 100) : null,
    meanCal: cals.length ? round1(cals.reduce((a, b) => a + b, 0) / cals.length) : null,
    mobile: present
      .map((t) => ({ t, v: Number(toothVal(ix, "mob", t) ?? 0) }))
      .filter((x) => x.v > 0),
    missing,
    implants,
    deep: pds.filter((x) => x.v >= 4).sort((a, b) => b.v - a.v).slice(0, 12),
  };
}

const sideLabel = (t: Fdi, s: Side) => (s === "B" ? "B" : isUpper(t) ? "P" : "L");

/** 상담 기록에 담을 복붙용 글(측정값만 — 판정 문구 없음) */
export function summaryText(d: PerioData, date: string): string {
  const s = summarize(d);
  const lines = [`[잇몸 기록 — ${date} · 측정 ${s.sites}부위]`];
  if (s.sites)
    lines.push(
      `평균 PD ${s.meanPd}mm · 4mm 이상 ${s.pd4}부위 · 6mm 이상 ${s.pd6}부위(최대 ${s.maxPd === 13 ? "F" : s.maxPd}mm)` +
        (s.meanCal !== null ? ` · 평균 CAL ${s.meanCal}mm` : ""),
    );
  const idx: string[] = [];
  if (s.bopPct !== null) idx.push(`출혈(BOP) ${s.bopPct}%`);
  if (s.pcr !== null) idx.push(`치태(PCR) ${s.pcr}%`);
  if (idx.length) lines.push(idx.join(" · "));
  const teeth: string[] = [];
  if (s.mobile.length) teeth.push(`동요: ${s.mobile.map((m) => `${m.t}(${MOB_LABEL[m.v]})`).join(", ")}`);
  if (s.missing.length) teeth.push(`결손: ${s.missing.join(", ")}`);
  if (s.implants.length) teeth.push(`임플란트: ${s.implants.join(", ")}`);
  if (teeth.length) lines.push(teeth.join(" · "));
  if (s.deep.length) lines.push(`깊은 부위: ${s.deep.map((x) => `${x.t} ${sideLabel(x.t, x.s)}-${x.p} ${x.v === 13 ? "F" : x.v}`).join(", ")}`);
  return lines.join("\n");
}
