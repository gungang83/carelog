"use client";

// spec 040 1단계 — 잇몸 기록(치주 차트) 입력 화면.
// ★순서 고정 없음: 교합면에서 아무 치아·면(B/P)을 누르면 그 치아 D부터, 근심 쪽(앞쪽)으로 이어 간다.
//   차트의 아무 칸을 눌러도 거기서부터. 입력할 때마다 잇몸선·주머니가 그림에 바로 반영된다.
// 입력: ① 정면 눈금(CEJ 아래 mm 숫자)에 마우스를 올려 미리 보고 누르기 ② 숫자판 ③ 키보드(0~9, Shift+0/1/2 = 10/11/12, F, B=출혈).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dims,
  isPatientRight,
  isUpper,
  occlusalLayout,
  toothLabel,
  toothShape,
  type Fdi,
  type Matrix,
} from "@/lib/dental/teeth";
import {
  MEASURES,
  MOB_LABEL,
  PD_OPTIONS,
  REC_OPTIONS,
  emptyPerio,
  entryKey,
  indexOf,
  mesialDir,
  normalizePerio,
  pdColor,
  pdNum,
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
  type Pos,
  type Side,
  type Surface,
} from "@/lib/oral/perio";
import { PerioChart, rowTitle } from "@/components/oral/perio-chart";
import { saveOralExam } from "@/app/actions/oral-exams";
import { svgToPngBlob } from "@/lib/svg-to-png";

type Mode = Exclude<MeasureId, never>;
const MODES: { id: Mode; label: string }[] = [
  { id: "pd", label: "PD" },
  { id: "rec", label: "퇴축" },
  { id: "bop", label: "출혈" },
  { id: "mob", label: "동요도" },
  { id: "plq", label: "치태" },
  { id: "state", label: "결손·임플란트" },
];

/** 서버·브라우저 삼각함수 끝자리 차이로 생기는 hydration 경고 방지 */
const r2 = (n: number) => Math.round(n * 100) / 100;
const sideName = (t: Fdi, s: Side) => (s === "B" ? "협측(B)" : isUpper(t) ? "구개측(P)" : "설측(L)");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ── 교합면에서 치아·면 고르기 ───────────────────────────────────────────
function ArchPicker({
  data,
  cursor,
  onPick,
}: {
  data: PerioData;
  cursor: Cursor;
  onPick: (t: Fdi, s: Side) => void;
}) {
  const layout = useMemo(() => occlusalLayout({ withThirdMolars: data.thirdMolars, scale: 3.4, pad: 14 }), [data.thirdMolars]);
  const ix = useMemo(() => indexOf(data), [data]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ t: Fdi; s: Side } | null>(null);

  const local = (m: Matrix, X: number, Y: number) => {
    const [a, b, c, d, e, f] = m;
    const det = a * d - b * c;
    return { x: (d * (X - e) - c * (Y - f)) / det, y: (-b * (X - e) + a * (Y - f)) / det };
  };
  const at = (ev: React.PointerEvent<SVGSVGElement>): { t: Fdi; s: Side } | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    let best: { t: Fdi; s: Side; d: number } | null = null;
    for (const p of layout.teeth) {
      const d = Math.hypot(pt.x - p.cx, pt.y - p.cy);
      if (d > p.size * 1.15 || (best && d >= best.d)) continue;
      const l = local(p.matrix, pt.x, pt.y);
      best = { t: p.fdi, s: l.y < 0 ? "B" : "L", d };
    }
    return best ? { t: best.t, s: best.s } : null;
  };

  const worst = (t: Fdi) => {
    let m: number | null = null;
    for (const s of ["B", "L"] as Side[])
      for (const p of ["D", "C", "M"] as Pos[]) {
        const n = pdNum(siteVal(ix, "pd", t, s, p));
        if (n !== null) m = Math.max(m ?? 0, n);
      }
    return m;
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="w-full select-none"
      style={{ maxHeight: 300, touchAction: "manipulation" }}
      onPointerMove={(e) => setHover(at(e))}
      onPointerLeave={() => setHover(null)}
      onPointerDown={(e) => {
        const h = at(e);
        if (h) onPick(h.t, h.s);
      }}
    >
      {layout.teeth.map((p) => {
        const missing = toothVal(ix, "state", p.fdi) === "missing";
        const implant = toothVal(ix, "state", p.fdi) === "implant";
        const w = worst(p.fdi);
        const sel = cursor.t === p.fdi;
        const hov = hover?.t === p.fdi;
        const bl = dims(p.fdi).bl;
        const dot = (s: Side) => {
          const ly = (s === "B" ? -1 : 1) * bl * 0.3;
          const [, , c, d, e, f] = p.matrix;
          return { x: r2(c * ly + e), y: r2(d * ly + f) };
        };
        return (
          <g key={p.fdi} style={{ cursor: "pointer" }}>
            <g transform={`matrix(${p.matrix.map(r2).join(" ")})`}>
              <path
                d={p.shape.crown}
                fill={missing ? "none" : w !== null ? pdColor(w) : implant ? "#e2e8f0" : "#fffdf7"}
                fillOpacity={w !== null && !missing ? 0.35 : 1}
                stroke={sel ? "#0284c7" : hov ? "#38bdf8" : "#94a3b8"}
                strokeWidth={(sel ? 0.55 : 0.25) / 1}
                strokeDasharray={missing ? "0.8 0.6" : undefined}
              />
            </g>
            {(sel || hov) &&
              (["B", "L"] as Side[]).map((s) => {
                const on = (sel && cursor.s === s) || (hov && hover?.s === s);
                const q = dot(s);
                return on ? <circle key={s} cx={q.x} cy={q.y} r={3.4} fill={sel && cursor.s === s ? "#0284c7" : "#7dd3fc"} /> : null;
              })}
            <text x={r2(p.cx)} y={r2(p.cy + 2.5)} textAnchor="middle" fontSize={7} fill={missing ? "#cbd5e1" : "#475569"} pointerEvents="none">
              {p.fdi}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── 정면 눈금(그림에서 고르기) ──────────────────────────────────────────
function ToothLadder({
  data,
  cursor,
  mode,
  onPick,
}: {
  data: PerioData;
  cursor: Cursor;
  mode: "pd" | "rec";
  onPick: (p: Pos, v: MeasureValue) => void;
}) {
  const ix = useMemo(() => indexOf(data), [data]);
  const [hover, setHover] = useState<{ p: Pos; v: MeasureValue } | null>(null);
  const t = cursor.t;
  const s = cursor.s;
  const dm = dims(t);
  const KY = 15;
  const KX = Math.max(KY, 170 / dm.md);
  const upper = isUpper(t);
  const rootShow = 18;
  const crownShow = dm.crown + 1;
  const W = dm.md * KX + 80;
  const H = (rootShow + crownShow) * KY + 20;
  const cej = upper ? 10 + rootShow * KY : 10 + crownShow * KY;
  const sy = upper ? KY : -KY; // 로컬 +y(치관) → 화면
  const toY = (ly: number) => cej + ly * sy;
  const sx = (isPatientRight(t) ? -1 : 1) * KX;
  const cx = W / 2;
  const siteX = (p: Pos) => cx + (p === "D" ? 0.3 : p === "M" ? -0.3 : 0) * dm.md * sx;
  const order: Pos[] = isPatientRight(t) ? ["D", "C", "M"] : ["M", "C", "D"];
  const shape = toothShape(t, "facial");

  const recOf = (p: Pos) => {
    if (mode === "rec" && hover?.p === p) return Number(hover.v);
    const r = siteVal(ix, "rec", t, s, p);
    return typeof r === "number" ? r : 0;
  };
  const pdOf = (p: Pos): number | null => {
    if (mode === "pd" && hover?.p === p) return hover.v === "F" ? dm.root : Number(hover.v);
    const v = siteVal(ix, "pd", t, s, p);
    return v === "F" ? dm.root : pdNum(v);
  };
  const gmPts = order.map((p) => `${siteX(p)},${toY(-recOf(p))}`).join(" ");
  const pocket = order.every((p) => pdOf(p) !== null)
    ? [...order.map((p) => `${siteX(p)},${toY(-recOf(p))}`), ...[...order].reverse().map((p) => `${siteX(p)},${toY(-recOf(p) - (pdOf(p) ?? 0))}`)].join(" ")
    : null;

  const options = mode === "pd" ? PD_OPTIONS : REC_OPTIONS;
  const yFor = (p: Pos, v: MeasureValue) => (mode === "pd" ? toY(-recOf(p) - (v === "F" ? 16.6 : Number(v))) : toY(-Number(v)));
  const current = (p: Pos) => siteVal(ix, mode, t, s, p);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-1 text-xs text-slate-500">
        {toothLabel(t)} · {sideName(t, s)} — {mode === "pd" ? "잇몸선 아래 숫자에 올려 보고 누르세요" : "잇몸선 위치(CEJ 기준 mm)를 고르세요"}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="max-w-full select-none" style={{ touchAction: "manipulation" }} onPointerLeave={() => setHover(null)}>
        {/* 잇몸(분홍) */}
        <polygon
          points={`${siteX(order[0]) - 30},${toY(-recOf(order[0]))} ${gmPts} ${siteX(order[2]) + 30},${toY(-recOf(order[2]))} ${siteX(order[2]) + 30},${upper ? 0 : H} ${siteX(order[0]) - 30},${upper ? 0 : H}`}
          fill="#fbcfe8"
          opacity={0.7}
        />
        <g transform={`matrix(${sx} 0 0 ${sy} ${cx} ${cej})`}>
          {shape.root && <path d={shape.root} fill="#f1e3c8" stroke="#94a3b8" strokeWidth={0.1} opacity={0.9} />}
          <path d={shape.crown} fill="#fffdf7" stroke="#94a3b8" strokeWidth={0.1} />
        </g>
        {pocket ? (
          <polygon points={pocket} fill="#3b82f6" opacity={0.35} stroke="#2563eb" strokeWidth={1.4} />
        ) : (
          order.map((p) => {
            const n = pdOf(p);
            if (n === null) return null;
            const y0 = toY(-recOf(p));
            const y1 = toY(-recOf(p) - n);
            return <rect key={`pk-${p}`} x={siteX(p) - 5} y={Math.min(y0, y1)} width={10} height={Math.abs(y1 - y0)} fill="#3b82f6" opacity={0.4} rx={3} />;
          })
        )}
        <polyline points={gmPts} fill="none" stroke="#e11d48" strokeWidth={2} />
        <line x1={4} x2={W - 4} y1={cej} y2={cej} stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={0.8} />
        <text x={4} y={cej - 3} fontSize={9} fill="#64748b">
          CEJ
        </text>
        {order.map((p) => (
          <g key={p}>
            <text x={siteX(p)} y={upper ? H - 4 : 12} textAnchor="middle" fontSize={11} fontWeight={700} fill={cursor.p === p ? "#0284c7" : "#64748b"}>
              {p}
            </text>
            {options.map((v) => {
              const y = yFor(p, v);
              if (y < 6 || y > H - 6) return null;
              const on = current(p) === v;
              const hv = hover?.p === p && hover.v === v;
              return (
                <g
                  key={String(v)}
                  style={{ cursor: "pointer" }}
                  onPointerEnter={() => setHover({ p, v })}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onPick(p, v);
                  }}
                >
                  <circle cx={siteX(p)} cy={y} r={7} fill={on ? "#0284c7" : hv ? "#bae6fd" : "#ffffff"} stroke={cursor.p === p ? "#0284c7" : "#cbd5e1"} strokeWidth={1} opacity={0.95} />
                  <text x={siteX(p)} y={y + 3.3} textAnchor="middle" fontSize={9} fontWeight={600} fill={on ? "#ffffff" : "#334155"} pointerEvents="none">
                    {String(v)}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── 편집기 ──────────────────────────────────────────────────────────────
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
  const [mode, setMode] = useState<Mode>("pd");
  const firstTooth = rowTeeth(true, data.thirdMolars)[0];
  const [cursor, setCursor] = useState<Cursor>({ t: firstTooth, s: "B", p: "D" });
  const [dir, setDir] = useState<1 | -1>(mesialDir(firstTooth));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const history = useRef<PerioData[]>([]);
  /** 방금 숫자를 넣은 칸 — B(출혈)는 이 칸에 표시(입력하면 커서는 다음 칸으로 가 있으므로) */
  const [lastSite, setLastSite] = useState<Cursor | null>(null);
  const chartRef = useRef<SVGSVGElement>(null);
  const ix = useMemo(() => indexOf(data), [data]);
  const missing = useMemo(
    () => new Set(data.entries.filter((e) => e.m === "state" && e.v === "missing").map((e) => e.t)),
    [data],
  );
  const summary = useMemo(() => summarize(data), [data]);

  const commit = useCallback((next: PerioData) => {
    setData((prev) => {
      history.current.push(prev);
      if (history.current.length > 100) history.current.shift();
      return next;
    });
    setDirty(true);
  }, []);

  const setEntry = useCallback(
    (loc: Omit<Entry, "v" | "at" | "src">, v: MeasureValue | undefined, src: Entry["src"] = "click") => {
      setData((prev) => {
        history.current.push(prev);
        const key = entryKey(loc);
        const rest = prev.entries.filter((e) => entryKey(e) !== key);
        const entries = v === undefined ? rest : [...rest, { ...loc, v, at: new Date().toISOString(), src }];
        return { ...prev, entries };
      });
      setDirty(true);
    },
    [],
  );

  const undo = () => {
    const prev = history.current.pop();
    if (prev) setData(prev);
  };

  const advance = (from: Cursor) => {
    const next = stepCursor(from, dir, data.thirdMolars, missing);
    if (next) setCursor(next);
    else setMsg(`${rowTitle(from.t, from.s)} 줄 끝입니다 — 다른 칸을 누르면 거기서 이어집니다.`);
  };

  const enterSite = (v: MeasureValue, src: Entry["src"] = "click", at: Cursor = cursor) => {
    if (mode !== "pd" && mode !== "rec") return;
    setMsg("");
    setEntry({ m: mode, t: at.t, s: at.s, p: at.p }, v, src);
    setLastSite(at);
    advance(at);
  };

  const toggleBop = (c: Cursor) => {
    const cur = siteVal(ix, "bop", c.t, c.s, c.p) === true;
    setEntry({ m: "bop", t: c.t, s: c.s, p: c.p }, cur ? undefined : true);
  };

  const pickTooth = (t: Fdi, s: Side) => {
    setMsg("");
    setLastSite(null);
    setCursor({ t, s, p: "D" });
    setDir(mesialDir(t));
  };

  const clickSite = (t: Fdi, s: Side, p: Pos) => {
    setMsg("");
    setLastSite(null);
    const c = { t, s, p };
    if (cursor.t === t && cursor.s === s && cursor.p !== p) {
      // 같은 치아 안에서 옮기면 그 방향을 진행 방향으로
      const order = isPatientRight(t) ? ["D", "C", "M"] : ["M", "C", "D"];
      setDir(order.indexOf(p) > order.indexOf(cursor.p) ? 1 : -1);
    }
    setCursor(c);
    if (mode === "bop") toggleBop(c);
  };

  const moveTooth = (step: 1 | -1) => {
    const teeth = rowTeeth(isUpper(cursor.t), data.thirdMolars).filter((t) => !missing.has(t));
    const i = teeth.indexOf(cursor.t);
    const n = teeth[i + step];
    if (n) setCursor({ ...cursor, t: n });
  };

  // 키보드
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (mode === "pd" || mode === "rec") {
        const m = e.code.match(/^(?:Digit|Numpad)(\d)$/);
        if (m) {
          e.preventDefault();
          const n = Number(m[1]);
          enterSite(e.shiftKey && n <= 2 ? 10 + n : n, "keypad");
          return;
        }
        if (mode === "pd" && e.key.toLowerCase() === "f") return enterSite("F", "keypad");
        if (mode === "rec" && e.key === "-") return; // 음수는 숫자판
      }
      if (e.key.toLowerCase() === "b") return toggleBop(lastSite ?? cursor);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const d = e.key === "ArrowRight" ? 1 : -1;
        setDir(d);
        const n = stepCursor(cursor, d, data.thirdMolars, missing);
        if (n) setCursor(n);
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor({ ...cursor, s: cursor.s === "B" ? "L" : "B" });
      }
      if (e.key === "Backspace" && (mode === "pd" || mode === "rec")) {
        e.preventDefault();
        setEntry({ m: mode, t: cursor.t, s: cursor.s, p: cursor.p }, undefined);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });

  const save = async (done = false): Promise<string | null> => {
    if (!patient) {
      setMsg("환자가 연결되지 않아 잇몸 기록 회차로는 저장하지 않습니다(상담 기록에 담기는 가능).");
      return null;
    }
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
      const svg = chartRef.current;
      if (!svg || !onInsert) return;
      const blob = await svgToPngBlob(svg, 2);
      const file = new File([blob], `perio_${Date.now()}.png`, { type: "image/png" });
      if (patient) await save(true);
      await onInsert(file, summaryText(data, today()));
    });

  const close = () => {
    if (dirty && !confirm("저장하지 않은 입력이 있습니다. 닫을까요?")) return;
    onClose();
  };

  const seg = (on: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${on ? "bg-sky-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`;
  const keyBtn = (on: boolean) =>
    `min-w-10 rounded-lg border px-2.5 py-2 text-sm font-semibold transition ${on ? "border-sky-600 bg-sky-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-sky-50"}`;

  const curVal = mode === "pd" || mode === "rec" || mode === "bop" ? siteVal(ix, mode, cursor.t, cursor.s, cursor.p) : toothVal(ix, mode, cursor.t);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-50">
      {/* 머리 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <h2 className="mr-1 text-base font-bold text-slate-900">🦷 잇몸 기록</h2>
        {patient && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">{patient.name}</span>}
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={seg(mode === m.id)} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={data.thirdMolars} onChange={(e) => commit({ ...data, thirdMolars: e.target.checked })} />
          사랑니
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={undo} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            ↩ 되돌리기
          </button>
          {patient && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (await save()) setMsg("저장했습니다.");
                })
              }
              className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-40"
            >
              저장
            </button>
          )}
          {onInsert && (
            <button type="button" disabled={busy || summary.sites + summary.mobile.length + summary.missing.length === 0} onClick={() => void insert()} className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40">
              {busy ? "담는 중…" : "기록에 담기"}
            </button>
          )}
          <button type="button" onClick={close} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            닫기
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-auto p-3 lg:grid-cols-[380px_1fr]">
        {/* 왼쪽: 치아·면 고르기 + 입력 */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>치아의 바깥쪽 = 협측(B) · 안쪽 = 구개·설측(P/L) — 누르면 그 치아 D부터 앞쪽으로</span>
            </div>
            <ArchPicker data={data} cursor={cursor} onPick={pickTooth} />
            <div className="mt-1 text-center text-sm font-semibold text-slate-800">
              {cursor.t}번 · {sideName(cursor.t, cursor.s)} · {cursor.p} <span className="text-xs font-normal text-slate-400">(진행 {dir === 1 ? "→" : "←"})</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            {(mode === "pd" || mode === "rec") && (
              <>
                <ToothLadder data={data} cursor={cursor} mode={mode} onPick={(p, v) => enterSite(v, "click", { ...cursor, p })} />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(mode === "pd" ? PD_OPTIONS : REC_OPTIONS).map((v) => (
                    <button key={String(v)} type="button" className={keyBtn(curVal === v)} onClick={() => enterSite(v, "keypad")}>
                      {String(v)}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(() => {
                    const b = lastSite ?? cursor;
                    return (
                      <button type="button" onClick={() => toggleBop(b)} className={keyBtn(siteVal(ix, "bop", b.t, b.s, b.p) === true)} title="방금 입력한 칸(없으면 지금 칸)에 출혈 표시">
                        🩸 출혈 {b.t} {b.p}
                      </button>
                    );
                  })()}
                  <button type="button" onClick={() => setEntry({ m: mode, t: cursor.t, s: cursor.s, p: cursor.p }, undefined)} className={keyBtn(false)}>
                    지우기
                  </button>
                  <button type="button" onClick={() => { const n = stepCursor(cursor, -1, data.thirdMolars, missing); if (n) setCursor(n); }} className={keyBtn(false)}>
                    ← 칸
                  </button>
                  <button type="button" onClick={() => { const n = stepCursor(cursor, 1, data.thirdMolars, missing); if (n) setCursor(n); }} className={keyBtn(false)}>
                    칸 →
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">키보드: 숫자 0~9 · Shift+0/1/2 = 10/11/12 · F = full depth · B = 방금 칸 출혈 · ←→ 칸 이동 · ↑↓ 면 바꾸기 · Ctrl+Z 되돌리기</p>
              </>
            )}
            {mode === "bop" && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">차트의 칸이나 아래 부위를 누르면 출혈 표시/해제됩니다.</p>
                <div className="flex gap-1.5">
                  {(isPatientRight(cursor.t) ? ["D", "C", "M"] : ["M", "C", "D"]).map((p) => (
                    <button key={p} type="button" className={keyBtn(siteVal(ix, "bop", cursor.t, cursor.s, p as Pos) === true)} onClick={() => toggleBop({ ...cursor, p: p as Pos })}>
                      {cursor.t} {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {mode === "mob" && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">{toothLabel(cursor.t)} 흔들림</p>
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3].map((v) => (
                    <button key={v} type="button" className={keyBtn(Number(curVal ?? 0) === v)} onClick={() => { setEntry({ m: "mob", t: cursor.t }, v === 0 ? undefined : v); moveTooth(dir); }}>
                      {MOB_LABEL[v]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {mode === "plq" && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">{toothLabel(cursor.t)} — 치태가 묻은 면을 누르세요(O&apos;Leary)</p>
                <div className="grid w-40 grid-cols-3 gap-1">
                  {([[null, "B", null], ["M", null, "D"], [null, "L", null]] as (Surface | null)[][]).flat().map((f, i) =>
                    f ? (
                      <button key={i} type="button" className={keyBtn(surfaceVal(ix, cursor.t, f) === true)} onClick={() => setEntry({ m: "plq", t: cursor.t, f }, surfaceVal(ix, cursor.t, f) === true ? undefined : true)}>
                        {f === "L" && isUpper(cursor.t) ? "P" : f}
                      </button>
                    ) : (
                      <span key={i} />
                    ),
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button type="button" className={keyBtn(false)} onClick={() => moveTooth(-1)}>
                    ← 치아
                  </button>
                  <button type="button" className={keyBtn(false)} onClick={() => moveTooth(1)}>
                    치아 →
                  </button>
                </div>
              </div>
            )}
            {mode === "state" && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">{toothLabel(cursor.t)}</p>
                <div className="flex gap-1.5">
                  {[
                    { v: undefined, label: "있음" },
                    { v: "missing", label: "결손" },
                    { v: "implant", label: "임플란트" },
                  ].map((o) => (
                    <button key={o.label} type="button" className={keyBtn(curVal === o.v)} onClick={() => setEntry({ m: "state", t: cursor.t }, o.v)}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">교합면에서 치아를 차례로 눌러 표시하세요. 결손 치아는 차트·순서에서 빠집니다.</p>
              </div>
            )}
            {msg && <p className="mt-2 text-xs text-amber-700">{msg}</p>}
          </div>
        </div>

        {/* 오른쪽: 차트 + 요약 */}
        <div className="min-w-0 space-y-3">
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white p-2">
            <PerioChart ref={chartRef} data={data} cursor={cursor} onSiteClick={clickSite} title={`잇몸 기록 ${today()}${patient ? ` · ${patient.name}` : ""}`} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>측정 {summary.sites}부위</span>
              {summary.meanPd !== null && <span>평균 PD {summary.meanPd}mm</span>}
              <span className="text-amber-700">4mm↑ {summary.pd4}</span>
              <span className="text-red-600">6mm↑ {summary.pd6}</span>
              {summary.bopPct !== null && <span>출혈 {summary.bopPct}%</span>}
              {summary.pcr !== null && <span>치태 {summary.pcr}%</span>}
              {summary.meanCal !== null && <span>평균 CAL {summary.meanCal}mm</span>}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {MEASURES.pd.plain} · 빨간 선 = 잇몸선 · 파란 부분 = 잇몸 주머니 · 점선 = CEJ. 수치는 측정값이며 판정을 담지 않습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
