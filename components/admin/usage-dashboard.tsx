"use client";

import { useCallback, useEffect, useState } from "react";

// spec 013 — 사용량·크레딧 대시보드(클라). 메뉴/크레딧 두 탭 + 기간·기관 필터.

type Tab = "credits" | "menu";

interface InstitutionOpt { id: string; name: string }

interface CreditSummary {
  totalSpent: number;
  totalGranted: number;
  institutions: InstitutionOpt[];
  features: { feature: string; label: string; credits: number; count: number }[];
  byInstitution: { id: string; name: string; credits: number }[];
  topUsers: { email: string; credits: number; count: number }[];
  balances: { id: string; name: string; balance: number }[];
  recent: {
    id: string; at: string; institution: string; user: string;
    label: string; delta: number; balance_after: number; memo: string | null;
  }[];
}

interface MenuSummary {
  total: number;
  activeUsers: number;
  institutions: InstitutionOpt[];
  byInstitution: { id: string; name: string; total: number }[];
  menus: { id: string; label: string; total: number; byRole: Record<string, number> }[];
  unused: { id: string; label: string }[];
}

const DAYS_OPTIONS = [7, 30, 90, 365];
const ROLE_LABEL: Record<string, string> = { owner: "원장", admin: "관리자", staff: "직원", 기타: "기타" };

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function UsageDashboard() {
  const [tab, setTab] = useState<Tab>("credits");
  const [days, setDays] = useState(30);
  const [inst, setInst] = useState("");
  const [credit, setCredit] = useState<CreditSummary | null>(null);
  const [menu, setMenu] = useState<MenuSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = `days=${days}${inst ? `&institution=${inst}` : ""}`;
    try {
      if (tab === "credits") {
        const r = await fetch(`/api/credits/summary?${qs}`);
        setCredit(await r.json());
      } else {
        const r = await fetch(`/api/menu-usage/summary?${qs}`);
        setMenu(await r.json());
      }
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [tab, days, inst]);

  useEffect(() => {
    load();
  }, [load]);

  const institutions = (tab === "credits" ? credit?.institutions : menu?.institutions) ?? [];

  async function handleGrant() {
    if (!inst) {
      alert("충전할 기관을 먼저 선택하세요.");
      return;
    }
    const raw = prompt("부여할 크레딧 수(시뮬레이션). 차감은 음수도 가능합니다.", "1000");
    if (raw == null) return;
    const amount = Math.floor(Number(raw));
    if (!Number.isFinite(amount) || amount === 0) {
      alert("올바른 숫자를 입력하세요.");
      return;
    }
    const memo = prompt("메모(선택)", "") ?? undefined;
    const r = await fetch("/api/credits/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ institutionId: inst, amount, memo }),
    });
    const j = await r.json();
    if (j.ok) {
      alert(`충전 완료. 현재 잔액: ${fmt(j.balance)}`);
      load();
    } else {
      alert(`실패: ${j.error ?? "알 수 없는 오류"}`);
    }
  }

  return (
    <div className="space-y-5">
      {/* 탭 */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        <TabBtn active={tab === "credits"} onClick={() => setTab("credits")}>크레딧 사용량</TabBtn>
        <TabBtn active={tab === "menu"} onClick={() => setTab("menu")}>메뉴 사용량</TabBtn>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          {DAYS_OPTIONS.map((d) => (
            <option key={d} value={d}>최근 {d}일</option>
          ))}
        </select>
        <select
          value={inst}
          onChange={(e) => setInst(e.target.value)}
          className="min-w-[10rem] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="">전체 기관</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
        {tab === "credits" && (
          <button
            type="button"
            onClick={handleGrant}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
          >
            + 크레딧 충전
          </button>
        )}
        {loading && <span className="text-xs text-slate-400">불러오는 중…</span>}
      </div>

      {tab === "credits" ? <CreditView data={credit} /> : <MenuView data={menu} />}
    </div>
  );

  // ── 크레딧 뷰 ──
  function CreditView({ data }: { data: CreditSummary | null }) {
    if (!data) return <Empty />;
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="총 사용 크레딧" value={fmt(data.totalSpent)} accent="sky" />
          <Stat label="총 충전" value={fmt(data.totalGranted)} />
          <Stat label="사용 기능 수" value={fmt(data.features.length)} />
        </div>

        <Card title="기능별 사용 (어떤 기능)">
          <Table
            head={["기능", "사용 크레딧", "횟수"]}
            rows={data.features.map((f) => [f.label, fmt(f.credits), fmt(f.count)])}
            empty="사용 내역이 없습니다."
          />
        </Card>

        <Card title="사용자별 사용 (누가) · 상위 20">
          <Table
            head={["사용자", "사용 크레딧", "횟수"]}
            rows={data.topUsers.map((u) => [u.email, fmt(u.credits), fmt(u.count)])}
            empty="사용 내역이 없습니다."
          />
        </Card>

        <Card title="기관별 사용">
          <Table
            head={["기관", "사용 크레딧"]}
            rows={data.byInstitution.map((i) => [i.name, fmt(i.credits)])}
            empty="사용 내역이 없습니다."
          />
        </Card>

        <Card title="기관별 잔액">
          <Table
            head={["기관", "잔액"]}
            rows={data.balances.map((b) => [b.name, fmt(b.balance)])}
            empty="크레딧이 부여된 기관이 없습니다."
          />
        </Card>

        <Card title="최근 사용 내역 (상세)">
          <Table
            head={["일시", "기관", "사용자", "기능", "변동", "잔액"]}
            rows={data.recent.map((r) => [
              fmtDate(r.at), r.institution, r.user, r.label,
              `${r.delta > 0 ? "+" : ""}${fmt(r.delta)}`, fmt(r.balance_after),
            ])}
            empty="내역이 없습니다."
          />
        </Card>
      </div>
    );
  }

  // ── 메뉴 뷰 ──
  function MenuView({ data }: { data: MenuSummary | null }) {
    if (!data) return <Empty />;
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="총 화면 진입" value={fmt(data.total)} accent="sky" />
          <Stat label="활성 사용자" value={fmt(data.activeUsers)} />
          <Stat label="사용 메뉴 수" value={fmt(data.menus.length)} />
        </div>

        <Card title="메뉴별 사용 (역할 분해)">
          <Table
            head={["메뉴", "진입 수", "원장", "관리자", "직원"]}
            rows={data.menus.map((m) => [
              m.label, fmt(m.total),
              fmt(m.byRole.owner ?? 0), fmt(m.byRole.admin ?? 0), fmt(m.byRole.staff ?? 0),
            ])}
            empty="사용 내역이 없습니다."
          />
        </Card>

        <Card title="기관별 사용">
          <Table
            head={["기관", "진입 수"]}
            rows={data.byInstitution.map((i) => [i.name, fmt(i.total)])}
            empty="사용 내역이 없습니다."
          />
        </Card>

        {data.unused.length > 0 && (
          <Card title="미사용 메뉴">
            <div className="flex flex-wrap gap-2 p-1">
              {data.unused.map((u) => (
                <span key={u.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                  {u.label}
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "sky" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`text-2xl font-bold ${accent === "sky" ? "text-sky-600" : "text-slate-900"}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </section>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400">
            {head.map((h, i) => (
              <th key={h} className={`py-2 pr-3 ${i > 0 ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-slate-50 last:border-0">
              {r.map((c, ci) => (
                <td key={ci} className={`py-2 pr-3 ${ci > 0 ? "text-right tabular-nums text-slate-700" : "text-slate-800"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-400 shadow-sm">
      데이터를 불러오는 중입니다…
    </div>
  );
}
