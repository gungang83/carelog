"use client";

// spec 040 — 잇몸 기록(치주 차트) 입력 화면. ★고르고-입력하기가 아니라 "차트 위에서 바로 잰다".
//   마우스: 부위 위로 움직이면 mm 눈금이 펼쳐지고 포인터 높이 = 깊이 → 누르면 기록, 다음 칸이 숨쉰다. 치아 이동도 그냥 옆으로.
//   손가락·펜: 부위를 짚고 위아래로 끌면 깊이가 따라오고, 떼면 기록. 가로로 밀면 차트가 넘어간다.
//   면(B/P/L)은 줄이 곧 면 — 상악 협측·구개측, 하악 설측·협측 4줄.
//   키보드: 0~9, Shift+0/1/2 = 10~12, F, B(방금 칸 출혈), ←→, ↑↓(면), Backspace, Ctrl+Z.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isUpper } from "@/lib/dental/teeth";
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
} from "@/lib/oral/perio";
import { PerioChart, plaqueSurface, type PerioHover } from "@/components/oral/perio-chart";
import { saveOralExam } from "@/app/actions/oral-exams";
import { svgToPngBlob } from "@/lib/svg-to-png";

type Jaw = "all" | "upper" | "lower";

const MODES: { id: MeasureId; label: string; glyph: React.ReactNode }[] = [
  { id: "pd", label: "깊이", glyph: <rect x={5} y={2} width={4} height={10} rx={2} fill="currentColor" /> },
  { id: "rec", label: "퇴축", glyph: <path d="M2 4 Q7 11 12 4" fill="none" stroke="currentColor" strokeWidth={2} /> },
  { id: "bop", label: "출혈", glyph: <path d="M7 2 C4 6 3 8 3 9.5 A4 4 0 0 0 11 9.5 C11 8 10 6 7 2Z" fill="#ef4444" /> },
  { id: "mob", label: "동요", glyph: <path d="M2 7h10M4 4.5 2 7l2 2.5M10 4.5 12 7l-2 2.5" fill="none" stroke="currentColor" strokeWidth={1.6} /> },
  { id: "plq", label: "치태", glyph: <rect x={3} y={3} width={8} height={8} rx={2} fill="#eab308" /> },
  { id: "state", label: "결손", glyph: <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth={2} /> },
];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

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
  /** 상담 기록에 담기(상담보드) — 차트 그림 + 복붙용 글 */
  onInsert?: (image: File, text: string) => Promise<void> | void;
  onSaved?: (id: string) => void;
};

export function PerioEditor({ patient, examId, initialData, consultationId, onClose, onInsert, onSaved }: PerioEditorProps) {
  const [data, setData] = useState<PerioData>(() => normalizePerio(initialData ?? emptyPerio()));
  const [id, setId] = useState<string | null>(examId ?? null);
  const [mode, setMode] = useState<MeasureId>("pd");
  const [jaw, setJaw] = useState<Jaw>(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "upper" : "all"));
  const touchUi = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const firstTooth = rowTeeth(true, data.thirdMolars)[0];
  const [cursor, setCursor] = useState<Cursor>({ t: firstTooth, s: "B", p: "D" });
  const [dir, setDir] = useState<1 | -1>(mesialDir(firstTooth));
  const [hover, setHover] = useState<PerioHover>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const [help, setHelp] = useState(false);
  const history = useRef<PerioData[]>([]);
  const lastSite = useRef<Cursor | null>(null);
  const scrub = useRef(false);
  const chartRef = useRef<SVGSVGElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ix = useMemo(() => indexOf(data), [data]);
  const missing = useMemo(() => new Set(data.entries.filter((e) => e.m === "state" && e.v === "missing").map((e) => e.t)), [data]);
  const summary = useMemo(() => summarize(data), [data]);
  const rows = useMemo(() => (exporting || jaw === "all" ? PERIO_ROWS : PERIO_ROWS.filter((r) => r.upper === (jaw === "upper"))), [exporting, jaw]);
  const geo = useMemo(() => chartLayout({ rows, thirdMolars: data.thirdMolars, k: 6, padX: 34, top: exporting ? 24 : 8 }), [rows, data.thirdMolars, exporting]);
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

  const valueFor = useCallback(
    (hit: ChartHit): MeasureValue | null => {
      const side = hit.row.spec.side;
      if (mode === "pd") {
        if (hit.zone === "band") return null;
        if (hit.zone === "label") return hit.row.spec.rootUp === hit.y < hit.row.toothTop ? "F" : null;
        const r = siteVal(ix, "rec", hit.t, side, hit.p);
        const depth = -(typeof r === "number" ? r : 0) - hit.mm;
        if (depth < -0.6) return null;
        const n = Math.round(depth);
        return n > 15 ? "F" : Math.max(0, n);
      }
      if (mode === "rec") {
        if (hit.zone === "band" || hit.zone === "label") return null;
        return Math.max(-3, Math.min(10, Math.round(-hit.mm)));
      }
      return null;
    },
    [mode, ix],
  );

  const act = (h: NonNullable<PerioHover>) => {
    const { t, p, row } = h.hit;
    const s = row.spec.side;
    setMsg("");
    if (mode === "pd" || mode === "rec") {
      if (h.value === null) return;
      setEntry({ m: mode, t, s, p }, h.value);
      advanceFrom({ t, s, p });
    } else if (mode === "bop") {
      setEntry({ m: "bop", t, s, p }, siteVal(ix, "bop", t, s, p) === true ? undefined : true);
    } else if (mode === "plq") {
      const f = plaqueSurface(p, s);
      setEntry({ m: "plq", t, f }, surfaceVal(ix, t, f) === true ? undefined : true);
    } else if (mode === "mob") {
      const n = (Number(toothVal(ix, "mob", t) ?? 0) + 1) % 4;
      setEntry({ m: "mob", t }, n === 0 ? undefined : n);
    } else if (mode === "state") {
      const cur = toothVal(ix, "state", t);
      setEntry({ m: "state", t }, cur === undefined ? "missing" : cur === "missing" ? "implant" : undefined);
    }
  };

  const onPointer = (e: ChartPointer) => {
    if (e.type === "leave") {
      if (!scrub.current) setHover(null);
      return;
    }
    const h = e.hit ? { hit: e.hit, value: valueFor(e.hit) } : null;
    if (e.pointerType === "mouse") {
      if (e.type === "move") setHover(h);
      if (e.type === "down" && h) act(h);
      return;
    }
    // 손가락·펜: 짚고 끌어서 떼면 기록
    if (e.type === "down") {
      scrub.current = true;
      setHover(h);
    } else if (e.type === "move" && scrub.current) setHover(h);
    else if (e.type === "up" && scrub.current) {
      scrub.current = false;
      if (h) act(h);
      setHover(null);
    }
  };

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
        return setEntry({ m: "bop", t: b.t, s: b.s, p: b.p }, siteVal(ix, "bop", b.t, b.s, b.p) === true ? undefined : true);
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
      setExporting(true);
      await nextFrame();
      const svg = chartRef.current;
      if (!svg) return;
      const blob = await svgToPngBlob(svg, 2);
      setExporting(false);
      if (patient) await save(true);
      await onInsert(new File([blob], `perio_${Date.now()}.png`, { type: "image/png" }), summaryText(data, today()));
    });

  const close = () => {
    if (dirty && !confirm("저장하지 않은 입력이 있습니다. 닫을까요?")) return;
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
          {patient && <span className="max-w-28 truncate text-sm font-semibold text-slate-800">{patient.name}</span>}
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
              disabled={busy || summary.sites + summary.mobile.length + summary.missing.length === 0}
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
          <span className="mr-4">🖱 부위 위에서 위아래로 움직여 깊이 → 누르면 기록</span>
          <span className="mr-4">👆 짚고 끌었다 떼면 기록 · 옆으로 밀면 이동</span>
          <span className="mr-4">⌨ 0–9 · ⇧0/1/2=10–12 · F · B 출혈 · ←→ · ↑↓ 면 · ⌫</span>
          <span className="mr-2 text-rose-300">━ 잇몸선</span>
          <span className="mr-2 text-pink-200">▒ 잇몸</span>
          <span className="text-slate-300">┅ CEJ</span>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto px-2 py-3 sm:px-4">
        <div className="mx-auto min-w-[760px] max-w-[1400px] [@media(pointer:coarse)]:min-w-[1150px]">
          <PerioChart
            ref={chartRef}
            geo={geo}
            data={data}
            mode={mode}
            cursor={cursor}
            hover={hover}
            flash={flash}
            touch={touchUi}
            exporting={exporting}
            onPointer={onPointer}
            title={exporting ? `잇몸 기록 ${today()}${patient ? ` · ${patient.name}` : ""}` : undefined}
          />
        </div>
      </div>

      {/* 아래 막대 — 보기 도구 + 요약(숫자만) */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/70 bg-white px-3 py-2 text-xs">
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

