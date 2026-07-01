import { ReportDateNav } from "@/components/admin/report-date-nav";
import type { DailyReport } from "@/lib/usage/daily-report";

// spec 014 — 일일 사용 리포트 표시(서버 렌더, 읽기 전용). cron 발행분/즉석 집계 공용.

const f = (n: number) => n.toLocaleString("ko-KR");
function fmtBytes(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (abs >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (abs >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function Delta({ now, prev }: { now: number; prev: number | null }) {
  if (prev == null) return null;
  const d = now - prev;
  if (d === 0) return <span className="text-xs text-slate-400"> ±0</span>;
  const up = d > 0;
  return (
    <span className={`text-xs ${up ? "text-emerald-600" : "text-rose-500"}`}>
      {" "}{up ? "▲" : "▼"}{f(Math.abs(d))}
    </span>
  );
}

export function DailyReportView({
  report,
  stored,
}: {
  report: DailyReport;
  stored: boolean;
}) {
  const s = report.summary;

  return (
    <div className="space-y-6">
      {/* 날짜 내비 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">일일 사용 리포트</h1>
          <p className="mt-1 text-sm text-slate-500">
            {report.date} (KST 0~24시) · 전체 워크스페이스 · {stored ? "발행본" : "즉석 집계"}
          </p>
        </div>
        <ReportDateNav date={report.date} />
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="워크스페이스" value={f(s.workspaces)} />
        <Stat label="화면 진입" value={f(s.menuTotal)} accent="sky" extra={<Delta now={s.menuTotal} prev={report.prev?.menuTotal ?? null} />} />
        <Stat label="활성 사용자" value={f(s.activeUsers)} />
        <Stat label="크레딧 사용" value={f(s.creditTotal)} accent="sky" extra={<Delta now={s.creditTotal} prev={report.prev?.creditTotal ?? null} />} />
        <Stat label="전사 건수" value={f(s.transcribeCount)} />
        <Stat label="토큰(입력+출력)" value={f(s.tokensIn + s.tokensOut)} />
      </div>

      {/* 인프라(서버) 상태 */}
      {report.infra && (
        <Card title="서버(인프라) 상태">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="총 스토리지" value={fmtBytes(report.infra.storageTotal)} accent="sky"
              extra={report.infra.prevStorageTotal != null
                ? <span className="text-xs text-slate-400"> {report.infra.storageTotal - report.infra.prevStorageTotal >= 0 ? "+" : ""}{fmtBytes(report.infra.storageTotal - report.infra.prevStorageTotal)}</span>
                : null} />
            <Stat label="DB 크기" value={fmtBytes(report.infra.dbBytes)} />
            <Stat label="오늘 신규 상담" value={f(report.infra.todayConsultations)} />
            <Stat label="오늘 신규 이미지·음성" value={`${f(report.infra.todayImages)} · ${f(report.infra.todayAudio)}`} />
          </div>
          {report.infra.storage.length > 0 && (
            <div className="mt-3">
              <Table
                head={["버킷(Storage)", "용량", "객체 수"]}
                rows={report.infra.storage.map((b) => [b.bucket, fmtBytes(b.bytes), f(b.objects)])}
                empty="스토리지 없음"
              />
            </div>
          )}
          <p className="mt-2 text-xs text-slate-400">
            ※ 이그레스(전송량)는 플랫폼 지표라 여기 없음 — 정확한 값은 Supabase → Usage 확인. 위 스토리지 증가량이 이그레스 조기경보 지표.
          </p>
        </Card>
      )}

      {/* 경고 신호 */}
      {report.alerts.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-amber-800">주의 신호</h3>
          <ul className="space-y-1 text-sm text-amber-800">
            {report.alerts.map((a, i) => (
              <li key={i}>{a.level === "warn" ? "⚠️" : "ℹ️"} {a.text}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 워크스페이스별 */}
      <Card title="워크스페이스별 현황">
        <Table
          head={["기관", "진입", "활성자", "크레딧", "전사", "잔액"]}
          rows={report.byWorkspace.map((w) => [w.name, f(w.menu), f(w.activeUsers), f(w.credit), f(w.transcribeCount), f(w.balance)])}
          empty="당일 사용 기관이 없습니다."
        />
      </Card>

      {/* 기능별 크레딧·토큰 */}
      <Card title="기능별 사용 (크레딧 · 토큰)">
        <Table
          head={["기능", "크레딧", "횟수", "입력토큰", "출력토큰"]}
          rows={report.byFeature.map((x) => [x.label, f(x.credits), f(x.count), f(x.tokensIn), f(x.tokensOut)])}
          empty="당일 사용 내역이 없습니다."
        />
      </Card>

      {/* 메뉴별 진입 */}
      <Card title="메뉴별 진입 (역할 분해)">
        <Table
          head={["메뉴", "진입", "원장", "관리자", "직원"]}
          rows={report.byMenu.map((m) => [m.label, f(m.total), f(m.byRole.owner ?? 0), f(m.byRole.admin ?? 0), f(m.byRole.staff ?? 0)])}
          empty="당일 진입이 없습니다."
        />
      </Card>

      {/* Top 사용자 */}
      <Card title="사용자별 사용 (누가) · 상위 20">
        <Table
          head={["사용자", "크레딧", "횟수", "입력토큰", "출력토큰"]}
          rows={report.topUsers.map((u) => [u.user, f(u.credit), f(u.count), f(u.tokensIn), f(u.tokensOut)])}
          empty="당일 사용 내역이 없습니다."
        />
      </Card>
    </div>
  );
}

function Stat({ label, value, accent, extra }: { label: string; value: string; accent?: "sky"; extra?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`text-xl font-bold ${accent === "sky" ? "text-sky-600" : "text-slate-900"}`}>
        {value}{extra}
      </div>
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
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-slate-400">{empty}</p>;
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
                <td key={ci} className={`py-2 pr-3 ${ci > 0 ? "text-right tabular-nums text-slate-700" : "text-slate-800"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
