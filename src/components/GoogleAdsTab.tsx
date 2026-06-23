"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  ComposedChart, Bar, Line,
  AreaChart, Area,
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
  useGa4KpiTotals,
  useGa4DailyTrend,
  useGa4ByChannel,
  useGa4DemographicsSummary,
  useGa4PlatformSummary,
  useGa4LandingPages,
  useGa4Pages,
  useGa4Geography,
  useGa4SearchTerms,
  useGa4SearchConsole,
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

const dur = (sec: number) =>
  `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });

// Safe variants for Recharts formatter (value comes in as unknown)
const safeNum = (v: unknown) => num(Number(v ?? 0));
const safeIdr = (v: unknown) => idr(Number(v ?? 0));
const safePct = (v: unknown) => pct(Number(v ?? 0));

// â”€â”€ Color maps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CHANNEL_COLORS: Record<string, string> = {
  "Paid Search":    "#BB2649",
  "Organic Search": "#16A34A",
  "Social Media":   "#2563EB",
  "Direct":         "#D97706",
  "Referral":       "#7C3AED",
  "Email":          "#0891B2",
  "Other":          "#6B7280",
};

const GENDER_COLORS: Record<string, string> = {
  male:    "#2563EB",
  female:  "#BB2649",
  unknown: "#6B7280",
};

const DEVICE_COLORS: Record<string, string> = {
  mobile:  "#BB2649",
  desktop: "#2563EB",
  tablet:  "#D97706",
};

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
  const [subTab, setSubTab] = useState<"google-ads" | "website">("google-ads");
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
  const [adsKwTab,       setAdsKwTab]       = useState<"keywords" | "search_terms" | "adgroups" | "ads">("keywords");
  // â”€â”€ Website Analytics chart tab states â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [trendTab,    setTrendTab]    = useState<"harian" | "channel">("harian");
  const [demoTab,     setDemoTab]     = useState<"usia" | "gender" | "device">("usia");
  const [contentTab,  setContentTab]  = useState<"landing" | "halaman">("landing");
  const [platformTab, setPlatformTab] = useState<"os" | "browser">("os");
  // â”€â”€ Preset handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ GA4 hooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { totals: ga4Totals, isLoading: ga4Loading } = useGa4KpiTotals(
    dateStart,
    dateStop
  );
  const { dailyTrend } = useGa4DailyTrend(dateStart, dateStop);
  const { byChannel } = useGa4ByChannel(dateStart, dateStop);
  const { summary: demoSummary, isLoading: demoLoading } =
    useGa4DemographicsSummary(dateStart, dateStop);
  const { summary: platformSummary, isLoading: platformLoading } =
    useGa4PlatformSummary(dateStart, dateStop);
  const { data: landingPages, isLoading: lpLoading } = useGa4LandingPages(
    dateStart,
    dateStop,
    20
  );
  const { data: pages, isLoading: pagesLoading } = useGa4Pages(
    dateStart,
    dateStop,
    20
  );
  const { data: geoData, isLoading: geoLoading } = useGa4Geography(
    dateStart,
    dateStop,
    20
  );
  const { data: searchTerms, isLoading: searchLoading } = useGa4SearchTerms(
    dateStart,
    dateStop,
    20
  );
  const { data: searchConsole, isLoading: scLoading } = useGa4SearchConsole(
    dateStart,
    dateStop,
    50
  );

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

      {/* â”€â”€ Sub-tab bar â”€â”€ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button
          className={`tab-btn ${subTab === "google-ads" ? "active" : ""}`}
          onClick={() => setSubTab("google-ads")}
        >
          Google Ads
        </button>
        <button
          className={`tab-btn ${subTab === "website" ? "active" : ""}`}
          onClick={() => setSubTab("website")}
        >
          Website Analytics
        </button>
      </div>

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
        {subTab === "google-ads" && allCampaigns && allCampaigns.length > 0 && (
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
      {subTab === "google-ads" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* KPI strip — 7 angka dalam 1 baris */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
            {[
              { label: "Pengeluaran", value: idr(gTotals?.spend ?? 0),       color: "#BB2649" },
              { label: "Klik",        value: num(gTotals?.clicks ?? 0),       color: "#2563EB" },
              { label: "Impresi",     value: num(gTotals?.impressions ?? 0),  color: "#6B7280" },
              { label: "CTR",         value: pct(gTotals?.ctr ?? 0),          color: "#2563EB" },
              { label: "CPC",         value: idr(gTotals?.cpc ?? 0),          color: "#6B7280" },
              { label: "Konversi",    value: num(gTotals?.conversions ?? 0),  color: "#16A34A" },
              { label: "Biaya/Konv.", value: idr(gTotals?.cpa ?? 0),          color: "#D97706" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "var(--surface)", borderRadius: 8, padding: "8px 10px", borderTop: `3px solid ${color}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 9, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "var(--font-mono, monospace)", lineHeight: 1 }}>{gLoading ? "—" : value}</div>
              </div>
            ))}
          </div>

          {/* Main 3-column grid */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.1fr 1.4fr", gap: 12 }}>

            {/* ── Col A: Chart + Campaign table ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="chart-card" style={{ padding: "10px 14px" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 }}>Pengeluaran & Klik Harian</p>
                {chartLoading || dailyChart.length === 0 ? (
                  <Empty msg={chartLoading ? "Memuat…" : "Belum ada data. Jalankan fetch-google-ads."} />
                ) : (
                  <ResponsiveContainer width="100%" height={185}>
                    <ComposedChart data={dailyChart} margin={{ top: 2, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={fmtDate} />
                      <YAxis yAxisId="spend" orientation="left" tick={{ fontSize: 9 }} tickFormatter={(v) => `${(Number(v)/1000).toFixed(0)}rb`} />
                      <YAxis yAxisId="clicks" orientation="right" tick={{ fontSize: 9 }} />
                      <Tooltip formatter={(value, name) => name === "Pengeluaran" ? [safeIdr(value), name] : [safeNum(value), name]} labelFormatter={(l) => fmtDate(String(l))} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar yAxisId="spend" dataKey="spend" name="Pengeluaran" fill="#BB2649" radius={[2,2,0,0]} />
                      <Line yAxisId="clicks" dataKey="clicks" name="Klik" stroke="#D97706" dot={false} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="chart-card" style={{ padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)" }}>Performa Campaign</p>
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["spend","clicks","impressions","conversions"] as const).map((col) => (
                      <button key={col} onClick={() => setSortCol(col)} style={{ padding: "2px 7px", borderRadius: 10, fontSize: 10, cursor: "pointer", border: sortCol === col ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: sortCol === col ? "#BB2649" : "transparent", color: sortCol === col ? "#fff" : "var(--gray-500)" }}>
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
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)" }}>Audiens</span>
                  <div style={{ display: "flex", gap: 3 }}>
                    {([{ k: "age", l: "Usia" }, { k: "gender", l: "Gender" }, { k: "device", l: "Device" }] as const).map(({ k, l }) => (
                      <button key={k} onClick={() => setAdsAudienceTab(k)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: adsAudienceTab === k ? 600 : 400, cursor: "pointer", border: adsAudienceTab === k ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: adsAudienceTab === k ? "#BB2649" : "transparent", color: adsAudienceTab === k ? "#fff" : "var(--gray-500)" }}>{l}</button>
                    ))}
                  </div>
                </div>
                {adsAudienceTab === "age" && (
                  ageLoading ? <Empty msg="Memuat…" /> :
                  ageSummary.length === 0 ? <Empty msg="Jalankan type=age atau type=demographics." /> : (
                    <ResponsiveContainer width="100%" height={185}>
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
                      <ResponsiveContainer width="100%" height={185}>
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
                    <ResponsiveContainer width="100%" height={185}>
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
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)" }}>Wilayah & Jadwal</span>
                  <div style={{ display: "flex", gap: 3 }}>
                    {([{ k: "country", l: "Negara" }, { k: "hour", l: "Jadwal" }, { k: "targeting", l: "Lokasi" }] as const).map(({ k, l }) => (
                      <button key={k} onClick={() => setAdsGeoTab(k)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: adsGeoTab === k ? 600 : 400, cursor: "pointer", border: adsGeoTab === k ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: adsGeoTab === k ? "#BB2649" : "transparent", color: adsGeoTab === k ? "#fff" : "var(--gray-500)" }}>{l}</button>
                    ))}
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
                      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                        {([{ k: "hour" as const, l: "Per Jam" }, { k: "day" as const, l: "Per Hari" }]).map(({ k, l }) => (
                          <button key={k} onClick={() => setHourView(k)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: hourView === k ? 600 : 400, cursor: "pointer", border: hourView === k ? "1px solid #2563EB" : "1px solid var(--gray-200)", background: hourView === k ? "#2563EB" : "transparent", color: hourView === k ? "#fff" : "var(--gray-500)" }}>{l}</button>
                        ))}
                      </div>
                      <ResponsiveContainer width="100%" height={155}>
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

            {/* ── Col C: Kata Kunci / Kueri / Ad Group / Iklan ── */}
            <div className="chart-card" style={{ padding: "10px 14px", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)" }}>Analisis Kata Kunci</span>
                <div style={{ display: "flex", gap: 3 }}>
                  {([{ k: "keywords", l: "Kata Kunci" }, { k: "search_terms", l: "Kueri" }, { k: "adgroups", l: "Ad Group" }, { k: "ads", l: "Iklan" }] as const).map(({ k, l }) => (
                    <button key={k} onClick={() => setAdsKwTab(k)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: adsKwTab === k ? 600 : 400, cursor: "pointer", border: adsKwTab === k ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: adsKwTab === k ? "#BB2649" : "transparent", color: adsKwTab === k ? "#fff" : "var(--gray-500)" }}>{l}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", maxHeight: 460 }}>
                {adsKwTab === "keywords" && (
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
                {adsKwTab === "search_terms" && (
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
                {adsKwTab === "adgroups" && (
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
                {adsKwTab === "ads" && (
                  adsLoading ? <Empty msg="Memuat…" /> :
                  adsError ? <Empty msg={`Error: ${String(adsError?.message ?? adsError)}`} /> :
                  !adsList || adsList.length === 0 ? <Empty msg="Belum ada data iklan. Jalankan fetch-google-ads dengan type=ads atau type=all." /> : (
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
                              : <p style={{ fontSize: 12, color: "var(--gray-400)", fontStyle: "italic", margin: "1px 0" }}>{ad.name ?? "(tanpa judul)"}</p>
                            }
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
              </div>
            </div>

          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* SUB-TAB: WEBSITE ANALYTICS (GA4)                                  */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {subTab === "website" && (
        <>
          {/* â”€â”€ KPI strip compact (6 angka dalam 1 baris) â”€â”€ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 12 }}>
            {[
              { label: "Sesi",          val: ga4Loading ? "â€”" : num(ga4Totals?.sessions ?? 0),        color: "#BB2649" },
              { label: "Pengguna",       val: ga4Loading ? "â€”" : num(ga4Totals?.users ?? 0),           color: "#2563EB" },
              { label: "Pengguna Baru",  val: ga4Loading ? "â€”" : num(ga4Totals?.new_users ?? 0),       color: "#6B7280" },
              { label: "Konversi",       val: ga4Loading ? "â€”" : num(ga4Totals?.conversions ?? 0),     color: "#16A34A" },
              { label: "Bounce Rate",    val: ga4Loading ? "â€”" : pct(ga4Totals?.bounce_rate ?? 0),     color: (ga4Totals?.bounce_rate ?? 0) > 60 ? "#D97706" : "#16A34A" },
              { label: "Engagement",     val: ga4Loading ? "â€”" : pct(ga4Totals?.engagement_rate ?? 0), color: (ga4Totals?.engagement_rate ?? 0) >= 40 ? "#16A34A" : "#D97706" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: "var(--surface)", borderRadius: 8, padding: "8px 12px", borderTop: `3px solid ${color}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 10, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "var(--font-mono, monospace)", lineHeight: 1 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* â”€â”€ BARIS 1: 3 chart card dengan tab internal â”€â”€ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>

            {/* Card 1: Tren & Traffic (tabs: Harian | Channel) */}
            <div className="chart-card" style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)" }}>Tren & Traffic</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["Harian", "Channel"] as const).map((t) => {
                    const k = t === "Harian" ? "harian" : "channel";
                    return <button key={t} onClick={() => setTrendTab(k as typeof trendTab)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: trendTab === k ? 600 : 400, cursor: "pointer", border: trendTab === k ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: trendTab === k ? "#BB2649" : "transparent", color: trendTab === k ? "#fff" : "var(--gray-500)" }}>{t}</button>;
                  })}
                </div>
              </div>
              {trendTab === "harian" ? (
                dailyTrend.length === 0 ? <Empty msg="Belum ada data." /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={dailyTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="wS" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} /><stop offset="95%" stopColor="#2563EB" stopOpacity={0} /></linearGradient>
                        <linearGradient id="wU" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16A34A" stopOpacity={0.18} /><stop offset="95%" stopColor="#16A34A" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={fmtDate} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={safeNum} />
                      <Tooltip formatter={(v, n) => [safeNum(v), n]} labelFormatter={(l) => fmtDate(String(l))} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Area type="monotone" dataKey="sessions" name="Sesi" stroke="#2563EB" fill="url(#wS)" strokeWidth={1.5} dot={false} />
                      <Area type="monotone" dataKey="users" name="Pengguna" stroke="#16A34A" fill="url(#wU)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )
              ) : (
                byChannel.length === 0 ? <Empty msg="Belum ada data." /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byChannel} layout="vertical" margin={{ top: 4, right: 8, left: 72, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={safeNum} />
                      <YAxis type="category" dataKey="channel" tick={{ fontSize: 10 }} width={72} />
                      <Tooltip formatter={(v) => [safeNum(v), "Sesi"]} />
                      <Bar dataKey="sessions" radius={[0, 3, 3, 0]}>
                        {byChannel.map((e) => <Cell key={e.channel} fill={CHANNEL_COLORS[e.channel] ?? "#6B7280"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              )}
            </div>

            {/* Card 2: Demografi & Platform (tabs: Usia | Gender | Device) */}
            <div className="chart-card" style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)" }}>Demografi & Platform</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {[{ k: "usia", l: "Usia" }, { k: "gender", l: "Gender" }, { k: "device", l: "Device" }].map(({ k, l }) => (
                    <button key={k} onClick={() => setDemoTab(k as typeof demoTab)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: demoTab === k ? 600 : 400, cursor: "pointer", border: demoTab === k ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: demoTab === k ? "#BB2649" : "transparent", color: demoTab === k ? "#fff" : "var(--gray-500)" }}>{l}</button>
                  ))}
                </div>
              </div>
              {demoTab === "usia" && (demoSummary.byAge.length === 0 ? <Empty msg="Belum ada data." /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={demoSummary.byAge} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                    <XAxis dataKey="age" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={safeNum} />
                    <Tooltip formatter={(v) => [safeNum(v), "Sesi"]} />
                    <Bar dataKey="sessions" fill="#2563EB" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ))}
              {demoTab === "gender" && (demoSummary.byGender.length === 0 ? <Empty msg="Belum ada data." /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={demoSummary.byGender} dataKey="sessions" nameKey="gender" cx="50%" cy="50%" outerRadius={80} label={(p: { name?: string; percent?: number }) => `${p.name ?? ""} ${((p.percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                      {demoSummary.byGender.map((e) => <Cell key={e.gender} fill={GENDER_COLORS[e.gender] ?? "#6B7280"} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [safeNum(v), "Sesi"]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              ))}
              {demoTab === "device" && (platformSummary.byDevice.length === 0 ? <Empty msg="Belum ada data." /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={platformSummary.byDevice} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={safeNum} />
                    <Tooltip formatter={(v) => [safeNum(v), "Sesi"]} />
                    <Bar dataKey="sessions" radius={[3, 3, 0, 0]}>
                      {platformSummary.byDevice.map((e) => <Cell key={e.name} fill={DEVICE_COLORS[e.name.toLowerCase()] ?? "#6B7280"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ))}
            </div>

            {/* Card 3: Kueri Organik Google (top 10 by clicks) */}
            <div className="chart-card" style={{ padding: "12px 14px", overflow: "hidden" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)", display: "block", marginBottom: 8 }}>Kueri Organik Google</span>
              {scLoading ? <Empty msg="Memuatâ€¦" /> : !searchConsole || searchConsole.length === 0 ? <Empty msg="Belum ada data Search Console." /> : (
                <div style={{ overflowY: "auto", maxHeight: 220 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr>{["Kata Kunci", "Klik", "Impresi", "CTR", "Pos"].map((h) => <th key={h} style={{ ...TH_STYLE, fontSize: 10, padding: "4px 6px" }}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {searchConsole.slice(0, 12).map((sc, i) => (
                        <tr key={i} onMouseEnter={(e) => hoverRow(e, true)} onMouseLeave={(e) => hoverRow(e, false)}>
                          <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sc.query}>{sc.query}</td>
                          <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px", fontWeight: 600, color: "#2563EB" }}>{num(sc.clicks)}</td>
                          <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px" }}>{num(sc.impressions)}</td>
                          <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px", color: sc.ctr >= 0.05 ? "#16A34A" : "var(--gray-600)" }}>{pct(sc.ctr * 100)}</td>
                          <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px", color: sc.position <= 3 ? "#16A34A" : sc.position <= 10 ? "#D97706" : "var(--gray-500)", fontWeight: sc.position <= 10 ? 600 : 400 }}>{sc.position.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* â”€â”€ BARIS 2: 3 data card (Konten | Lokasi | Platform) â”€â”€ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>

            {/* Card 4: Konten (tabs: Landing | Halaman) */}
            <div className="chart-card" style={{ padding: "12px 14px", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)" }}>Konten</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {[{ k: "landing", l: "Landing" }, { k: "halaman", l: "Halaman" }].map(({ k, l }) => (
                    <button key={k} onClick={() => setContentTab(k as typeof contentTab)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: contentTab === k ? 600 : 400, cursor: "pointer", border: contentTab === k ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: contentTab === k ? "#BB2649" : "transparent", color: contentTab === k ? "#fff" : "var(--gray-500)" }}>{l}</button>
                  ))}
                </div>
              </div>
              {contentTab === "landing" ? (
                lpLoading ? <Empty msg="Memuatâ€¦" /> : !landingPages || landingPages.length === 0 ? <Empty msg="Belum ada data." /> : (
                  <div style={{ overflowY: "auto", maxHeight: 190 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr>{["URL", "Sesi", "Bounce", "Durasi"].map((h) => <th key={h} style={{ ...TH_STYLE, fontSize: 10, padding: "4px 6px" }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {landingPages.slice(0, 7).map((lp) => (
                          <tr key={lp.landing_page} onMouseEnter={(e) => hoverRow(e, true)} onMouseLeave={(e) => hoverRow(e, false)}>
                            <td style={{ ...TD_STYLE, fontSize: 10, padding: "4px 6px", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace", color: "#2563EB" }} title={lp.landing_page}>{lp.landing_page}</td>
                            <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px", fontWeight: 600 }}>{num(lp.sessions)}</td>
                            <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px", color: lp.bounce_rate > 0.6 ? "#D97706" : "var(--gray-600)" }}>{safePct(lp.bounce_rate * 100)}</td>
                            <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px" }}>{dur(lp.avg_session_duration)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                pagesLoading ? <Empty msg="Memuatâ€¦" /> : !pages || pages.length === 0 ? <Empty msg="Belum ada data." /> : (
                  <div style={{ overflowY: "auto", maxHeight: 190 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr>{["Path", "Tampilan", "Waktu"].map((h) => <th key={h} style={{ ...TH_STYLE, fontSize: 10, padding: "4px 6px" }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {pages.slice(0, 7).map((pg) => (
                          <tr key={pg.page_path} onMouseEnter={(e) => hoverRow(e, true)} onMouseLeave={(e) => hoverRow(e, false)}>
                            <td style={{ ...TD_STYLE, fontSize: 10, padding: "4px 6px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace", color: "#2563EB" }} title={pg.page_path}>{pg.page_path}</td>
                            <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px", fontWeight: 600 }}>{num(pg.screen_page_views)}</td>
                            <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px" }}>{dur(pg.engagement_duration)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>

            {/* Card 5: Lokasi (top negara) */}
            <div className="chart-card" style={{ padding: "12px 14px", overflow: "hidden" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)", display: "block", marginBottom: 8 }}>Lokasi</span>
              {geoLoading ? <Empty msg="Memuatâ€¦" /> : !geoData || geoData.length === 0 ? <Empty msg="Belum ada data." /> : (
                <div style={{ overflowY: "auto", maxHeight: 190 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead><tr>{["#", "Negara", "Sesi", "Pengguna", "Konversi"].map((h) => <th key={h} style={{ ...TH_STYLE, fontSize: 10, padding: "4px 6px" }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {geoData.slice(0, 8).map((g, i) => (
                        <tr key={g.country} onMouseEnter={(e) => hoverRow(e, true)} onMouseLeave={(e) => hoverRow(e, false)}>
                          <td style={{ ...TD_STYLE, fontSize: 10, padding: "4px 6px", color: "var(--gray-400)", width: 20 }}>{i + 1}</td>
                          <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px", fontWeight: 500 }}>{g.country}</td>
                          <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px", fontWeight: 600 }}>{num(g.sessions)}</td>
                          <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px" }}>{num(g.users)}</td>
                          <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px", color: g.conversions > 0 ? "#16A34A" : "var(--gray-400)", fontWeight: g.conversions > 0 ? 600 : 400 }}>{num(g.conversions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Card 6: Platform (tabs: OS | Browser) */}
            <div className="chart-card" style={{ padding: "12px 14px", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)" }}>Platform</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {[{ k: "os", l: "OS" }, { k: "browser", l: "Browser" }].map(({ k, l }) => (
                    <button key={k} onClick={() => setPlatformTab(k as typeof platformTab)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: platformTab === k ? 600 : 400, cursor: "pointer", border: platformTab === k ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: platformTab === k ? "#BB2649" : "transparent", color: platformTab === k ? "#fff" : "var(--gray-500)" }}>{l}</button>
                  ))}
                </div>
              </div>
              {platformLoading ? <Empty msg="Memuatâ€¦" /> : (
                <div style={{ overflowY: "auto", maxHeight: 190 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead><tr><th style={{ ...TH_STYLE, fontSize: 10, padding: "4px 6px" }}>{platformTab === "os" ? "Sistem Operasi" : "Browser"}</th><th style={{ ...TH_STYLE, fontSize: 10, padding: "4px 6px", textAlign: "right" }}>Sesi</th></tr></thead>
                    <tbody>
                      {(platformTab === "os" ? platformSummary.byOS : platformSummary.byBrowser).slice(0, 8).map((item) => (
                        <tr key={item.name} onMouseEnter={(e) => hoverRow(e, true)} onMouseLeave={(e) => hoverRow(e, false)}>
                          <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px" }}>{item.name}</td>
                          <td style={{ ...TD_STYLE, fontSize: 11, padding: "4px 6px", textAlign: "right", fontWeight: 600 }}>{num(item.sessions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
