"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  ComposedChart, Bar, Line,
  BarChart, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { KpiCard } from "@/components/KpiCard";
import {
  useGoogleCampaigns,
  useGoogleKpiTotals,
  useGoogleDailyChart,
  useGoogleCampaignSummary,
  useGoogleAdGroupSummary,
  useGoogleKeywordSummary,
  useGoogleSearchTermSummary,
  useGoogleDeviceSummary,
  useGoogleAds,
  useGoogleAgeSummary,
  useGoogleGenderSummary,
  useGoogleGeoSummary,
  useGoogleLocationTargeting,
  useGoogleHourSummary,
  useGoogleCitySummary,
  useGoogleAuctionInsightsSummary,
  useGoogleAdPerfDailySummary,
  useGoogleAssets,
  useGoogleConversionActionsSummary,
  useGoogleNetworkSummary,
  useGoogleLandingPagesSummary,
} from "@/hooks/useGoogleData";

// â”€â”€ Formatting helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const isoDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

const num = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}jt`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}rb`
    : String(Math.round(n));

const pct = (n: number) => `${n.toFixed(1)}%`;

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });

// Safe variants for Recharts formatter (value comes in as unknown)
const safeNum = (v: unknown) => num(Number(v ?? 0));
const safeIdr = (v: unknown) => idr(Number(v ?? 0));

// â”€â”€ Color maps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  SEARCH:     "Search",
  DISPLAY:    "Display",
  SHOPPING:   "Shopping",
  VIDEO:      "Video",
  SMART:      "Smart",
  HOTEL:      "Hotel",
  DISCOVERY:  "Discovery",
  DEMAND_GEN: "Demand Gen",
};

// â”€â”€ Shared style helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const INPUT_STYLE: React.CSSProperties = {
  border: "1px solid var(--gray-200)",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
  background: "var(--surface)",
  color: "var(--gray-800)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 13,
  color: "var(--gray-500)",
  fontWeight: 500,
};

const TH_STYLE: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  color: "var(--gray-500)",
  letterSpacing: "0.05em",
  whiteSpace: "nowrap",
  borderBottom: "2px solid var(--gray-100)",
};

const TD_STYLE: React.CSSProperties = {
  padding: "10px 12px",
  color: "var(--gray-700)",
  borderBottom: "1px solid var(--gray-100)",
};

// â”€â”€ Date preset definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PRESETS = [
  { label: "7H",  days: 6 },
  { label: "30H", days: 29 },
  { label: "90H", days: 89 },
  { label: "6B",  days: 179 },
  { label: "1T",  days: 364 },
] as const;


// â”€â”€ Empty state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Empty({ msg }: { msg: string }) {
  return <div className="chart-empty">{msg}</div>;
}

// â”€â”€ Row hover helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function hoverRow(e: React.MouseEvent<HTMLTableRowElement>, enter: boolean) {
  e.currentTarget.style.background = enter ? "var(--gray-50)" : "";
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function GoogleAdsTab() {
  // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [dateStart, setDateStart] = useState(isoDate(-29));
  const [dateStop, setDateStop] = useState(isoDate(0));
  const [selectedCampaigns, setSelected] = useState<string[]>([]);
  const [sortCol, setSortCol] = useState<
    "spend" | "clicks" | "impressions" | "conversions"
  >("spend");
  const [hourView,              setHourView]              = useState<"hour" | "day">("hour");
  const [campaignDropdownOpen,  setCampaignDropdownOpen]  = useState(false);
  const campaignDropdownRef = useRef<HTMLDivElement>(null);
  const [adsAudienceTab,        setAdsAudienceTab]        = useState<"age" | "gender" | "device">("age");
  const [adsGeoTab,      setAdsGeoTab]      = useState<"country" | "hour" | "targeting">("country");
  const [adsKwTab1,      setAdsKwTab1]      = useState<"keywords" | "search_terms">("keywords");
  const [adsKwTab2,      setAdsKwTab2]      = useState<"adgroups" | "ads">("adgroups");
  const [adsIklanView,   setAdsIklanView]   = useState<"kreatif" | "performa">("kreatif");
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (campaignDropdownRef.current && !campaignDropdownRef.current.contains(e.target as Node)) {
        setCampaignDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const applyPreset = (days: number) => {
    setDateStart(isoDate(-days));
    setDateStop(isoDate(0));
  };

  // â”€â”€ Google Ads hooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { data: allCampaigns } = useGoogleCampaigns();
  const { totals: gTotals, isLoading: gLoading } = useGoogleKpiTotals(
    dateStart,
    dateStop,
    selectedCampaigns
  );
  const { dailyChart, isLoading: chartLoading } = useGoogleDailyChart(
    dateStart,
    dateStop,
    selectedCampaigns
  );
  const { campaignSummary } = useGoogleCampaignSummary(
    dateStart,
    dateStop,
    selectedCampaigns
  );
  const { summary: adgroupSummary, isLoading: agLoading }  = useGoogleAdGroupSummary(dateStart, dateStop, selectedCampaigns);
  const { summary: keywordSummary, isLoading: kwLoading }  = useGoogleKeywordSummary(dateStart, dateStop, selectedCampaigns);
  const { summary: stSummary,      isLoading: stLoading }  = useGoogleSearchTermSummary(dateStart, dateStop, selectedCampaigns);
  const { summary: deviceSummary,  isLoading: devLoading } = useGoogleDeviceSummary(dateStart, dateStop, selectedCampaigns);
  const { data: adsList, isLoading: adsLoading, error: adsError } = useGoogleAds(selectedCampaigns);
  const { summary: ageSummary,      isLoading: ageLoading }   = useGoogleAgeSummary(dateStart, dateStop, selectedCampaigns);
  const { summary: genderSummary,   isLoading: gnrLoading }   = useGoogleGenderSummary(dateStart, dateStop, selectedCampaigns);
  const { summary: geoSummary,      isLoading: geoGLoading }  = useGoogleGeoSummary(dateStart, dateStop, selectedCampaigns);
  const { data: locationTargeting,  isLoading: ltLoading }    = useGoogleLocationTargeting(selectedCampaigns);
  const { summary: hourSummary,     isLoading: hourLoading }  = useGoogleHourSummary(dateStart, dateStop, selectedCampaigns);
  const { summary: citySummary,     isLoading: cityLoading }  = useGoogleCitySummary(dateStart, dateStop, selectedCampaigns);
  const { summary: auctionSummary,  isLoading: auctionLoading } = useGoogleAuctionInsightsSummary(dateStart, dateStop, selectedCampaigns);
  const { summary: adPerfSummary,   isLoading: adPerfLoading }  = useGoogleAdPerfDailySummary(dateStart, dateStop, selectedCampaigns);
  const { data:    assetData,       isLoading: assetLoading }   = useGoogleAssets(selectedCampaigns);
  const { summary: convSummary,     isLoading: convLoading }    = useGoogleConversionActionsSummary(dateStart, dateStop, selectedCampaigns);
  const { summary: networkSummary,  isLoading: netLoading }     = useGoogleNetworkSummary(dateStart, dateStop, selectedCampaigns);
  const { summary: lpSummary,       isLoading: lpLoading }      = useGoogleLandingPagesSummary(dateStart, dateStop);

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sortedCampaigns = useMemo(
    () => [...campaignSummary].sort((a, b) => b[sortCol] - a[sortCol]),
    [campaignSummary, sortCol]
  );

  const toggleCampaign = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const allSelected =
    selectedCampaigns.length === 0 ||
    selectedCampaigns.length === (allCampaigns?.length ?? 0);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RENDER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  return (
    <div style={{ padding: "24px 0" }}>

      {/* â”€â”€ Date filter (shared) â”€â”€ */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={LABEL_STYLE}>Dari</label>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            style={INPUT_STYLE}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={LABEL_STYLE}>Sampai</label>
          <input
            type="date"
            value={dateStop}
            onChange={(e) => setDateStop(e.target.value)}
            style={INPUT_STYLE}
          />
        </div>
        {/* Preset buttons */}
        <div style={{ display: "flex", gap: 6, marginLeft: 4 }}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.days)}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                border: "1px solid var(--gray-200)",
                background: "var(--surface)",
                color: "var(--gray-600)",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#BB2649";
                e.currentTarget.style.color = "#BB2649";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--gray-200)";
                e.currentTarget.style.color = "var(--gray-600)";
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Campaign filter dropdown — hanya di sub-tab Google Ads */}
        {allCampaigns && allCampaigns.length > 0 && (
          <div ref={campaignDropdownRef} style={{ position: "relative", marginLeft: 8 }}>
            <button
              onClick={() => setCampaignDropdownOpen((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "5px 11px",
                borderRadius: 6, border: "1px solid var(--gray-200)", background: "var(--surface)",
                cursor: "pointer", fontSize: 12, fontWeight: 500, color: "var(--gray-700)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)", whiteSpace: "nowrap",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {allSelected
                ? "Semua Campaign"
                : selectedCampaigns.length === 1
                  ? (allCampaigns.find((c) => c.id === selectedCampaigns[0])?.name ?? "1 campaign")
                  : `${selectedCampaigns.length} campaign dipilih`}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2, flexShrink: 0, transform: campaignDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {campaignDropdownOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
                background: "var(--surface)", border: "1px solid var(--gray-200)",
                borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                minWidth: 260, maxHeight: 300, overflowY: "auto",
              }}>
                <div
                  onClick={() => { setSelected([]); setCampaignDropdownOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--gray-100)", background: allSelected ? "#FFF5F7" : "transparent" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = allSelected ? "#FFF5F7" : "var(--gray-50)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = allSelected ? "#FFF5F7" : "transparent"; }}
                >
                  <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${allSelected ? "#BB2649" : "var(--gray-300)"}`, background: allSelected ? "#BB2649" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {allSelected && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4l2 2 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: allSelected ? "#BB2649" : "var(--gray-700)" }}>Semua Campaign</span>
                </div>
                {allCampaigns.map((c) => {
                  const checked = selectedCampaigns.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleCampaign(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer", background: checked ? "#FFF5F7" : "transparent" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = checked ? "#FFF5F7" : "var(--gray-50)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = checked ? "#FFF5F7" : "transparent"; }}
                    >
                      <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${checked ? "#BB2649" : "var(--gray-300)"}`, background: checked ? "#BB2649" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {checked && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4l2 2 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{ fontSize: 12, color: checked ? "#BB2649" : "var(--gray-700)", fontWeight: checked ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* SUB-TAB: GOOGLE ADS                                               */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SUB-TAB: GOOGLE ADS — 1-page layout                            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* KPI cards */}
          <section className="kpi-grid">
            <KpiCard label="Pengeluaran"  value={gLoading ? "—" : idr(gTotals?.spend ?? 0)}       loading={gLoading} accent="magenta" description="Total biaya iklan Google Ads yang dikeluarkan dalam periode yang dipilih." />
            <KpiCard label="Klik"         value={gLoading ? "—" : num(gTotals?.clicks ?? 0)}       loading={gLoading} accent="info"    description="Jumlah total klik pada iklan Google Ads." />
            <KpiCard label="Impresi"      value={gLoading ? "—" : num(gTotals?.impressions ?? 0)}  loading={gLoading}                  description="Jumlah total tayangan iklan dalam periode yang dipilih." />
            <KpiCard label="CTR"          value={gLoading ? "—" : pct(gTotals?.ctr ?? 0)}          loading={gLoading} accent="info"    description="Click-Through Rate — persentase tayangan yang menghasilkan klik." />
            <KpiCard label="CPC"          value={gLoading ? "—" : idr(gTotals?.cpc ?? 0)}          loading={gLoading} sub="per klik"   description="Cost Per Click — rata-rata biaya per klik iklan." />
            <KpiCard label="Konversi"     value={gLoading ? "—" : num(gTotals?.conversions ?? 0)}  loading={gLoading} accent="success" description="Jumlah total konversi yang dihasilkan dari iklan." />
            <KpiCard label="Biaya/Konv."  value={gLoading ? "—" : idr(gTotals?.cpa ?? 0)}          loading={gLoading} accent="warning" sub="per konversi" description="Rata-rata pengeluaran untuk mendapatkan satu konversi." />
          </section>

          {/* Main 3-column grid */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.1fr 1.4fr", gap: 12 }}>

            {/* ── Col A: Chart + Campaign table ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="chart-card" style={{ padding: "10px 14px" }}>
                <div className="chart-header-row">
                  <div>
                    <h3 className="chart-title" style={{ marginBottom: 2 }}>Pengeluaran & Klik Harian</h3>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--gray-500)" }}>
                      <span>Total: <strong style={{ color: "#BB2649" }}>{idr(gTotals?.spend ?? 0)}</strong></span>
                      <span>&middot;</span>
                      <span>Klik: <strong style={{ color: "#D97706" }}>{num(gTotals?.clicks ?? 0)}</strong></span>
                    </div>
                  </div>
                </div>
                {chartLoading || dailyChart.length === 0 ? (
                  <Empty msg={chartLoading ? "Memuat…" : "Belum ada data. Jalankan fetch-google-ads."} />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={dailyChart} margin={{ top: 2, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={fmtDate} />
                      <YAxis yAxisId="spend" orientation="left" tick={{ fontSize: 9 }} tickFormatter={(v) => `${(Number(v)/1000).toFixed(0)}rb`} />
                      <YAxis yAxisId="clicks" orientation="right" tick={{ fontSize: 9 }} />
                      <Tooltip formatter={(value, name) => name === "Pengeluaran" ? [safeIdr(value), name] : [safeNum(value), name]} labelFormatter={(l) => fmtDate(String(l))} />
                      <Bar yAxisId="spend" dataKey="spend" name="Pengeluaran" fill="#BB2649" radius={[2,2,0,0]} />
                      <Line yAxisId="clicks" dataKey="clicks" name="Klik" stroke="#D97706" dot={false} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="chart-card" style={{ padding: "10px 14px" }}>
                <div className="chart-header-row">
                  <div>
                    <h3 className="chart-title" style={{ marginBottom: 2 }}>Performa Campaign</h3>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--gray-500)" }}>
                      <span>{sortedCampaigns.length} campaign</span>
                      <span>&middot;</span>
                      <span>Total: <strong style={{ color: "#BB2649" }}>{idr(gTotals?.spend ?? 0)}</strong></span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "nowrap" }}>
                    {(["spend","clicks","impressions","conversions"] as const).map((col) => (
                      <button key={col} onClick={() => setSortCol(col)} style={{ padding: "2px 7px", borderRadius: 10, fontSize: 10, cursor: "pointer", border: sortCol === col ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: sortCol === col ? "#BB2649" : "transparent", color: sortCol === col ? "#fff" : "var(--gray-500)", whiteSpace: "nowrap" }}>
                        {col === "spend" ? "Biaya" : col === "clicks" ? "Klik" : col === "impressions" ? "Impresi" : "Konversi"}
                      </button>
                    ))}
                  </div>
                </div>
                {sortedCampaigns.length === 0 ? <Empty msg="Belum ada data." /> : (
                  <div style={{ overflowY: "auto", maxHeight: 190 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr>{["Campaign","Tipe","Biaya","Impresi","Klik","CTR","Konv."].map((h) => <th key={h} style={{ ...TH_STYLE, padding: "5px 7px", fontSize: 10 }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {sortedCampaigns.map((c) => {
                          const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
                          return (
                            <tr key={c.campaign_id} onMouseEnter={(e) => hoverRow(e, true)} onMouseLeave={(e) => hoverRow(e, false)}>
                              <td style={{ ...TD_STYLE, padding: "5px 7px", fontWeight: 500, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.campaign_name}>{c.campaign_name}</td>
                              <td style={{ ...TD_STYLE, padding: "5px 7px", fontSize: 10, color: "var(--gray-400)" }}>{CHANNEL_TYPE_LABELS[c.advertising_channel_type ?? ""] ?? "—"}</td>
                              <td style={{ ...TD_STYLE, padding: "5px 7px", color: "#BB2649", fontWeight: 600 }}>{idr(c.spend)}</td>
                              <td style={{ ...TD_STYLE, padding: "5px 7px" }}>{num(c.impressions)}</td>
                              <td style={{ ...TD_STYLE, padding: "5px 7px", fontWeight: 600 }}>{num(c.clicks)}</td>
                              <td style={{ ...TD_STYLE, padding: "5px 7px" }}>{pct(ctr)}</td>
                              <td style={{ ...TD_STYLE, padding: "5px 7px", color: "#16A34A", fontWeight: 600 }}>{num(c.conversions)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ── Col B: Audiens + Wilayah & Jadwal ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="chart-card" style={{ padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div className="chart-header-row">
                  <div>
                    <h3 className="chart-title" style={{ marginBottom: 2 }}>Audiens</h3>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--gray-500)" }}>
                      <span>Impresi: <strong style={{ color: "#BB2649" }}>{num(gTotals?.impressions ?? 0)}</strong></span>
                      <span>&middot;</span>
                      <span>Klik: <strong style={{ color: "#2563EB" }}>{num(gTotals?.clicks ?? 0)}</strong></span>
                    </div>
                  </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "nowrap" }}>
                    {([{ k: "age", l: "Usia" }, { k: "gender", l: "Gender" }, { k: "device", l: "Device" }] as const).map(({ k, l }) => (
                      <button key={k} onClick={() => setAdsAudienceTab(k)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: adsAudienceTab === k ? 600 : 400, cursor: "pointer", border: adsAudienceTab === k ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: adsAudienceTab === k ? "#BB2649" : "transparent", color: adsAudienceTab === k ? "#fff" : "var(--gray-500)", whiteSpace: "nowrap" }}>{l}</button>
                    ))}
                    </div>
                  </div>
                </div>
                {adsAudienceTab === "age" && (
                  ageLoading ? <Empty msg="Memuat…" /> :
                  ageSummary.length === 0 ? <Empty msg="Jalankan type=age atau type=demographics." /> : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={ageSummary} margin={{ top: 2, right: 4, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 8 }} tickFormatter={safeNum} />
                        <Tooltip formatter={(v, n) => [safeNum(v), n]} />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                        <Bar dataKey="impressions" name="Impresi" fill="#BB2649" radius={[2,2,0,0]} />
                        <Bar dataKey="clicks" name="Klik" fill="#2563EB" radius={[2,2,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                )}
                {adsAudienceTab === "gender" && (
                  gnrLoading ? <Empty msg="Memuat…" /> :
                  genderSummary.length === 0 ? <Empty msg="Jalankan type=gender atau type=demographics." /> : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, alignItems: "center" }}>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={genderSummary} dataKey="impressions" nameKey="label" cx="50%" cy="50%" outerRadius={68} label={({ name, percent }) => `${String(name)} ${((Number(percent)||0)*100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                            {genderSummary.map((_, i) => <Cell key={i} fill={["#BB2649","#2563EB","#9CA3AF"][i%3]} />)}
                          </Pie>
                          <Tooltip formatter={(v) => [safeNum(v), "Impresi"]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div>
                        {genderSummary.map((r, i) => {
                          const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
                          return (
                            <div key={r.gender} style={{ padding: "5px 0", borderBottom: "1px solid var(--gray-100)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: ["#BB2649","#2563EB","#9CA3AF"][i%3] }}>{r.label}</span>
                                <span style={{ fontSize: 10, color: "var(--gray-600)" }}>{num(r.impressions)}</span>
                              </div>
                              <div style={{ fontSize: 10, color: "var(--gray-400)" }}>CTR {pct(ctr)} · {idr(r.cost_idr)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
                {adsAudienceTab === "device" && (
                  devLoading ? <Empty msg="Memuat…" /> :
                  deviceSummary.length === 0 ? <Empty msg="Jalankan type=device." /> : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={deviceSummary.map((d) => ({ ...d, label: d.device === "MOBILE" ? "Mobile" : d.device === "DESKTOP" ? "Desktop" : d.device === "TABLET" ? "Tablet" : d.device }))} margin={{ top: 2, right: 4, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 8 }} tickFormatter={safeNum} />
                        <Tooltip formatter={(v, n) => [safeNum(v), n]} />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                        <Bar dataKey="impressions" name="Impresi" fill="#2563EB" radius={[3,3,0,0]} />
                        <Bar dataKey="clicks" name="Klik" fill="#BB2649" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                )}
              </div>

              <div className="chart-card" style={{ padding: "10px 14px", flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div className="chart-header-row">
                  <div>
                    <h3 className="chart-title" style={{ marginBottom: 2 }}>Wilayah & Jadwal</h3>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--gray-500)" }}>
                      <span>Top: <strong style={{ color: "#2563EB" }}>{geoSummary[0]?.country_name ?? "—"}</strong></span>
                      <span>&middot;</span>
                      <span>Klik: <strong style={{ color: "#BB2649" }}>{num(geoSummary[0]?.clicks ?? 0)}</strong></span>
                    </div>
                  </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "nowrap" }}>
                    {([{ k: "country", l: "Negara" }, { k: "hour", l: "Jadwal" }, { k: "targeting", l: "Lokasi" }] as const).map(({ k, l }) => (
                      <button key={k} onClick={() => setAdsGeoTab(k)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: adsGeoTab === k ? 600 : 400, cursor: "pointer", border: adsGeoTab === k ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: adsGeoTab === k ? "#BB2649" : "transparent", color: adsGeoTab === k ? "#fff" : "var(--gray-500)", whiteSpace: "nowrap" }}>{l}</button>
                    ))}
                    </div>
                  </div>
                </div>
                {adsGeoTab === "country" && (
                  geoGLoading ? <Empty msg="Memuat…" /> :
                  geoSummary.length === 0 ? <Empty msg="Jalankan type=geo." /> : (
                    <div style={{ overflowY: "auto", maxHeight: 175 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead><tr>{["Negara","Impresi","Klik","Biaya"].map((h) => <th key={h} style={{ ...TH_STYLE, padding: "4px 6px", fontSize: 10 }}>{h}</th>)}</tr></thead>
                        <tbody>
                          {geoSummary.slice(0, 12).map((r, i) => (
                            <tr key={r.criterion_id} style={{ borderBottom: "1px solid var(--gray-100)" }}>
                              <td style={{ ...TD_STYLE, padding: "4px 6px", fontWeight: 600 }}>
                                <span style={{ fontSize: 9, color: "var(--gray-400)", marginRight: 4 }}>{i+1}</span>{r.country_name}
                              </td>
                              <td style={{ ...TD_STYLE, padding: "4px 6px", textAlign: "right" }}>{num(r.impressions)}</td>
                              <td style={{ ...TD_STYLE, padding: "4px 6px", textAlign: "right", fontWeight: 600 }}>{num(r.clicks)}</td>
                              <td style={{ ...TD_STYLE, padding: "4px 6px", textAlign: "right", color: "#BB2649", fontWeight: 600 }}>{idr(r.cost_idr)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
                {adsGeoTab === "hour" && (
                  hourLoading ? <Empty msg="Memuat…" /> :
                  hourSummary.byHour.every((r) => r.impressions === 0) ? <Empty msg="Jalankan type=hour atau type=demographics." /> : (
                    <div>
                      <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "nowrap" }}>
                        {([{ k: "hour" as const, l: "Per Jam" }, { k: "day" as const, l: "Per Hari" }]).map(({ k, l }) => (
                          <button key={k} onClick={() => setHourView(k)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: hourView === k ? 600 : 400, cursor: "pointer", border: hourView === k ? "1px solid #2563EB" : "1px solid var(--gray-200)", background: hourView === k ? "#2563EB" : "transparent", color: hourView === k ? "#fff" : "var(--gray-500)", whiteSpace: "nowrap" }}>{l}</button>
                        ))}
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={(hourView === "hour" ? hourSummary.byHour : hourSummary.byDay) as Array<Record<string, unknown>>} margin={{ top: 2, right: 4, left: -18, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                          <XAxis dataKey="label" tick={{ fontSize: 8 }} interval={hourView === "hour" ? 3 : 0} />
                          <YAxis tick={{ fontSize: 8 }} tickFormatter={safeNum} />
                          <Tooltip formatter={(v, n) => [safeNum(v), n]} />
                          <Bar dataKey="impressions" name="Impresi" fill="#BB2649" radius={[2,2,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )
                )}
                {adsGeoTab === "targeting" && (
                  ltLoading ? <Empty msg="Memuat…" /> :
                  !locationTargeting || locationTargeting.length === 0 ? <Empty msg="Jalankan type=location_targeting." /> : (() => {
                    const byCampaign: Record<string, { name: string; positives: typeof locationTargeting }> = {};
                    for (const r of locationTargeting) {
                      if (!byCampaign[r.campaign_id]) byCampaign[r.campaign_id] = { name: r.campaign_name, positives: [] };
                      if (!r.is_negative) byCampaign[r.campaign_id].positives.push(r);
                    }
                    const TC: Record<string, string> = { "Country": "#BB2649", "Province": "#2563EB", "City": "#16A34A", "Region": "#D97706" };
                    return (
                      <div style={{ overflowY: "auto", maxHeight: 175, display: "flex", flexDirection: "column", gap: 8 }}>
                        {Object.entries(byCampaign).map(([cId, camp]) => (
                          <div key={cId}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-600)", marginBottom: 4 }}>{camp.name}</p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {camp.positives.map((r) => (
                                <span key={r.id} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: `${TC[r.target_type ?? ""] ?? "#6B7280"}18`, color: TC[r.target_type ?? ""] ?? "#6B7280", border: `1px solid ${TC[r.target_type ?? ""] ?? "#6B7280"}40`, fontWeight: 500 }}>
                                  {r.location_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            {/* ── Col C: Kata Kunci & Kueri + Ad Group & Iklan ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* Card 1: Kata Kunci & Kueri */}
              <div className="chart-card" style={{ padding: "10px 14px" }}>
                <div className="chart-header-row">
                  <div>
                    <h3 className="chart-title" style={{ marginBottom: 2 }}>Kata Kunci & Kueri</h3>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--gray-500)" }}>
                      <span>{keywordSummary.length} kata kunci</span>
                      <span>&middot;</span>
                      <span>Impresi: <strong style={{ color: "#BB2649" }}>{num(gTotals?.impressions ?? 0)}</strong></span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "nowrap" }}>
                    {([{ k: "keywords", l: "Kata Kunci" }, { k: "search_terms", l: "Kueri" }] as const).map(({ k, l }) => (
                      <button key={k} onClick={() => setAdsKwTab1(k)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: adsKwTab1 === k ? 600 : 400, cursor: "pointer", border: adsKwTab1 === k ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: adsKwTab1 === k ? "#BB2649" : "transparent", color: adsKwTab1 === k ? "#fff" : "var(--gray-500)", whiteSpace: "nowrap" }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div style={{ overflowY: "auto", maxHeight: 220 }}>
                  {adsKwTab1 === "keywords" && (
                    kwLoading ? <Empty msg="Memuat…" /> :
                    keywordSummary.length === 0 ? <Empty msg="Jalankan fetch-google-ads type=keywords." /> : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead><tr>{["Kata Kunci","Type","QS","Impresi","Klik","CTR","Biaya"].map((h) => <th key={h} style={{ ...TH_STYLE, padding: "4px 6px", fontSize: 10 }}>{h}</th>)}</tr></thead>
                        <tbody>
                          {keywordSummary.slice(0, 50).map((kw) => {
                            const ctr = kw.impressions > 0 ? (kw.clicks / kw.impressions) * 100 : 0;
                            const mtC = kw.match_type === "EXACT" ? { bg: "#EFF6FF", fg: "#1D4ED8" } : kw.match_type === "PHRASE" ? { bg: "#F0FDF4", fg: "#15803D" } : { bg: "#FEF9C3", fg: "#854D0E" };
                            return (
                              <tr key={kw.key} onMouseEnter={(e) => hoverRow(e, true)} onMouseLeave={(e) => hoverRow(e, false)}>
                                <td style={{ ...TD_STYLE, padding: "4px 6px", fontWeight: 600, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={kw.keyword_text}>{kw.keyword_text}</td>
                                <td style={{ ...TD_STYLE, padding: "4px 6px" }}><span style={{ background: mtC.bg, color: mtC.fg, padding: "1px 4px", borderRadius: 3, fontSize: 9, fontWeight: 600 }}>{kw.match_type === "EXACT" ? "Exact" : kw.match_type === "PHRASE" ? "Phrase" : "Broad"}</span></td>
                                <td style={{ ...TD_STYLE, padding: "4px 6px", textAlign: "center", fontWeight: 600, color: (kw.quality_score ?? 0) >= 7 ? "#16A34A" : (kw.quality_score ?? 0) >= 4 ? "#D97706" : kw.quality_score != null ? "#DC2626" : "var(--gray-400)" }}>{kw.quality_score ?? "—"}</td>
                                <td style={{ ...TD_STYLE, padding: "4px 6px" }}>{num(kw.impressions)}</td>
                                <td style={{ ...TD_STYLE, padding: "4px 6px", fontWeight: 600 }}>{num(kw.clicks)}</td>
                                <td style={{ ...TD_STYLE, padding: "4px 6px" }}>{pct(ctr)}</td>
                                <td style={{ ...TD_STYLE, padding: "4px 6px", color: "#BB2649", fontWeight: 600 }}>{idr(kw.spend)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )
                  )}
                  {adsKwTab1 === "search_terms" && (
                    stLoading ? <Empty msg="Memuat…" /> :
                    stSummary.length === 0 ? <Empty msg="Jalankan fetch-google-ads type=search_terms." /> : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead><tr>{["Kueri Penelusuran","St.","Impresi","Klik","CTR","Biaya"].map((h) => <th key={h} style={{ ...TH_STYLE, padding: "4px 6px", fontSize: 10 }}>{h}</th>)}</tr></thead>
                        <tbody>
                          {stSummary.slice(0, 100).map((st) => {
                            const ctr = st.impressions > 0 ? (st.clicks / st.impressions) * 100 : 0;
                            return (
                              <tr key={st.search_term} onMouseEnter={(e) => hoverRow(e, true)} onMouseLeave={(e) => hoverRow(e, false)}>
                                <td style={{ ...TD_STYLE, padding: "4px 6px", fontWeight: 500, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={st.search_term}>{st.search_term}</td>
                                <td style={{ ...TD_STYLE, padding: "4px 6px" }}><span style={{ fontSize: 10, color: st.status === "ADDED" ? "#16A34A" : st.status === "EXCLUDED" ? "#DC2626" : "var(--gray-400)", fontWeight: 700 }}>{st.status === "ADDED" ? "✓" : st.status === "EXCLUDED" ? "✗" : "—"}</span></td>
                                <td style={{ ...TD_STYLE, padding: "4px 6px" }}>{num(st.impressions)}</td>
                                <td style={{ ...TD_STYLE, padding: "4px 6px", fontWeight: 600 }}>{num(st.clicks)}</td>
                                <td style={{ ...TD_STYLE, padding: "4px 6px" }}>{pct(ctr)}</td>
                                <td style={{ ...TD_STYLE, padding: "4px 6px", color: "#BB2649", fontWeight: 600 }}>{idr(st.spend)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )
                  )}
                </div>
              </div>

              {/* Card 2: Ad Group & Iklan */}
              <div className="chart-card" style={{ padding: "10px 14px" }}>
                <div className="chart-header-row">
                  <div>
                    <h3 className="chart-title" style={{ marginBottom: 2 }}>Ad Group & Iklan</h3>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--gray-500)" }}>
                      <span>{adgroupSummary.length} ad group</span>
                      <span>&middot;</span>
                      <span>Iklan: <strong style={{ color: "#2563EB" }}>{num(adsList?.length ?? 0)}</strong></span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "nowrap" }}>
                    {([{ k: "adgroups", l: "Ad Group" }, { k: "ads", l: "Iklan" }] as const).map(({ k, l }) => (
                      <button key={k} onClick={() => setAdsKwTab2(k)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: adsKwTab2 === k ? 600 : 400, cursor: "pointer", border: adsKwTab2 === k ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: adsKwTab2 === k ? "#BB2649" : "transparent", color: adsKwTab2 === k ? "#fff" : "var(--gray-500)", whiteSpace: "nowrap" }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div style={{ overflowY: "auto", maxHeight: 220 }}>
                  {adsKwTab2 === "adgroups" && (
                    agLoading ? <Empty msg="Memuat…" /> :
                    adgroupSummary.length === 0 ? <Empty msg="Jalankan fetch-google-ads type=adgroup_perf." /> : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead><tr>{["Ad Group","Campaign","Impresi","Klik","Biaya","Konv."].map((h) => <th key={h} style={{ ...TH_STYLE, padding: "4px 6px", fontSize: 10 }}>{h}</th>)}</tr></thead>
                        <tbody>
                          {adgroupSummary.map((ag) => (
                            <tr key={ag.adgroup_id} onMouseEnter={(e) => hoverRow(e, true)} onMouseLeave={(e) => hoverRow(e, false)}>
                              <td style={{ ...TD_STYLE, padding: "4px 6px", fontWeight: 600, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ag.adgroup_name}</td>
                              <td style={{ ...TD_STYLE, padding: "4px 6px", fontSize: 10, color: "var(--gray-400)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ag.campaign_name}</td>
                              <td style={{ ...TD_STYLE, padding: "4px 6px" }}>{num(ag.impressions)}</td>
                              <td style={{ ...TD_STYLE, padding: "4px 6px", fontWeight: 600 }}>{num(ag.clicks)}</td>
                              <td style={{ ...TD_STYLE, padding: "4px 6px", color: "#BB2649", fontWeight: 600 }}>{idr(ag.spend)}</td>
                              <td style={{ ...TD_STYLE, padding: "4px 6px", color: ag.conversions > 0 ? "#16A34A" : "var(--gray-400)" }}>{ag.conversions.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  )}
                  {adsKwTab2 === "ads" && (
                    <div>
                      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                        {([{ k: "kreatif" as const, l: "Kreatif" }, { k: "performa" as const, l: "Performa" }]).map(({ k, l }) => (
                          <button key={k} onClick={() => setAdsIklanView(k)} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: adsIklanView === k ? 600 : 400, cursor: "pointer", border: adsIklanView === k ? "1px solid #2563EB" : "1px solid var(--gray-200)", background: adsIklanView === k ? "#2563EB" : "transparent", color: adsIklanView === k ? "#fff" : "var(--gray-500)" }}>{l}</button>
                        ))}
                      </div>
                      {adsIklanView === "kreatif" && (
                        adsLoading ? <Empty msg="Memuat…" /> :
                        adsError ? <Empty msg={`Error: ${String(adsError?.message ?? adsError)}`} /> :
                        !adsList || adsList.length === 0 ? <Empty msg="Belum ada data iklan. Jalankan fetch-google-ads type=ads." /> : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {adsList.slice(0, 20).map((ad) => {
                              const campName = allCampaigns?.find((c) => c.id === ad.campaign_id)?.name ?? ad.campaign_id;
                              const adType = (ad.type ?? "").replace("RESPONSIVE_SEARCH_AD","RSA").replace("EXPANDED_TEXT_AD","ETA").replace("EXPANDED_DYNAMIC_SEARCH_AD","DSA") || "Ad";
                              return (
                                <div key={ad.id} style={{ border: "1px solid var(--gray-200)", borderRadius: 6, padding: "8px 10px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                    <span style={{ fontSize: 9, fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase" }}>{adType}</span>
                                    <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: ad.status === "ENABLED" ? "#F0FDF4" : "#FEF2F2", color: ad.status === "ENABLED" ? "#15803D" : "#B91C1C", fontWeight: 600 }}>{ad.status === "ENABLED" ? "Aktif" : ad.status ?? "—"}</span>
                                  </div>
                                  {ad.headlines.length > 0
                                    ? ad.headlines.slice(0,2).map((h, i) => <p key={i} style={{ fontSize: 12, fontWeight: 600, color: "#1D4ED8", margin: "1px 0", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h}</p>)
                                    : <p style={{ fontSize: 12, color: "var(--gray-400)", fontStyle: "italic", margin: "1px 0" }}>{ad.name ?? "(tanpa judul)"}</p>}
                                  {ad.descriptions.slice(0,1).map((d, i) => <p key={i} style={{ fontSize: 11, color: "var(--gray-600)", margin: "2px 0", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d}</p>)}
                                  {ad.final_urls?.[0] && <p style={{ fontSize: 10, color: "#16A34A", margin: "2px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ad.final_urls[0]}</p>}
                                  <p style={{ fontSize: 9, color: "var(--gray-400)", marginTop: 4, borderTop: "1px solid var(--gray-100)", paddingTop: 3 }}>{campName}</p>
                                </div>
                              );
                            })}
                            {adsList.length > 20 && <p style={{ fontSize: 10, color: "var(--gray-400)", textAlign: "center", padding: "4px 0" }}>Menampilkan 20 dari {adsList.length} iklan</p>}
                          </div>
                        )
                      )}
                      {adsIklanView === "performa" && (
                        adPerfLoading ? <Empty msg="Memuat…" /> :
                        adPerfSummary.length === 0 ? <Empty msg="Jalankan fetch-google-ads type=ad_perf_daily atau type=extended." /> : (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                            <thead><tr>{["Iklan","Tipe","Impresi","Klik","Biaya","Konv."].map((h) => <th key={h} style={{ ...TH_STYLE, padding: "4px 6px", fontSize: 10 }}>{h}</th>)}</tr></thead>
                            <tbody>
                              {adPerfSummary.slice(0, 30).map((ad) => (
                                <tr key={ad.ad_id} onMouseEnter={(e) => hoverRow(e, true)} onMouseLeave={(e) => hoverRow(e, false)}>
                                  <td style={{ ...TD_STYLE, padding: "4px 6px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }} title={ad.headlines[0] ?? ad.ad_name}>{ad.headlines[0] ?? ad.ad_name}</td>
                                  <td style={{ ...TD_STYLE, padding: "4px 6px", fontSize: 9, color: "var(--gray-400)" }}>{(ad.ad_type ?? "").replace("RESPONSIVE_SEARCH_AD","RSA").replace("EXPANDED_TEXT_AD","ETA") || "—"}</td>
                                  <td style={{ ...TD_STYLE, padding: "4px 6px" }}>{num(ad.impressions)}</td>
                                  <td style={{ ...TD_STYLE, padding: "4px 6px", fontWeight: 600 }}>{num(ad.clicks)}</td>
                                  <td style={{ ...TD_STYLE, padding: "4px 6px", color: "#BB2649", fontWeight: 600 }}>{idr(ad.cost_idr)}</td>
                                  <td style={{ ...TD_STYLE, padding: "4px 6px", color: ad.conversions > 0 ? "#16A34A" : "var(--gray-400)", fontWeight: ad.conversions > 0 ? 600 : 400 }}>{ad.conversions > 0 ? ad.conversions.toFixed(1) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* ── Bottom row: Jenis Konversi | Platform & Jaringan | Landing Page ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>

            {/* Jenis Konversi */}
            <div className="chart-card" style={{ padding: "10px 14px" }}>
              <div className="chart-header-row" style={{ marginBottom: 8 }}>
                <div>
                  <h3 className="chart-title">Jenis Konversi</h3>
                  <p className="chart-subtitle">WhatsApp, form, telepon, dll</p>
                </div>
              </div>
              {convLoading ? <Empty msg="Memuat…" /> :
               !convSummary || convSummary.length === 0 ? <Empty msg="Jalankan type=conversion_actions atau type=extended." /> : (() => {
                const CONV_COLORS = ["#BB2649","#2563EB","#16A34A","#D97706","#7C3AED","#0891B2"];
                const pieData = convSummary.slice(0, 6).map((c, i) => ({
                  name: c.name,
                  value: c.conversions,
                  fill: CONV_COLORS[i % CONV_COLORS.length],
                }));
                return (
                  <div>
                    <ResponsiveContainer width="100%" height={100}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={45} paddingAngle={2}>
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip formatter={(v) => [Number(v ?? 0).toFixed(1), "Konversi"]} contentStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                      {convSummary.slice(0, 6).map((c, i) => (
                        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: "1px solid var(--gray-100)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, overflow: "hidden" }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: CONV_COLORS[i % CONV_COLORS.length], flexShrink: 0 }} />
                            <span style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--gray-700)" }}>{c.name}</span>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 600, flexShrink: 0, marginLeft: 4 }}>{c.conversions.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
               })()}
            </div>

            {/* Platform & Jaringan */}
            <div className="chart-card" style={{ padding: "10px 14px" }}>
              <div className="chart-header-row" style={{ marginBottom: 8 }}>
                <div>
                  <h3 className="chart-title">Platform & Jaringan</h3>
                  <p className="chart-subtitle">Search, Display, YouTube</p>
                </div>
              </div>
              {netLoading ? <Empty msg="Memuat…" /> :
               !networkSummary || networkSummary.length === 0 ? <Empty msg="Jalankan type=network atau type=extended." /> : (() => {
                const NET_COLOR: Record<string, string> = { SEARCH: "#2563EB", DISPLAY: "#16A34A", YOUTUBE_WATCH: "#BB2649", CROSS_NETWORK: "#D97706", CONTENT: "#7C3AED", MIXED: "#0891B2", UNKNOWN: "var(--gray-300)" };
                const NET_LABEL: Record<string, string> = { SEARCH: "Search", DISPLAY: "Display", YOUTUBE_WATCH: "YouTube", CROSS_NETWORK: "Cross-Network", CONTENT: "Content", MIXED: "Mixed", UNKNOWN: "Lainnya" };
                const totalCost = networkSummary.reduce((s, n) => s + n.cost_idr, 0);
                const totalClicks = networkSummary.reduce((s, n) => s + n.clicks, 0);
                const activeNets = networkSummary.filter((n) => n.cost_idr > 0 || n.clicks > 0);
                return (
                  <div>
                    {/* Horizontal proportional bar */}
                    {totalCost > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <p style={{ fontSize: 9, color: "var(--gray-400)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Distribusi Biaya</p>
                        <div style={{ display: "flex", height: 16, borderRadius: 4, overflow: "hidden", gap: 1 }}>
                          {activeNets.map((n) => {
                            const pctVal = totalCost > 0 ? (n.cost_idr / totalCost) * 100 : 0;
                            if (pctVal < 1) return null;
                            return (
                              <div key={n.network} title={`${NET_LABEL[n.network] ?? n.network}: ${idr(n.cost_idr)} (${pctVal.toFixed(1)}%)`}
                                style={{ flex: pctVal, background: NET_COLOR[n.network] ?? "var(--gray-300)", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 20 }}>
                                {pctVal > 12 && <span style={{ fontSize: 8, color: "#fff", fontWeight: 700 }}>{pctVal.toFixed(0)}%</span>}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 8px", marginTop: 5 }}>
                          {activeNets.map((n) => (
                            <div key={n.network} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: NET_COLOR[n.network] ?? "var(--gray-300)", flexShrink: 0 }} />
                              <span style={{ fontSize: 9, color: "var(--gray-600)" }}>{NET_LABEL[n.network] ?? n.network}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Tabel detail */}
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                      <thead><tr>{["Jaringan","Biaya","% Biaya","Klik","CTR","Konv."].map((h) => <th key={h} style={{ ...TH_STYLE, padding: "3px 4px", fontSize: 9 }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {activeNets.map((n) => {
                          const pctCost = totalCost > 0 ? (n.cost_idr / totalCost) * 100 : 0;
                          const ctr = totalClicks > 0 ? (n.clicks / n.impressions) * 100 : 0;
                          return (
                            <tr key={n.network} onMouseEnter={(e) => hoverRow(e, true)} onMouseLeave={(e) => hoverRow(e, false)}>
                              <td style={{ ...TD_STYLE, padding: "3px 4px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: 2, background: NET_COLOR[n.network] ?? "var(--gray-300)", flexShrink: 0 }} />
                                  <span style={{ fontSize: 10 }}>{NET_LABEL[n.network] ?? n.network}</span>
                                </div>
                              </td>
                              <td style={{ ...TD_STYLE, padding: "3px 4px", color: "#BB2649", fontWeight: 600, whiteSpace: "nowrap" }}>{idr(n.cost_idr)}</td>
                              <td style={{ ...TD_STYLE, padding: "3px 4px", color: "var(--gray-500)" }}>{pctCost.toFixed(1)}%</td>
                              <td style={{ ...TD_STYLE, padding: "3px 4px" }}>{num(n.clicks)}</td>
                              <td style={{ ...TD_STYLE, padding: "3px 4px" }}>{n.impressions > 0 ? pct(ctr) : "—"}</td>
                              <td style={{ ...TD_STYLE, padding: "3px 4px", color: n.conversions > 0 ? "#16A34A" : "var(--gray-400)", fontWeight: n.conversions > 0 ? 600 : 400 }}>{n.conversions > 0 ? n.conversions.toFixed(1) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p style={{ fontSize: 9, color: "var(--gray-400)", marginTop: 6, borderTop: "1px solid var(--gray-100)", paddingTop: 4 }}>
                      Total: <strong style={{ color: "#BB2649" }}>{idr(totalCost)}</strong> · {num(totalClicks)} klik
                    </p>
                  </div>
                );
               })()}
            </div>

            {/* Landing Page */}
            <div className="chart-card" style={{ padding: "10px 14px" }}>
              <div className="chart-header-row" style={{ marginBottom: 8 }}>
                <div>
                  <h3 className="chart-title">Performa Landing Page</h3>
                  <p className="chart-subtitle">Kecepatan & mobile-friendly</p>
                </div>
              </div>
              {lpLoading ? <Empty msg="Memuat…" /> :
               !lpSummary || lpSummary.length === 0 ? <Empty msg="Jalankan type=landing_pages atau type=extended." /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {lpSummary.slice(0, 8).map((lp) => {
                    const score = lp.speed_score ?? 0;
                    const color = score >= 80 ? "#16A34A" : score >= 50 ? "#D97706" : "#B91C1C";
                    const urlDisplay = lp.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
                    return (
                      <div key={lp.url} style={{ borderBottom: "1px solid var(--gray-100)", paddingBottom: 5 }}>
                        <p style={{ fontSize: 10, fontWeight: 500, color: "#1D4ED8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }} title={lp.url}>{urlDisplay}</p>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 9, color: "var(--gray-400)" }}>Klik: <strong style={{ color: "var(--gray-700)" }}>{num(lp.clicks)}</strong></span>
                          {score > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                              <span style={{ fontSize: 9, color: "var(--gray-400)", flexShrink: 0 }}>Speed:</span>
                              <div style={{ flex: 1, height: 5, background: "var(--gray-100)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: `${Math.min(score, 100)}%`, height: "100%", background: color, borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 9, fontWeight: 600, color, flexShrink: 0 }}>{score}</span>
                            </div>
                          )}
                          {(lp.mobile_friendly_pct ?? 0) > 0 && (
                            <span style={{ fontSize: 9, color: "var(--gray-400)" }}>📱 <strong style={{ color: (lp.mobile_friendly_pct ?? 0) >= 90 ? "#16A34A" : "#D97706" }}>{pct(lp.mobile_friendly_pct ?? 0)}</strong></span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>
    </div>
  );
}
