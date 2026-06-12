"use client";
import { useState } from "react";
import { KpiCard }         from "@/components/KpiCard";
import { SpendRoasChart }  from "@/components/SpendRoasChart";
import { EngagementChart } from "@/components/EngagementChart";
import { AudienceTable }   from "@/components/AudienceTable";
import { SyncStatus }      from "@/components/SyncStatus";
import { useKpiTotals }    from "@/hooks/useMetaData";

const PRESETS = [{ label: "7 hari", days: 7 }, { label: "14 hari", days: 14 }, { label: "30 hari", days: 30 }];

const isoDate = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().split("T")[0]; };
const idr = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const num = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}jt` : n >= 1_000 ? `${(n/1_000).toFixed(1)}rb` : String(n);

export default function DashboardPage() {
  const [preset, setPreset] = useState(7);
  const dateStop  = isoDate(0);
  const dateStart = isoDate(-preset + 1);
  const { totals, isLoading } = useKpiTotals(dateStart, dateStop);

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-brand">
          <span className="brand-meta">Meta Ads</span>
          <span className="brand-sep">/</span>
          <span className="brand-title">Performance Dashboard</span>
        </div>
        <div className="dash-controls">
          <SyncStatus />
          <div className="preset-group">
            {PRESETS.map((p) => (
              <button key={p.days} className={`preset-btn ${preset === p.days ? "active" : ""}`} onClick={() => setPreset(p.days)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="kpi-grid">
        <KpiCard label="Total Spend" value={totals ? idr(totals.spend) : "—"} loading={isLoading} />
        <KpiCard label="ROAS"        value={totals ? `${totals.roas.toFixed(2)}x` : "—"} sub="return on ad spend" loading={isLoading} />
        <KpiCard label="Impresi"     value={totals ? num(totals.impressions) : "—"} loading={isLoading} />
        <KpiCard label="Reach"       value={totals ? num(totals.reach) : "—"} loading={isLoading} />
        <KpiCard label="Klik"        value={totals ? num(totals.clicks) : "—"} sub={totals ? `CTR ${totals.ctr.toFixed(2)}%` : undefined} loading={isLoading} />
        <KpiCard label="CPC"         value={totals ? idr(totals.cpc) : "—"} sub="cost per click" loading={isLoading} />
        <KpiCard label="Pembelian"   value={totals ? num(totals.purchases) : "—"} sub={totals ? `Nilai ${idr(totals.purchase_value)}` : undefined} loading={isLoading} />
        <KpiCard label="Leads"       value={totals ? num(totals.leads) : "—"} loading={isLoading} />
      </section>

      <section className="charts-row">
        <SpendRoasChart  dateStart={dateStart} dateStop={dateStop} />
        <EngagementChart dateStart={dateStart} dateStop={dateStop} />
      </section>

      <section className="audience-section">
        <AudienceTable />
      </section>
    </div>
  );
}
