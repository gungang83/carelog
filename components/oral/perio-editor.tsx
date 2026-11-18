"use client";

// spec 040 — 잇몸 기록(치주 차트) 입력 화면. ★고르고-입력하기가 아니라 "차트 위에서 바로 잰다".
//   마우스: 부위 위로 움직이면 mm 눈금이 펼쳐지고 포인터 높이 = 깊이 → 누르면 기록, 다음 칸이 숨쉰다. 치아 이동도 그냥 옆으로.
//   손가락·펜: 부위를 짚고 위아래로 끌면 깊이가 따라오고, 떼면 기록. 가로로 밀면 차트가 넘어간다.
//   면(B/P/L)은 줄이 곧 면 — 상악 협측·구개측, 하악 설측·협측 4줄.
//   키보드: 0~9, Shift+0/1/2 = 10~12, F, B(방금 칸 출혈), ←→, ↑↓(면), Backspace, Ctrl+Z.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { readViewMode, writeViewMode, type ViewMode } from "@/lib/dental/view-mode";
import { isUpper, type Fdi } from "@/lib/dental/teeth";
import { PERIO_ROWS, chartLayout, siteX, sitesLeftToRight, type ChartHit } from "@/lib/dental/chart";
import type { ChartPointer } from "@/components/dental/dental-chart";
import {
  emptyPerio,
  entryKey,
  indexOf,
  mesialDir,
  normalizePerio,
  rowSites,
  rowTeeth,
  siteVal,
  stepCursor,
  summarize,
  summaryText,
  surfaceVal,
  toothVal,
  type Cursor,
  type Entry,
  type MeasureId,
  type MeasureValue,
  type PerioData,
  MOB_LABEL,
  type Pos,
  type Side,
} from "@/lib/oral/perio";
import { PerioChart, bopDropY, plaqueSurface } from "@/components/oral/perio-chart";
import { pickFromHit, type PerioPick } from "@/lib/oral/perio-pick";
import { describeCtx, parsePerioUtterance, previewActions, type VoiceAction } from "@/lib/oral/perio-voice";
import { interpretPerioUtterance } from "@/app/actions/perio-voice";
import { usePerioVoice } from "@/components/oral/use-perio-voice";

/** 말로 입력 한 문장의 결과(화면 아래 목록) */
type VoiceLine = {
  id: string;
  text: string;
  summary: string;
  filled: number;
  ai?: boolean;
  pending?: boolean;
  note?: string;
  /** 길거나 수상해서 보류한 해석 — [그래도 적용]으로 넣는다 */
  held?: VoiceAction[];
};

/** bop = 2D에서 부위의 출혈 점(토글)을 가리킴 */
type EditorHover = { pick: PerioPick; value: MeasureValue | null; hit?: ChartHit; bop?: boolean } | null;

// three.js는 3D를 고를 때만 불러온다
const Perio3D = dynamic(() => import("@/components/oral/perio-3d"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-slate-400">3D 불러오는 중…</div>,
});
const VIEW_KEY = "carelog.perio.view";
import { saveOralExam } from "@/app/actions/oral-exams";
import { svgToPngBlob } from "@/lib/svg-to-png";
import type { PerioSnapshot } from "@/lib/oral/perio-store";

type Jaw = "all" | "upper" | "lower";

const MODES: { id: MeasureId; label: string; glyph: React.ReactNode }[] = [
  { id: "pd", label: "깊이", glyph: <rect x={5} y={2} width={4} height={10} rx={2} fill="currentColor" /> },
  { id: "rec", label: "퇴축", glyph: <path d="M2 4 Q7 11 12 4" fill="none" stroke="currentColor" strokeWidth={2} /> },
  // 출혈(BOP)은 따로 메뉴 없이 깊이·퇴축을 재며 부위의 빨간 점으로(§16)
  { id: "mob", label: "동요·타진", glyph: <path d="M2 7h10M4 4.5 2 7l2 2.5M10 4.5 12 7l-2 2.5" fill="none" stroke="currentColor" strokeWidth={1.6} /> },
  { id: "plq", label: "치태", glyph: <rect x={3} y={3} width={8} height={8} rx={2} fill="#eab308" /> },
  { id: "state", label: "결손", glyph: <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth={2} /> },
];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** 동요도·타진 반응 카드 — 단계 칩을 누르면 기록, 같은 칩을 다시 누르면 지움 */
function ToothCard({
  t,
  mob,
  perc,
  onSet,
  onClose,
}: {
  t: Fdi;
  mob: number | undefined;
  perc: number | undefined;
  onSet: (m: "mob" | "perc", v: number) => void;
  onClose?: () => void;
}) {
  const row = (m: "mob" | "perc", label: string, cur: number | undefined) => (
    <div className="flex items-center gap-1.5">
      <span className="w-7 text-[11px] font-bold text-slate-500">{label}</span>
      {MOB_LABEL.map((l, v) => (
        <button
          key={v}
          type="button"
          onClick={() => onSet(m, v)}
          className={`h-7 min-w-9 rounded-lg px-1.5 text-xs font-extrabold transition active:scale-90 ${
            cur === v ? (v === 0 ? "bg-slate-700 text-white" : "bg-rose-600 text-white shadow-sm") : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
  return (
    <div className="absolute right-4 top-4 z-10 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur sm:right-5 sm:top-5">
      <div key={t} className="perio-pop flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-base font-black text-white">{t}</div>
      <div className="flex flex-col gap-1">
        {row("mob", "동요", mob)}
        {row("perc", "타진", perc)}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="self-start text-slate-400 hover:text-slate-600" aria-label="닫기">
          ✕
        </button>
      )}
    </div>
  );
}

function ArchGlyph({ jaw }: { jaw: Jaw }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      {jaw !== "lower" && <path d="M4 9 Q10 0 16 9" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />}
      {jaw !== "upper" && <path d="M4 11 Q10 20 16 11" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />}
    </svg>
  );
}

export type PerioEditorProps = {
  patient?: { id: string; name: string } | null;
  examId?: string | null;
  initialData?: PerioData | null;
  consultationId?: string | null;
  onClose: () => void;
  /** 상담 기록에 담기(상담보드) — 차트 그림 + 복붙용 글 + 다시 열기용 기록 */
  onInsert?: (image: File, text: string, snapshot: PerioSnapshot) => Promise<void> | void;
  onSaved?: (id: string) => void;
  /** 기록 날짜(다시 열어 고칠 때 원래 날짜 유지) — 없으면 오늘 */
  date?: string;
};

export function PerioEditor({ patient, examId, initialData, consultationId, onClose, onInsert, onSaved, date }: PerioEditorProps) {
  const day = date ?? today();
  const [data, setData] = useState<PerioData>(() => normalizePerio(initialData ?? emptyPerio()));
  const [id, setId] = useState<string | null>(examId ?? null);
  const [mode, setMode] = useState<MeasureId>("pd");
  const [jaw, setJaw] = useState<Jaw>(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "upper" : "all"));
  const touchUi = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const firstTooth = rowTeeth(true, data.thirdMolars)[0];
  const [cursor, setCursor] = useState<Cursor>({ t: firstTooth, s: "B", p: "D" });
  const [dir, setDir] = useState<1 | -1>(mesialDir(firstTooth));
  const [hover, setHover] = useState<EditorHover>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const [help, setHelp] = useState(false);
  const [view, setViewState] = useState<ViewMode>(() => readViewMode(VIEW_KEY));
  const setView = (v: ViewMode) => {
    setViewState(v);
    writeViewMode(VIEW_KEY, v);
    setHover(null);
    setCardTooth(null);
  };
  const [follow, setFollow] = useState(true);
  /** 동요·타진 카드의 치아 — 3D는 고른 치아, 2D는 동요·타진 모드에서 누른 치아 */
  const [cardTooth, setCardTooth] = useState<Fdi | null>(null);
  const history = useRef<PerioData[]>([]);
  const lastSite = useRef<Cursor | null>(null);
  /** 말로 입력 — 문장 결과 목록 · 3D가 그 치아로 옮겨 가라는 요청 */
  const [voiceLog, setVoiceLog] = useState<VoiceLine[]>([]);
  const [focusReq, setFocusReq] = useState<{ t: Fdi; s: Side; n: number } | null>(null);
  const scrub = useRef(false);
  const chartRef = useRef<SVGSVGElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ix = useMemo(() => indexOf(data), [data]);
  const missing = useMemo(() => new Set(data.entries.filter((e) => e.m === "state" && e.v === "missing").map((e) => e.t)), [data]);
  const summary = useMemo(() => summarize(data), [data]);
  const rows = useMemo(() => (exporting || jaw === "all" ? PERIO_ROWS : PERIO_ROWS.filter((r) => r.upper === (jaw === "upper"))), [exporting, jaw]);
  const geo = useMemo(() => chartLayout({ rows, thirdMolars: data.thirdMolars, k: 6, padX: 52, jawHeader: 30, jawGap: 16, top: exporting ? 24 : 8 }), [rows, data.thirdMolars, exporting]);
  // 전체 부위 수 = (위턱 + 아래턱 한 줄 부위) × 두 면
  const totalSites = useMemo(
    () => 2 * (rowSites(true, data.thirdMolars, missing).length + rowSites(false, data.thirdMolars, missing).length),
    [data.thirdMolars, missing],
  );

  // ── 기록 바꾸기 ──
  const setEntry = useCallback((loc: Omit<Entry, "v" | "at" | "src">, v: MeasureValue | undefined, src: Entry["src"] = "click") => {
    setData((prev) => {
      history.current.push(prev);
      if (history.current.length > 200) history.current.shift();
      const key = entryKey(loc);
      const rest = prev.entries.filter((e) => entryKey(e) !== key);
      return { ...prev, entries: v === undefined ? rest : [...rest, { ...loc, v, at: new Date().toISOString(), src }] };
    });
    setFlash(entryKey(loc));
    setDirty(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(6);
  }, []);

  const undo = () => {
    const prev = history.current.pop();
    if (prev) setData(prev);
  };

  /** 방금 칸 다음으로 — 직전 칸과의 방향을 이어 간다(처음은 근심=앞쪽) */
  const advanceFrom = (site: Cursor) => {
    let d = dir;
    const prev = lastSite.current;
    if (prev && prev.s === site.s && isUpper(prev.t) === isUpper(site.t)) {
      const order = rowSites(isUpper(site.t), data.thirdMolars, missing);
      const a = order.findIndex((x) => x.t === prev.t && x.p === prev.p);
      const b = order.findIndex((x) => x.t === site.t && x.p === site.p);
      if (a >= 0 && b >= 0 && a !== b && Math.abs(b - a) <= 3) d = b > a ? 1 : -1;
    } else if (!prev) d = mesialDir(site.t);
    setDir(d);
    lastSite.current = site;
    const next = stepCursor(site, d, data.thirdMolars, missing);
    if (next) setCursor(next);
  };

  /** 가리킨 곳 → 지금 모드의 값(깊이·퇴축). 2D·3D 공용 */
  const valueFor = useCallback(
    (pk: PerioPick): MeasureValue | null => {
      if (mode === "pd") {
        if (pk.zone === "band") return null;
        if (pk.zone === "beyond") return "F";
        const r = siteVal(ix, "rec", pk.t, pk.s, pk.p);
        const depth = -(typeof r === "number" ? r : 0) - pk.mm;
        if (depth < -0.6) return null;
        const n = Math.round(depth);
        return n > 15 ? "F" : Math.max(0, n);
      }
      if (mode === "rec") {
        if (pk.zone === "band" || pk.zone === "beyond") return null;
        return Math.max(-3, Math.min(10, Math.round(-pk.mm)));
      }
      return null;
    },
    [mode, ix],
  );

  const act = (pk: PerioPick, value: MeasureValue | null) => {
    const { t, p, s } = pk;
    setMsg("");
    if (mode === "pd" || mode === "rec") {
      if (value === null) return;
      setEntry({ m: mode, t, s, p }, value);
      advanceFrom({ t, s, p });
    } else if (mode === "bop") {
      setEntry({ m: "bop", t, s, p }, siteVal(ix, "bop", t, s, p) === true ? undefined : true);
    } else if (mode === "plq") {
      const f = plaqueSurface(p, s);
      setEntry({ m: "plq", t, f }, surfaceVal(ix, t, f) === true ? undefined : true);
    } else if (mode === "mob") {
      setCardTooth(t); // 동요·타진 카드에서 고른다
    } else if (mode === "state") {
      const cur = toothVal(ix, "state", t);
      setEntry({ m: "state", t }, cur === undefined ? "missing" : cur === "missing" ? "implant" : undefined);
    }
  };

  /** 출혈 점 토글 — 2D 점·3D 점·키보드 B 공용 */
  const toggleBop = (t: Fdi, s: Side, p: Pos) => setEntry({ m: "bop", t, s, p }, siteVal(ix, "bop", t, s, p) === true ? undefined : true);
  /** 동요·타진 — 같은 값을 다시 누르면 지움(− 음성도 기록으로 남는다) */
  const setTooth = (m: "mob" | "perc", t: Fdi, v: number) => setEntry({ m, t }, toothVal(ix, m, t) === v ? undefined : v);

  // ── 말로 입력(spec 040 §5-3) ── 문장마다: 해석 → 한 번에 기록(되돌리기·[검토] 단위) → 커서·방향·지표 갱신
  //   ★막지 않고 받아 적는다: 말로 넣은 값은 "검토 전"(review) — 칸을 눌러 고치면 그 값이 확정, [검토 끝]으로 모두 확정.
  const latest = useRef({ cursor, dir, mode, data, missing });
  useLayoutEffect(() => {
    latest.current = { cursor, dir, mode, data, missing };
  });
  /** dry = 미리보기(말하는 중) — 어디에 들어갈지만 계산하고 기록하지 않는다 */
  const applyVoice = (acts: VoiceAction[], utt: { id: string; text: string }, dry = false): { summary: string; filled: number; note?: string } => {
    const L = latest.current;
    let cur: Cursor | null = L.cursor;
    let d: 1 | -1 = L.dir;
    let m: "pd" | "rec" = L.mode === "rec" ? "rec" : "pd";
    let entries = [...L.data.entries];
    const miss = new Set(L.missing);
    const at = new Date().toISOString();
    const added: Entry[] = [];
    const parts: string[] = [];
    let last: Cursor | null = null;
    let note: string | undefined;
    let moved = false;
    const put = (loc: Omit<Entry, "v" | "at" | "src">, v: MeasureValue) => {
      const key = entryKey(loc);
      entries = entries.filter((e) => entryKey(e) !== key);
      const e: Entry = { ...loc, v, at, src: "voice", review: true, utt: utt.id };
      entries.push(e);
      added.push(e);
    };
    const nextTooth = (c: Cursor): Cursor | null => {
      let n: Cursor | null = c;
      while (n && n.t === c.t) n = stepCursor(n, d, L.data.thirdMolars, miss);
      return n;
    };
    for (const a of acts) {
      if (a.k === "ctx") {
        const prevCur: Cursor | null = cur;
        const t: Fdi = a.t ?? prevCur?.t ?? L.cursor.t;
        const side: Side = a.s ?? prevCur?.s ?? "B";
        if (a.toward) d = a.toward === "M" ? mesialDir(t) : (-mesialDir(t) as 1 | -1);
        else if (a.p === "D") d = mesialDir(t);
        else if (a.p === "M") d = -mesialDir(t) as 1 | -1;
        else if (a.t) d = mesialDir(t);
        const p: Pos = a.p ?? (a.t ? (d === mesialDir(t) ? "D" : "M") : prevCur?.p ?? "D");
        if (a.mode) m = a.mode;
        cur = miss.has(t) ? null : { t, s: side, p };
        if (!cur) note = `${t}은 결손으로 표시돼 있어요`;
        moved = true;
        parts.push(describeCtx(a));
      } else if (a.k === "val") {
        if (!cur) {
          note ??= "줄 끝 — 다음 위치를 말해 주세요";
          continue;
        }
        const v = a.v;
        const ok = m === "pd" ? v === "F" || (typeof v === "number" && v >= 0 && v <= 15) : typeof v === "number" && v >= -3 && v <= 10;
        if (!ok) {
          note = `${v}은 ${m === "pd" ? "깊이" : "퇴축"} 값이 아니에요`;
          continue;
        }
        put({ m, t: cur.t, s: cur.s, p: cur.p }, v);
        parts.push(`${cur.t}${cur.p} ${v}`);
        last = cur;
        cur = stepCursor(cur, d, L.data.thirdMolars, miss);
      } else if (a.k === "bop") {
        // 출혈·동요·타진은 "방금 잰 곳"에 — 문장이 따로 와도(“3 2 3” → “출혈”) 직전에 기록한 칸
        const site = last ?? lastSite.current ?? cur;
        if (site) {
          put({ m: "bop", t: site.t, s: site.s, p: site.p }, true);
          parts.push(`${site.t}${site.p} 출혈`);
        }
      } else if (a.k === "mob" || a.k === "perc") {
        const t = (last ?? lastSite.current ?? cur)?.t;
        if (t) {
          put({ m: a.k, t }, a.v);
          parts.push(`${t} ${a.k === "mob" ? "동요" : "타진"} ${MOB_LABEL[a.v]}`);
        }
      } else if (a.k === "missing") {
        const c = cur ?? last;
        if (c) {
          const n = nextTooth(c);
          put({ m: "state", t: c.t }, "missing");
          miss.add(c.t);
          parts.push(`${c.t} 결손`);
          cur = n && { ...n, p: d === mesialDir(n.t) ? "D" : "M" };
        }
      } else if (a.k === "undo") {
        const gone = added.pop() ?? [...entries].filter((e) => e.src === "voice").sort((x, y) => (x.at ?? "").localeCompare(y.at ?? "")).pop();
        if (gone) {
          entries = entries.filter((e) => e !== gone && entryKey(e) !== entryKey(gone));
          if (gone.s && gone.p) cur = { t: gone.t, s: gone.s, p: gone.p };
          parts.push("취소");
        }
      } else if (a.k === "skip") {
        if (cur) cur = stepCursor(cur, d, L.data.thirdMolars, miss);
        parts.push("건너뛰기");
      }
    }
    if (!parts.length) return { summary: "", filled: 0, note };
    if (dry) return { summary: parts.join(" · "), filled: added.length, note };
    setData((prev) => {
      history.current.push(prev);
      if (history.current.length > 200) history.current.shift();
      return { ...prev, entries, utterances: [...(prev.utterances ?? []), { id: utt.id, text: utt.text, at }].slice(-300) };
    });
    setDirty(true);
    if (last) {
      lastSite.current = last;
      setFlash(entryKey({ m, t: last.t, s: last.s, p: last.p }));
    }
    const pos = cur ?? last;
    if (pos) setCursor(pos);
    setDir(d);
    if (m !== L.mode) setMode(m);
    if (moved && pos) setFocusReq({ t: pos.t, s: pos.s, n: Date.now() });
    return { summary: parts.join(" · "), filled: added.length, note };
  };
  const onVoiceText = async (text: string) => {
    const id = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    let acts = parsePerioUtterance(text, voiceFix.current);
    let ai = false;
    // ★안전장치: 긴 문장(잘못 알아들은 문장일 가능성)·값이 너무 많음·긴 문장 속 "결손"은 바로 넣지 않고 보류
    const values = acts.filter((a) => a.k === "val").length;
    const compact = text.replace(/\s/g, "");
    if (compact.length > 90 || values > 18 || (acts.some((a) => a.k === "missing") && compact.length > 12)) {
      setVoiceLog((l) => [
        ...l.slice(-30),
        { id, text, summary: previewActions(acts).join(" · ") || "해석 없음", filled: 0, note: "길거나 애매해서 넣지 않았어요", held: acts },
      ]);
      return;
    }
    if (!acts.length && text.replace(/\s/g, "").length >= 4) {
      setVoiceLog((l) => [...l.slice(-30), { id, text, summary: "해석 중…", filled: 0, pending: true }]);
      acts = await interpretPerioUtterance(text);
      ai = true;
    }
    const r = applyVoice(acts, { id, text });
    setVoiceLog((l) => {
      const line: VoiceLine = { id, text, summary: r.summary || "기록할 말이 없었어요", filled: r.filled, ai, note: r.note };
      return l.some((x) => x.id === id) ? l.map((x) => (x.id === id ? line : x)) : [...l.slice(-30), line];
    });
  };
  const voice = usePerioVoice(onVoiceText);
  const voiceFix = useRef<[string, string][]>([]);
  useLayoutEffect(() => {
    voiceFix.current = voice.corrections;
  });
  // 개발 중 자동 점검용 — 말 대신 문장을 넣어 본다(배포 빌드에선 빠짐)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __perioSay?: (t: string) => Promise<void>; __perioPartial?: (t: string) => void };
    w.__perioSay = onVoiceText;
    w.__perioPartial = voice.simulate;
  });
  /** 보류한 해석을 그래도 넣기 */
  const applyHeld = (line: VoiceLine) => {
    if (!line.held) return;
    const r = applyVoice(line.held, { id: line.id, text: line.text });
    setVoiceLog((l) => l.map((x) => (x.id === line.id ? { ...x, summary: r.summary || x.summary, filled: r.filled, note: r.note, held: undefined } : x)));
  };
  /** 한 문장이 넣은 값 되돌리기 */
  const undoUtterance = (uid: string) => {
    setData((prev) => {
      history.current.push(prev);
      return { ...prev, entries: prev.entries.filter((e) => e.utt !== uid) };
    });
    setVoiceLog((l) => l.map((x) => (x.id === uid ? { ...x, summary: `${x.summary} → 되돌림`, filled: 0 } : x)));
    setDirty(true);
  };
  const reviewCount = useMemo(() => data.entries.filter((e) => e.review).length, [data]);
  const finishReview = () => {
    setData((prev) => ({ ...prev, entries: prev.entries.map((e) => (e.review ? { ...e, review: undefined } : e)) }));
    setDirty(true);
  };

  /** 포인터 공용 처리 — 마우스: 올리면 미리보기·누르면 기록 / 손가락·펜: 짚고 끌어 떼면 기록 */
  const handlePick = (type: "move" | "down" | "up" | "leave", pointerType: string, pk: PerioPick | null, hit?: ChartHit | null) => {
    if (type === "leave") {
      if (!scrub.current) setHover(null);
      return;
    }
    // 2D: 깊이·퇴축을 재다가 부위의 출혈 점을 가리키면 그 점을 토글(따로 출혈 메뉴 없음)
    const onBop = !!pk && !!hit && (mode === "pd" || mode === "rec") && hit.zone === "band" && Math.abs(hit.y - bopDropY(hit.row)) <= 7;
    const h: EditorHover = pk ? { pick: pk, value: onBop ? null : valueFor(pk), hit: hit ?? undefined, bop: onBop } : null;
    const commit = (x: NonNullable<EditorHover>) => (x.bop ? toggleBop(x.pick.t, x.pick.s, x.pick.p) : act(x.pick, x.value));
    if (pointerType === "mouse") {
      if (type === "move") setHover(h);
      if (type === "down" && h) commit(h);
      return;
    }
    if (type === "down") {
      scrub.current = true;
      setHover(h);
    } else if (type === "move" && scrub.current) setHover(h);
    else if (type === "up" && scrub.current) {
      scrub.current = false;
      if (h) commit(h);
      setHover(null);
    }
  };

  const onPointer = (e: ChartPointer) => handlePick(e.type, e.pointerType, e.hit ? pickFromHit(e.hit) : null, e.hit);

  // 다음 칸이 화면 밖이면 부드럽게 따라간다(폰)
  useEffect(() => {
    const box = scrollRef.current;
    const svg = chartRef.current;
    if (!box || !svg || box.scrollWidth <= box.clientWidth) return;
    const x = (siteX(geo, cursor.t, cursor.p) / geo.width) * svg.clientWidth;
    if (x < box.scrollLeft + 40 || x > box.scrollLeft + box.clientWidth - 40) box.scrollTo({ left: x - box.clientWidth / 2, behavior: "smooth" });
  }, [cursor, geo]);

  // 키보드
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "z") {
        e.preventDefault();
        return undo();
      }
      if (mode === "pd" || mode === "rec") {
        const m = e.code.match(/^(?:Digit|Numpad)(\d)$/);
        let v: MeasureValue | null = null;
        if (m) v = e.shiftKey && Number(m[1]) <= 2 ? 10 + Number(m[1]) : Number(m[1]);
        else if (mode === "pd" && key === "f") v = "F";
        if (v !== null) {
          e.preventDefault();
          setEntry({ m: mode, t: cursor.t, s: cursor.s, p: cursor.p }, v, "keypad");
          advanceFrom(cursor);
          return;
        }
      }
      if (key === "b") {
        const b = lastSite.current ?? cursor;
        return toggleBop(b.t, b.s, b.p);
      }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const d = e.key === "ArrowRight" ? 1 : -1;
        setDir(d);
        lastSite.current = null;
        const n = stepCursor(cursor, d, data.thirdMolars, missing);
        if (n) setCursor(n);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor({ ...cursor, s: cursor.s === "B" ? "L" : "B" });
      } else if (e.key === "Backspace" && (mode === "pd" || mode === "rec")) {
        e.preventDefault();
        setEntry({ m: mode, t: cursor.t, s: cursor.s, p: cursor.p }, undefined);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });

  const save = async (done = false): Promise<string | null> => {
    if (!patient) return null;
    const r = await saveOralExam({ id, patientId: patient.id, consultationId, data, done });
    if (!r.ok) {
      setMsg(r.message);
      return null;
    }
    setId(r.id);
    setDirty(false);
    onSaved?.(r.id);
    return r.id;
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const insert = () =>
    run(async () => {
      if (!onInsert) return;
      setHover(null);
      const was = view;
      if (was === "3d") setViewState("2d");
      setExporting(true);
      await nextFrame();
      const svg = chartRef.current;
      if (!svg) return;
      const blob = await svgToPngBlob(svg, 2);
      setExporting(false);
      if (was === "3d") setViewState("3d");
      const savedId = patient ? await save(true) : null;
      await onInsert(new File([blob], `perio_${Date.now()}.png`, { type: "image/png" }), summaryText(data, day), {
        v: 1,
        date: day,
        data,
        examId: savedId ?? id,
        patientId: patient?.id ?? null,
      });
    });

  const close = () => {
    if (dirty && !confirm("저장하지 않은 입력이 있습니다. 닫을까요?")) return;
    voice.stop();
    onClose();
  };

  const pct = totalSites ? Math.min(1, summary.sites / totalSites) : 0;
  const iconBtn = "flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:bg-slate-50 active:scale-95";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-slate-50 to-white">
      {/* 머리 — 글 대신 모양 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 bg-white/90 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 36 36" className="h-9 w-9" aria-label={`측정 ${summary.sites}/${totalSites}`}>
            <circle cx={18} cy={18} r={15} fill="none" stroke="#e2e8f0" strokeWidth={4} />
            <circle
              cx={18}
              cy={18}
              r={15}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={`${(pct * 94.25).toFixed(1)} 94.25`}
              transform="rotate(-90 18 18)"
              style={{ transition: "stroke-dasharray 400ms ease" }}
            />
            <text x={18} y={21.5} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="#0f172a">
              {summary.sites}
            </text>
          </svg>
          {patient?.name && <span className="max-w-28 truncate text-sm font-semibold text-slate-800">{patient.name}</span>}
        </div>

        <div className="order-3 flex w-full gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 md:order-none md:w-auto">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setHover(null);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${
                mode === m.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 text-sky-600" aria-hidden>
                {m.glyph}
              </svg>
              {m.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {patient && !onInsert && (
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={() =>
                void run(async () => {
                  if (await save()) setMsg("저장했습니다.");
                })
              }
              className="h-9 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 active:scale-95 disabled:opacity-40"
            >
              저장
            </button>
          )}
          {onInsert && (
            <button
              type="button"
              disabled={busy || summary.sites + summary.mobile.length + summary.percussion.length + summary.missing.length === 0}
              onClick={() => void insert()}
              className="h-9 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 active:scale-95 disabled:opacity-40"
            >
              {busy ? "…" : "담기"}
            </button>
          )}
          <button type="button" onClick={close} className={iconBtn} aria-label="닫기">
            ✕
          </button>
        </div>
      </div>

      {help && (
        <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-xs leading-6 text-slate-100">
          {view === "3d" && <span className="mr-4 text-sky-300">3D · 치아를 누르면 그 면 정면으로 · 치관을 다시 누르면 바깥⇄안쪽 · 끌면 그 치아 중심으로 돌리기</span>}
          <span className="mr-4">🖱 부위 위에서 위아래로 움직여 깊이 → 누르면 기록</span>
          <span className="mr-4">👆 짚고 끌었다 떼면 기록 · 옆으로 밀면 이동</span>
          <span className="mr-4">⌨ 0–9 · ⇧0/1/2=10–12 · F · B 출혈 · ←→ · ↑↓ 면 · ⌫</span>
          <span className="mr-4 text-rose-200">🎙 “17번 바깥 원심부터 근심 방향 깊이” → “3 2 3 …” · 출혈 · 퇴축 2 · 동요 투플러스 · 취소 (연한 숫자 = 말로 넣어 검토 전)</span>
          <span className="mr-2 text-pink-200">▒ 잇몸(윗변 = 잇몸선)</span>
          <span className="text-slate-300">┅ CEJ</span>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
      {/* 동요·타진 카드 — 3D는 고른 치아를 따라 바뀌고(치아를 옮겨 다니며 바로 기록), 2D는 동요·타진 모드에서 누른 치아 */}
      {cardTooth && !exporting && (view === "3d" || mode === "mob") && (
        <ToothCard
          t={cardTooth}
          mob={toothVal(ix, "mob", cardTooth) as number | undefined}
          perc={toothVal(ix, "perc", cardTooth) as number | undefined}
          onSet={(m, v) => setTooth(m, cardTooth, v)}
          onClose={view === "2d" ? () => setCardTooth(null) : undefined}
        />
      )}
      {view === "3d" && !exporting ? (
        <div className="relative min-h-0 flex-1 p-2 sm:p-3">
          <Perio3D
            data={data}
            mode={mode}
            jaw={jaw}
            cursor={cursor}
            hover={hover ? { pick: hover.pick, value: hover.value } : null}
            follow={follow}
            onPick={(type, pointerType, pk) => handlePick(type, pointerType, pk)}
            onTap={(pk) => act(pk, valueFor(pk))}
            onFocus={setCardTooth}
            onBop={toggleBop}
            focusRequest={focusReq}
            className="h-full w-full"
          />
        </div>
      ) : (
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto px-2 py-3 sm:px-4">
        <div className="mx-auto min-w-[760px] max-w-[1400px] [@media(pointer:coarse)]:min-w-[1150px]">
          <PerioChart
            ref={chartRef}
            geo={geo}
            data={data}
            mode={mode}
            cursor={cursor}
            hover={hover?.hit ? { hit: hover.hit, value: hover.value, bop: hover.bop } : null}
            flash={flash}
            touch={touchUi}
            exporting={exporting}
            onPointer={onPointer}
            title={exporting ? `잇몸 기록 ${day}${patient?.name ? ` · ${patient.name}` : ""}` : undefined}
          />
        </div>
      </div>
      )}
      </div>

      {/* 말로 기록 — ①지금 말하는 것(실시간 자막 + 해석 미리보기) ②방금 기록된 문장(해석 결과) ③지난 문장들 */}
      {(voice.status !== "off" || voiceLog.length > 0 || voice.error) && !exporting && (() => {
        const lastLine = voiceLog[voiceLog.length - 1];
        // 말하는 중 미리보기 — 실제로 어느 칸에 들어갈지(기록은 문장이 끝나야)
        const liveActs = voice.partial ? parsePerioUtterance(voice.partial, voice.corrections) : [];
        const liveDry = liveActs.length ? applyVoice(liveActs, { id: "preview", text: voice.partial }, true) : null;
        const livePreview = liveDry?.summary ? liveDry.summary.split(" · ") : previewActions(liveActs);
        return (
          <div className="border-t border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-200 sm:px-4">
            {/* 상태 줄 */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-bold">
                <span
                  className={`inline-block size-2.5 rounded-full ${
                    voice.status === "live" ? "animate-pulse bg-red-500" : voice.status === "connecting" ? "animate-pulse bg-amber-400" : "bg-slate-500"
                  }`}
                />
                {voice.status === "live" ? "듣는 중" : voice.status === "connecting" ? "연결 중…" : voice.status === "error" ? "멈춤" : "말로 기록"}
              </span>
              {voice.status === "live" && (
                <span className="flex h-2 w-20 overflow-hidden rounded-full bg-white/10" title="마이크 소리 크기">
                  <span className="h-full rounded-full bg-emerald-400 transition-[width] duration-100" style={{ width: `${Math.round(voice.level * 100)}%` }} />
                </span>
              )}
              <span className="rounded-full bg-white/10 px-2 py-0.5">
                다음 칸 · {mode === "rec" ? "퇴축" : "깊이"} · <b className="text-sky-300">{cursor.t}</b> {cursor.s === "B" ? "바깥" : "안쪽"} {cursor.p}{" "}
                {dir === mesialDir(cursor.t) ? "→근심" : "→원심"}
              </span>
              {voice.error && <span className="text-amber-300">{voice.error}</span>}
              <span className="ml-auto flex items-center gap-1.5">
                {reviewCount > 0 && (
                  <button type="button" onClick={finishReview} className="rounded-lg bg-white/10 px-2 py-1 font-semibold text-white hover:bg-white/20" title="말로 넣은 값을 확인했으면 확정">
                    검토 끝 ({reviewCount})
                  </button>
                )}
                {voice.status === "off" && voiceLog.length > 0 && (
                  <button type="button" onClick={() => setVoiceLog([])} className="rounded-lg px-2 py-1 text-slate-400 hover:text-white">
                    목록 닫기
                  </button>
                )}
              </span>
            </div>

            {/* ① 지금 말하는 것 — 크게, 해석 미리보기와 함께 */}
            {voice.status === "live" && (
              <div className="mt-2 rounded-xl bg-white/5 px-3 py-2">
                <p className={`min-h-7 text-lg font-semibold leading-7 ${voice.partial ? "text-white" : "text-slate-500"}`}>
                  {voice.partial ? `“${voice.partial}”` : "말씀하세요… (예: 17번 바깥 원심부터 근심 방향 깊이 → 3 2 3)"}
                </p>
                {livePreview.length > 0 && (
                  <p className="mt-0.5 flex flex-wrap gap-1 text-xs">
                    <span className="text-slate-400">이렇게 알아듣는 중 →</span>
                    {livePreview.map((x, i) => (
                      <span key={i} className="rounded bg-sky-500/20 px-1.5 text-sky-200">
                        {x}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            )}

            {/* ② 방금 기록된 문장 — 들은 말 그대로 + 실제로 넣은 것 */}
            {lastLine && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/10 px-3 py-2">
                <span className="text-sm text-slate-300">“{lastLine.text}”</span>
                <span className="text-slate-500">→</span>
                <span className={`text-sm font-semibold ${lastLine.pending ? "text-slate-400" : lastLine.filled ? "text-emerald-300" : lastLine.held ? "text-amber-200" : "text-slate-400"}`}>
                  {lastLine.ai && !lastLine.pending ? "AI · " : ""}
                  {lastLine.summary}
                </span>
                {lastLine.note && <span className="text-xs text-amber-300">· {lastLine.note}</span>}
                <span className="ml-auto flex gap-1">
                  {lastLine.held && (
                    <button type="button" onClick={() => applyHeld(lastLine)} className="rounded-lg bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/30">
                      그래도 넣기
                    </button>
                  )}
                  {lastLine.filled > 0 && (
                    <button type="button" onClick={() => undoUtterance(lastLine.id)} className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20">
                      되돌리기
                    </button>
                  )}
                </span>
              </div>
            )}

            {/* ③ 지난 문장들 */}
            {voiceLog.length > 1 && (
              <ul className="mt-1.5 flex max-h-20 flex-col gap-0.5 overflow-y-auto text-xs">
                {voiceLog
                  .slice(0, -1)
                  .reverse()
                  .map((l) => (
                    <li key={l.id} className="flex items-center gap-2">
                      <span className="max-w-[45%] truncate text-slate-500" title={l.text}>
                        “{l.text}”
                      </span>
                      <span className={l.filled ? "text-emerald-400/80" : l.held ? "text-amber-300/80" : "text-slate-500"}>
                        {l.ai && !l.pending ? "AI · " : ""}
                        {l.summary}
                      </span>
                      {l.note && <span className="text-amber-300/80">· {l.note}</span>}
                      <span className="ml-auto flex shrink-0 gap-1">
                        {l.held && (
                          <button type="button" onClick={() => applyHeld(l)} className="rounded px-1.5 text-amber-200 hover:bg-white/10">
                            그래도 넣기
                          </button>
                        )}
                        {l.filled > 0 && (
                          <button type="button" onClick={() => undoUtterance(l.id)} className="rounded px-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                            되돌리기
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        );
      })()}

      {/* 아래 막대 — 보기 도구 + 요약(숫자만) */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/70 bg-white px-3 py-2 text-xs">
        <button
          type="button"
          onClick={() => (voice.status === "live" || voice.status === "connecting" ? voice.stop() : void voice.start())}
          className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition active:scale-95 ${
            voice.status === "live" ? "bg-red-600 text-white shadow-sm" : voice.status === "connecting" ? "bg-amber-500 text-white" : "border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
          }`}
          title="말로 기록 — 위치·방향을 말하고 숫자를 부르면 차례로 채웁니다"
        >
          🎙 {voice.status === "live" ? "그만" : voice.status === "connecting" ? "연결 중…" : "말로 기록"}
        </button>
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
          {(["2d", "3d"] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`h-8 rounded-lg px-2.5 text-xs font-bold transition ${view === v ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>
        {view === "3d" && (
          <button
            type="button"
            onClick={() => setFollow((f) => !f)}
            title="기록해서 다음 칸이 다른 치아로 넘어가면 화면도 그쪽으로"
            className={`h-9 rounded-xl border px-2.5 text-xs font-bold transition ${follow ? "border-sky-600 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-400"}`}
          >
            ↻ 따라 보기
          </button>
        )}
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
          {(["upper", "all", "lower"] as Jaw[]).map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => setJaw(j)}
              aria-label={j === "upper" ? "위턱" : j === "lower" ? "아래턱" : "전체"}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${jaw === j ? "bg-sky-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
            >
              <ArchGlyph jaw={j} />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setData((d) => ({ ...d, thirdMolars: !d.thirdMolars }))}
          className={`h-9 rounded-xl border px-2.5 text-xs font-bold transition ${data.thirdMolars ? "border-sky-600 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-400"}`}
          title="사랑니"
        >
          8
        </button>
        <button type="button" onClick={undo} className={iconBtn} aria-label="되돌리기" title="되돌리기 (Ctrl+Z)">
          ↩
        </button>
        <button type="button" onClick={() => setHelp((v) => !v)} className={iconBtn} aria-label="도움말">
          ?
        </button>
        <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
        {summary.meanPd !== null && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">평균 {summary.meanPd}mm</span>}
        <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">4+ {summary.pd4}</span>
        <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700">6+ {summary.pd6}</span>
        {summary.bopPct !== null && <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">출혈 {summary.bopPct}%</span>}
        {summary.pcr !== null && <span className="rounded-full bg-yellow-50 px-2.5 py-1 font-semibold text-yellow-700">치태 {summary.pcr}%</span>}
        {summary.meanCal !== null && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">CAL {summary.meanCal}</span>}
        <span className="ml-auto flex items-center gap-1 text-slate-400">
          {sitesLeftToRight(cursor.t).length > 0 && (
            <>
              다음 <b className="text-sky-700">{cursor.t}</b> {cursor.s === "B" ? "B" : isUpper(cursor.t) ? "P" : "L"} {cursor.p} {dir === 1 ? "→" : "←"}
            </>
          )}
        </span>
        {msg && <span className="w-full text-amber-700">{msg}</span>}
      </div>
    </div>
  );
}

