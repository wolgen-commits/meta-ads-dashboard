"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { KpiCard }         from "@/components/KpiCard";
import { SpendRoasChart }  from "@/components/SpendRoasChart";
import { EngagementChart } from "@/components/EngagementChart";
import { AudienceTable }   from "@/components/AudienceTable";
import { SyncStatus }      from "@/components/SyncStatus";
import { InstagramTab }    from "@/components/InstagramTab";
import { DatabaseTab }     from "@/components/DatabaseTab";
import { useKpiTotals, useCampaignList, useObjectiveList } from "@/hooks/useMetaData";

const isoDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};
const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const num = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}rb` : String(n);

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_AWARENESS:     "Awareness",
  OUTCOME_TRAFFIC:       "Traffic",
  OUTCOME_ENGAGEMENT:    "Engagement",
  OUTCOME_LEADS:         "Leads",
  OUTCOME_SALES:         "Sales",
  OUTCOME_APP_PROMOTION: "App Promotion",
  LINK_CLICKS:           "Link Clicks",
  PAGE_LIKES:            "Page Likes",
  POST_ENGAGEMENT:       "Post Engagement",
  REACH:                 "Reach",
  BRAND_AWARENESS:       "Brand Awareness",
  VIDEO_VIEWS:           "Video Views",
  LEAD_GENERATION:       "Lead Generation",
  CONVERSIONS:           "Conversions",
  MESSAGES:              "Messages",
};

const KPI_DESCRIPTIONS: Record<string, string> = {
  "Total Spend":   "Total anggaran iklan yang sudah digunakan dalam periode yang dipilih. Ini adalah jumlah uang yang benar-benar terpakai dari semua campaign yang aktif.",
  "Cost per Lead": "Rata-rata biaya yang dikeluarkan untuk mendapatkan satu lead (prospek). Dihitung dari Total Spend dibagi jumlah Leads. Semakin kecil nilainya, semakin efisien iklan kamu.",
  "Impresi":       "Jumlah total berapa kali iklan kamu ditampilkan ke pengguna. Satu orang bisa melihat iklan yang sama lebih dari sekali, sehingga impresi bisa lebih besar dari reach.",
  "Reach":         "Jumlah orang unik yang melihat iklan kamu minimal satu kali dalam periode yang dipilih.",
  "Klik":          "Jumlah total klik pada iklan kamu. CTR (Click-Through Rate) adalah persentase orang yang melihat iklan lalu mengkliknya.",
  "CPC":           "Cost Per Click — rata-rata biaya yang dikeluarkan setiap kali ada orang yang mengklik iklan kamu.",
  "Pembelian":     "Jumlah transaksi pembelian yang terjadi dan dapat dilacak melalui Meta Pixel di website kamu.",
  "Leads":         "Jumlah prospek yang berhasil didapatkan dari iklan kamu.",
};

function MultiSelectFilter({
  label, options, selected, onChange, formatLabel,
}: {
  label: string; options: string[]; selected: string[];
  onChange: (vals: string[]) => void; formatLabel?: (val: string) => string;
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

  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter((x) => x !== val) : [...selected, val]);
  const allSelected = selected.length === 0 || selected.length === options.length;
  const btnLabel = allSelected ? `Semua ${label}` : `${selected.length} ${label} dipilih`;

  return (
    <div className="cf-wrap" ref={ref}>
      <button className="cf-btn" onClick={() => setOpen(!open)}>
        <span>{btnLabel}</span>
        <span className="cf-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="cf-dropdown">
          <div className="cf-search-wrap">
            <button className="cf-all" onClick={() => onChange(allSelected ? options : [])}>
              {allSelected ? "Pilih semua" : "Batalkan semua"}
            </button>
          </div>
          <div className="cf-list">
            {options.map((opt) => (
              <label key={opt} className="cf-item">
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
                <span>{formatLabel ? formatLabel(opt) : opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"ads" | "instagram" | "database">("ads");
  const [dateStart, setDateStart] = useState(isoDate(-29));
  const [dateStop,  setDateStop]  = useState(isoDate(0));
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>([]);
  const [selectedCampaigns,  setSelectedCampaigns]  = useState<string[]>([]);

  const { data: objectives }   = useObjectiveList();
  const { data: allCampaigns } = useCampaignList();

  const filteredCampaigns = useMemo(() => {
    if (!allCampaigns) return [];
    if (selectedObjectives.length === 0) return allCampaigns;
    return allCampaigns.filter((c) => c.objective && selectedObjectives.includes(c.objective));
  }, [allCampaigns, selectedObjectives]);

  const handleObjectiveChange = (vals: string[]) => {
    setSelectedObjectives(vals);
    setSelectedCampaigns([]);
  };

  const effectiveCampaignIds = useMemo(() => {
    if (selectedCampaigns.length > 0) return selectedCampaigns;
    if (selectedObjectives.length > 0) return filteredCampaigns.map((c) => c.id);
    return [] as string[];
  }, [selectedCampaigns, selectedObjectives, filteredCampaigns]);

  const { totals, isLoading } = useKpiTotals(dateStart, dateStop, effectiveCampaignIds);
  const costPerLead = totals && totals.leads > 0 ? totals.spend / totals.leads : 0;

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

      <div className="tab-bar">
        <button className={`tab-btn ${activeTab === "ads" ? "active" : ""}`} onClick={() => setActiveTab("ads")}>
          📊 Meta Ads
        </button>
        <button className={`tab-btn ${activeTab === "instagram" ? "active" : ""}`} onClick={() => setActiveTab("instagram")}>
          📸 Instagram
        </button>
        <button className={`tab-btn ${activeTab === "database" ? "active" : ""}`} onClick={() => setActiveTab("database")}>
          🗄️ Database
        </button>
      </div>

      {activeTab === "ads" && (
        <>
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
            <MultiSelectFilter
              label="jenis campaign"
              options={objectives ?? []}
              selected={selectedObjectives}
              onChange={handleObjectiveChange}
              formatLabel={(v) => OBJECTIVE_LABELS[v] ?? v}
            />
            <MultiSelectFilter
              label="campaign"
              options={filteredCampaigns.map((c) => c.id)}
              selected={selectedCampaigns}
              onChange={setSelectedCampaigns}
              formatLabel={(id) => filteredCampaigns.find((c) => c.id === id)?.name ?? id}
            />
          </div>

          <section className="kpi-grid">
            <KpiCard label="Total Spend"   value={totals ? idr(totals.spend) : "—"} loading={isLoading} description={KPI_DESCRIPTIONS["Total Spend"]} />
            <KpiCard label="Cost per Lead" value={totals ? (costPerLead > 0 ? idr(costPerLead) : "—") : "—"} sub={totals && totals.leads > 0 ? `dari ${totals.leads} leads` : "belum ada leads"} loading={isLoading} description={KPI_DESCRIPTIONS["Cost per Lead"]} />
            <KpiCard label="Impresi"       value={totals ? num(totals.impressions) : "—"} loading={isLoading} description={KPI_DESCRIPTIONS["Impresi"]} />
            <KpiCard label="Reach"         value={totals ? num(totals.reach) : "—"} loading={isLoading} description={KPI_DESCRIPTIONS["Reach"]} />
            <KpiCard label="Klik"          value={totals ? num(totals.clicks) : "—"} sub={totals ? `CTR ${totals.ctr.toFixed(2)}%` : undefined} loading={isLoading} description={KPI_DESCRIPTIONS["Klik"]} />
            <KpiCard label="CPC"           value={totals ? idr(totals.cpc) : "—"} sub="cost per click" loading={isLoading} description={KPI_DESCRIPTIONS["CPC"]} />
            <KpiCard label="Pembelian"     value={totals ? num(totals.purchases) : "—"} sub={totals ? `Nilai ${idr(totals.purchase_value)}` : undefined} loading={isLoading} description={KPI_DESCRIPTIONS["Pembelian"]} />
            <KpiCard label="Leads"         value={totals ? num(totals.leads) : "—"} loading={isLoading} description={KPI_DESCRIPTIONS["Leads"]} />
          </section>

          <section className="charts-row">
            <SpendRoasChart  dateStart={dateStart} dateStop={dateStop} campaignIds={effectiveCampaignIds} />
            <EngagementChart dateStart={dateStart} dateStop={dateStop} campaignIds={effectiveCampaignIds} />
          </section>

          <section className="audience-section">
            <AudienceTable campaignIds={effectiveCampaignIds} />
          </section>
        </>
      )}

      {activeTab === "instagram" && <InstagramTab />}
      {activeTab === "database"  && <DatabaseTab />}
    </div>
  );
}
