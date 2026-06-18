"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { KpiCard }            from "@/components/KpiCard";
import { SpendRoasChart }     from "@/components/SpendRoasChart";
import { EngagementChart }    from "@/components/EngagementChart";
import { AgeChart }           from "@/components/AgeChart";
import { DemographicChart }   from "@/components/DemographicChart";
import { RegionChart }        from "@/components/RegionChart";
import { PlatformMediaChart } from "@/components/PlatformMediaChart";
import { SyncStatus }         from "@/components/SyncStatus";
import { InstagramTab }       from "@/components/InstagramTab";
import { DatabaseTab }        from "@/components/DatabaseTab";
import { useKpiTotals, useCampaignList, useObjectiveList, useAdsetList, useAdList } from "@/hooks/useMetaData";

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
  OUTCOME_AWARENESS:     "Kesadaran",
  OUTCOME_TRAFFIC:       "Lalu Lintas",
  OUTCOME_ENGAGEMENT:    "Interaksi",
  OUTCOME_LEADS:         "Prospek",
  OUTCOME_SALES:         "Penjualan",
  OUTCOME_APP_PROMOTION: "Promosi Aplikasi",
  LINK_CLICKS:           "Klik Tautan",
  PAGE_LIKES:            "Suka Halaman",
  POST_ENGAGEMENT:       "Interaksi Postingan",
  REACH:                 "Jangkauan",
  BRAND_AWARENESS:       "Kesadaran Merek",
  VIDEO_VIEWS:           "Penayangan Video",
  LEAD_GENERATION:       "Generasi Prospek",
  CONVERSIONS:           "Konversi",
  MESSAGES:              "Pesan",
};

const KPI_DESCRIPTIONS: Record<string, string> = {
  "Total Biaya":   "Total anggaran iklan yang sudah digunakan dalam periode yang dipilih.",
  "Percakapan":    "Jumlah percakapan pesan yang dimulai oleh pengguna melalui iklan (Messaging Conversations Started).",
  "Impresi":       "Jumlah total berapa kali iklan ditampilkan ke pengguna. Satu orang bisa melihat iklan yang sama lebih dari sekali.",
  "Jangkauan":     "Jumlah orang unik yang melihat iklan minimal satu kali dalam periode yang dipilih.",
  "Klik Tautan":   "Jumlah klik pada tautan (link) di dalam iklan yang mengarah ke tujuan yang ditentukan.",
  "CPC (Semua)":   "Cost Per Click (Semua) — rata-rata biaya per klik dari semua jenis klik, bukan hanya klik tautan.",
  "CTR (Semua)":   "Click-Through Rate (Semua) — persentase tayangan yang menghasilkan klik dari semua jenis klik.",
  "CPM":           "Cost Per Mille — biaya per 1.000 tayangan iklan.",
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
  const fmt = (v: string) => (formatLabel ? formatLabel(v) : v);
  const btnLabel = allSelected
    ? `Semua ${label}`
    : selected.length <= 2
      ? selected.map(fmt).join(", ")
      : `${selected.length} ${label} dipilih`;

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
  const [selectedAdsets,     setSelectedAdsets]     = useState<string[]>([]);
  const [selectedAds,        setSelectedAds]        = useState<string[]>([]);

  const { data: objectives }   = useObjectiveList();
  const { data: allCampaigns } = useCampaignList();

  const filteredCampaigns = useMemo(() => {
    if (!allCampaigns) return [];
    if (selectedObjectives.length === 0) return allCampaigns;
    return allCampaigns.filter((c) => c.objective && selectedObjectives.includes(c.objective));
  }, [allCampaigns, selectedObjectives]);

  const effectiveCampaignIds = useMemo(() => {
    if (selectedCampaigns.length > 0) return selectedCampaigns;
    if (selectedObjectives.length > 0) return filteredCampaigns.map((c) => c.id);
    return [] as string[];
  }, [selectedCampaigns, selectedObjectives, filteredCampaigns]);

  const { data: allAdsets } = useAdsetList(effectiveCampaignIds);
  const adsetIdsForAdQuery  = selectedAdsets.length > 0 ? selectedAdsets : (allAdsets?.map(a => a.id) ?? []);
  const { data: allAds }    = useAdList(adsetIdsForAdQuery, effectiveCampaignIds);

  // Effective IDs for data queries — more-specific filter wins
  const effectiveAdsetIds = useMemo(() => (selectedAds.length > 0 ? [] : selectedAdsets), [selectedAdsets, selectedAds]);
  const effectiveAdIds    = selectedAds;

  const handleObjectiveChange = (vals: string[]) => {
    setSelectedObjectives(vals);
    setSelectedCampaigns([]);
    setSelectedAdsets([]);
    setSelectedAds([]);
  };
  const handleCampaignChange = (vals: string[]) => {
    setSelectedCampaigns(vals);
    setSelectedAdsets([]);
    setSelectedAds([]);
  };
  const handleAdsetChange = (vals: string[]) => {
    setSelectedAdsets(vals);
    setSelectedAds([]);
  };

  const { totals, isLoading } = useKpiTotals(dateStart, dateStop, effectiveCampaignIds, effectiveAdsetIds, effectiveAdIds);

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <header className="dash-header">
        <div className="dash-brand">
          <span className="brand-meta">Magenta ERP</span>
          <span className="brand-sep">/</span>
          <span className="brand-title">Marketing Dashboard</span>
        </div>
        <div className="dash-controls">
          <SyncStatus />
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div className="tab-bar">
        <button className={`tab-btn ${activeTab === "ads" ? "active" : ""}`} onClick={() => setActiveTab("ads")}>
          Meta Ads
        </button>
        <button className={`tab-btn ${activeTab === "instagram" ? "active" : ""}`} onClick={() => setActiveTab("instagram")}>
          Instagram
        </button>
        <button className={`tab-btn ${activeTab === "database" ? "active" : ""}`} onClick={() => setActiveTab("database")}>
          Database
        </button>
      </div>

      {/* ── Meta Ads Tab ── */}
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
              onChange={handleCampaignChange}
              formatLabel={(id) => filteredCampaigns.find((c) => c.id === id)?.name ?? id}
            />
            <MultiSelectFilter
              label="adset"
              options={(allAdsets ?? []).map((a) => a.id)}
              selected={selectedAdsets}
              onChange={handleAdsetChange}
              formatLabel={(id) => allAdsets?.find((a) => a.id === id)?.name ?? id}
            />
            <MultiSelectFilter
              label="ad"
              options={(allAds ?? []).map((a) => a.id)}
              selected={selectedAds}
              onChange={setSelectedAds}
              formatLabel={(id) => allAds?.find((a) => a.id === id)?.name ?? id}
            />
          </div>

          <section className="kpi-grid">
            <KpiCard label="Total Biaya"   value={totals ? idr(totals.spend) : "—"} loading={isLoading} description={KPI_DESCRIPTIONS["Total Biaya"]} accent="magenta" />
            <KpiCard label="Percakapan"    value={totals ? num(totals.messaging_conversations) : "—"} sub="pesan dimulai" loading={isLoading} description={KPI_DESCRIPTIONS["Percakapan"]} />
            <KpiCard label="Impresi"       value={totals ? num(totals.impressions) : "—"} loading={isLoading} description={KPI_DESCRIPTIONS["Impresi"]} />
            <KpiCard label="Jangkauan"     value={totals ? num(totals.reach) : "—"} loading={isLoading} description={KPI_DESCRIPTIONS["Jangkauan"]} accent="info" />
            <KpiCard label="Klik Tautan"   value={totals ? num(totals.link_clicks) : "—"} loading={isLoading} description={KPI_DESCRIPTIONS["Klik Tautan"]} />
            <KpiCard label="CPC (Semua)"   value={totals ? idr(totals.cpc_all) : "—"} sub="per klik" loading={isLoading} description={KPI_DESCRIPTIONS["CPC (Semua)"]} />
            <KpiCard label="CTR (Semua)"   value={totals ? `${totals.ctr_all.toFixed(2)}%` : "—"} loading={isLoading} description={KPI_DESCRIPTIONS["CTR (Semua)"]} />
            <KpiCard label="CPM"           value={totals ? idr(totals.cpm) : "—"} sub="per 1.000 tayang" loading={isLoading} description={KPI_DESCRIPTIONS["CPM"]} />
          </section>

          <section className="charts-grid">
            <SpendRoasChart   dateStart={dateStart} dateStop={dateStop} campaignIds={effectiveCampaignIds} adsetIds={effectiveAdsetIds} adIds={effectiveAdIds} />
            <AgeChart         dateStart={dateStart} dateStop={dateStop} campaignIds={effectiveCampaignIds} />
            <DemographicChart dateStart={dateStart} dateStop={dateStop} campaignIds={effectiveCampaignIds} />
            <RegionChart      dateStart={dateStart} dateStop={dateStop} campaignIds={effectiveCampaignIds} />
            <PlatformMediaChart dateStart={dateStart} dateStop={dateStop} campaignIds={effectiveCampaignIds} />
            <EngagementChart  dateStart={dateStart} dateStop={dateStop} campaignIds={effectiveCampaignIds} adsetIds={effectiveAdsetIds} adIds={effectiveAdIds} />
          </section>

        </>
      )}

      {activeTab === "instagram" && <InstagramTab />}
      {activeTab === "database"  && <DatabaseTab />}
    </div>
  );
}
