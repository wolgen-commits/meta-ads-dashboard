"use client";
import { useState, useRef, useEffect } from "react";
import { KpiCard }         from "@/components/KpiCard";
import { SpendRoasChart }  from "@/components/SpendRoasChart";
import { EngagementChart } from "@/components/EngagementChart";
import { AudienceTable }   from "@/components/AudienceTable";
import { SyncStatus }      from "@/components/SyncStatus";
import { useKpiTotals, useCampaignList } from "@/hooks/useMetaData";

const isoDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};
const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const num = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}rb` : String(n);

function CampaignFilter({
  campaigns, selected, onChange,
}: {
  campaigns: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const allSelected = selected.length === 0 || selected.length === campaigns.length;
  const label = allSelected ? "Semua campaign" : `${selected.length} campaign dipilih`;

  return (
    <div className="cf-wrap" ref={ref}>
      <button className="cf-btn" onClick={() => setOpen(!open)}>
        <span>{label}</span>
        <span className="cf-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="cf-dropdown">
          <div className="cf-search-wrap">
            <button className="cf-all" onClick={() => onChange(allSelected ? campaigns.map((c) => c.id) : [])}>
              {allSelected ? "Pilih semua" : "Batalkan semua"}
            </button>
          </div>
          <div className="cf-list">
            {campaigns.map((c) => (
              <label key={c.id} className="cf-item">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                <span>{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [dateStart, setDateStart] = useState(isoDate(-29));
  const [dateStop,  setDateStop]  = useState(isoDate(0));
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);

  const { campaigns } = useCampaignList();
  const { totals, isLoading } = useKpiTotals(dateStart, dateStop, selectedCampaigns);

  const applyPreset = (days: number) => {
    setDateStart(isoDate(-days + 1));
    setDateStop(isoDate(0));
  };

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
        </div>
      </header>

      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label">Dari</label>
          <input type="date" className="date-input" value={dateStart} max={dateStop} onChange={(e) => setDateStart(e.target.value)} />
        </div>
        <div className="filter-group">
          <label className="filter-label">Sampai</label>
          <input type="date" className="date-input" value={dateStop} min={dateStart} max={isoDate(0)} onChange={(e) => setDateStop(e.target.value)} />
        </div>
        <div className="preset-group">
          {[7, 14, 30].map((d) => (
            <button key={d} className="preset-btn" onClick={() => applyPreset(d)}>{d} hari</button>
          ))}
        </div>
        <CampaignFilter campaigns={campaigns ?? []} selected={selectedCampaigns} onChange={setSelectedCampaigns} />
      </div>

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
        <SpendRoasChart  dateStart={dateStart} dateStop={dateStop} campaignIds={selectedCampaigns} />
        <EngagementChart dateStart={dateStart} dateStop={dateStop} campaignIds={selectedCampaigns} />
      </section>

      <section className="audience-section">
        <AudienceTable campaignIds={selectedCampaigns} />
      </section>
    </div>
  );
}
