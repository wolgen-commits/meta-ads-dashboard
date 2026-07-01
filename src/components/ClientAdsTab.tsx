"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  ComposedChart, Bar, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Cell,
} from "recharts";
import { KpiCard }         from "@/components/KpiCard";
import { DateRangePicker } from "@/components/DateRangePicker";
import { useTheme }        from "@/hooks/useTheme";
import {
  useClientCampaigns,
  useClientKpiTotals,
  useClientSpendChart,
  useClientEngagementChart,
  useClientCampaignTable,
  useClientSyncLog,
  useClientAudienceWithMessaging,
  type ClientAudienceRow,
} from "@/hooks/useClientData";

const isoDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};
const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const shortIdr = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}rb` : String(Math.round(v));
const num = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}rb` : String(n);
const fmt = (d: unknown) =>
  new Date(String(d)).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

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

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_AWARENESS:     "Kesadaran",
  OUTCOME_TRAFFIC:       "Lalu Lintas",
  OUTCOME_ENGAGEMENT:    "Interaksi",
  OUTCOME_LEADS:         "Prospek",
  OUTCOME_SALES:         "Penjualan",
  OUTCOME_APP_PROMOTION: "Promosi Aplikasi",
  MESSAGES:              "Pesan",
};

// ── Audience chart helpers ────────────────────────────────────────────────────

const AUD_COLORS = ["#BB2649","#C94063","#D75A7D","#2563EB","#3B82F6","#60A5FA","#16A34A","#22C55E","#D97706","#F59E0B"];
const AGE_ORDER  = ["13-17","18-24","25-34","35-44","45-54","55-64","65+"];
const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram", messenger: "Messenger", audience_network: "Audience Network",
};
const DEVICE_LABEL: Record<string, string> = {
  mobile_app: "Mobile App", desktop: "Desktop",
  android_smartphone: "Android", iphone: "iPhone", ipad: "iPad", android_tablet: "Android Tablet",
};

type AudMetric = "impressions" | "reach" | "messaging_conversations";

// ── Main tab ──────────────────────────────────────────────────────────────────

type EngMetric = "all" | "reactions" | "comments" | "shares" | "saves" | "conversations";
const ENG_METRICS: { key: EngMetric; label: string; color: string }[] = [
  { key: "all",           label: "Semua",      color: "#6366F1" },
  { key: "reactions",     label: "Like",        color: "#BB2649" },
  { key: "comments",      label: "Komentar",    color: "#2563EB" },
  { key: "shares",        label: "Bagikan",     color: "#16A34A" },
  { key: "saves",         label: "Disimpan",    color: "#D97706" },
  { key: "conversations", label: "Percakapan",  color: "#9333EA" },
];

function CampaignFilter({
  campaigns,
  selected,
  onChange,
}: {
  campaigns: { id: string; name: string; objective: string | null }[];
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
  const btnLabel = allSelected
    ? "Semua campaign"
    : selected.length <= 2
      ? selected.map((id) => campaigns.find((c) => c.id === id)?.name ?? id).join(", ")
      : `${selected.length} campaign dipilih`;

  return (
    <div className="cf-wrap" ref={ref}>
      <button className="cf-btn" onClick={() => setOpen(!open)}>
        <span>{btnLabel}</span>
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
                <div>
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "#999" }}>
                    {OBJECTIVE_LABELS[c.objective ?? ""] ?? c.objective ?? "—"}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ClientAdsTab({ slug, businessId }: { slug: string; businessId: string }) {
  const [dateStart, setDateStart] = useState(isoDate(-29));
  const [dateStop,  setDateStop]  = useState(isoDate(0));
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [engMetric, setEngMetric]   = useState<EngMetric>("all");
  const [audMetric, setAudMetric]   = useState<AudMetric>("impressions");
  const [platTab,   setPlatTab]     = useState<"platform" | "device">("platform");

  // Performance hooks
  const { data: campaigns }                      = useClientCampaigns(slug, dateStart, dateStop);
  const { totals, isLoading: kpiLoading }        = useClientKpiTotals(slug, dateStart, dateStop, selectedCampaigns);
  const { chartData: spendData, isLoading: spendLoading } = useClientSpendChart(slug, dateStart, dateStop, selectedCampaigns);
  const { chartData: engData,   isLoading: engLoading }   = useClientEngagementChart(slug, dateStart, dateStop, selectedCampaigns);
  const { tableData, isLoading: tableLoading }   = useClientCampaignTable(slug, dateStart, dateStop, selectedCampaigns);
  const { data: syncLog }                        = useClientSyncLog(slug);

  // Audience hooks
  const { data: ageData,    isLoading: loadAge  } = useClientAudienceWithMessaging(slug, "age,gender",                          dateStart, dateStop, selectedCampaigns);
  const { data: regionData, isLoading: loadReg  } = useClientAudienceWithMessaging(slug, "region",                              dateStart, dateStop, selectedCampaigns);
  const { data: platData,   isLoading: loadPlat } = useClientAudienceWithMessaging(slug, "publisher_platform,impression_device", dateStart, dateStop, selectedCampaigns);

  const { theme } = useTheme();
  const gridColor  = theme === "dark" ? "#34343A" : "#E5E5EA";
  const tickColor  = theme === "dark" ? "#9B9BA3" : "#A1A1AA";
  const tooltipBg  = theme === "dark" ? "#1F1F22" : "#FFFFFF";

  const campaignMap = useMemo(() => {
    const m: Record<string, string> = {};
    (campaigns ?? []).forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [campaigns]);

  type SyncLogRow = { id: number; started_at: string; status: string };
  const lastSync = syncLog ? (syncLog as SyncLogRow[])[0] : undefined;

  // Spend / Engagement
  const totalSpend         = spendData.reduce((s, d) => s + d.spend, 0);
  const totalConversations = spendData.reduce((s, d) => s + d.conversations, 0);
  const spendDataWithCpa = useMemo(
    () => spendData.map((d) => ({ ...d, cpa: d.conversations > 0 ? d.spend / d.conversations : 0 })),
    [spendData],
  );
  const activeEngMetric = ENG_METRICS.find((m) => m.key === engMetric)!;
  const engChartData    = engData.map((d) => ({ ...d, all: d.reactions + d.comments + d.shares + d.saves + d.conversations }));
  const totalEngActive  = engChartData.reduce((s, d) => s + (d[engMetric as keyof typeof d] as number ?? 0), 0);

  // Audience derived data
  const getAudVal = (row: ClientAudienceRow) =>
    audMetric === "reach"                   ? row.reach :
    audMetric === "messaging_conversations" ? row.messaging_conversations :
    row.impressions;

  const AUD_METRIC_LABEL: Record<AudMetric, string> = {
    impressions: "Impresi", reach: "Jangkauan", messaging_conversations: "Percakapan",
  };
  const audMetricLabel = AUD_METRIC_LABEL[audMetric];

  const byAge = useMemo(() => {
    const acc: Record<string, { age: string; value: number }> = {};
    (ageData ?? []).forEach((row) => {
      const age = row.age ?? "Unknown";
      if (!acc[age]) acc[age] = { age, value: 0 };
      acc[age].value += getAudVal(row);
    });
    return Object.values(acc).sort((a, b) => {
      const ai = AGE_ORDER.indexOf(a.age); const bi = AGE_ORDER.indexOf(b.age);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageData, audMetric]);

  const byAgeGender = useMemo(() => {
    const acc: Record<string, { age: string; perempuan: number; laki: number; lainnya: number }> = {};
    (ageData ?? []).forEach((row) => {
      const age = row.age ?? "Unknown"; const gender = row.gender ?? "unknown"; const val = getAudVal(row);
      if (!acc[age]) acc[age] = { age, perempuan: 0, laki: 0, lainnya: 0 };
      if (gender === "female") acc[age].perempuan += val;
      else if (gender === "male") acc[age].laki += val;
      else acc[age].lainnya += val;
    });
    return Object.values(acc).sort((a, b) => {
      const ai = AGE_ORDER.indexOf(a.age); const bi = AGE_ORDER.indexOf(b.age);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageData, audMetric]);

  const regionChart = useMemo(() => {
    const acc: Record<string, { region: string; value: number }> = {};
    (regionData ?? []).forEach((row) => {
      const region = row.region ?? "Unknown";
      if (!acc[region]) acc[region] = { region, value: 0 };
      acc[region].value += getAudVal(row);
    });
    return Object.values(acc).sort((a, b) => b.value - a.value).filter((r) => r.value > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionData, audMetric]);

  const { platformChart, deviceChart } = useMemo(() => {
    const byP: Record<string, { name: string; value: number }> = {};
    const byD: Record<string, { name: string; value: number }> = {};
    (platData ?? []).forEach((row) => {
      const pk = row.publisher_platform ?? "unknown";
      if (!byP[pk]) byP[pk] = { name: PLATFORM_LABEL[pk] ?? pk, value: 0 };
      byP[pk].value += getAudVal(row);
      const dk = row.impression_device ?? "unknown";
      if (!byD[dk]) byD[dk] = { name: DEVICE_LABEL[dk] ?? dk, value: 0 };
      byD[dk].value += getAudVal(row);
    });
    return {
      platformChart: Object.values(byP).sort((a, b) => b.value - a.value),
      deviceChart:   Object.values(byD).sort((a, b) => b.value - a.value),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platData, audMetric]);

  const ageTotal      = byAge.reduce((s, d) => s + d.value, 0);
  const demoTotalP    = byAgeGender.reduce((s, d) => s + d.perempuan, 0);
  const demoTotalL    = byAgeGender.reduce((s, d) => s + d.laki, 0);
  const demoTotal     = byAgeGender.reduce((s, d) => s + d.perempuan + d.laki + d.lainnya, 0);
  const regionTotal   = regionChart.reduce((s, d) => s + d.value, 0);
  const activePlatChart = platTab === "platform" ? platformChart : deviceChart;
  const activePlatTotal = activePlatChart.reduce((s, d) => s + d.value, 0);

  const CHART_H = 260;
  const tooltipStyle = { fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg };
  const xTick   = { fontSize: 10, fill: tickColor, fontFamily: "DM Sans" };
  const yTick   = { fontSize: 10, fill: tickColor, fontFamily: "DM Sans" };

  return (
    <>
      {/* Filter bar */}
      <div className="filter-bar">
        <DateRangePicker
          dateStart={dateStart}
          dateStop={dateStop}
          onChange={(s, e) => { setDateStart(s); setDateStop(e); setSelectedCampaigns([]); }}
          maxDate={isoDate(0)}
        />
        {(campaigns ?? []).length > 0 && (
          <CampaignFilter
            campaigns={campaigns ?? []}
            selected={selectedCampaigns}
            onChange={setSelectedCampaigns}
          />
        )}
        {selectedCampaigns.length > 0 && (
          <button onClick={() => setSelectedCampaigns([])} className="cf-btn"
            style={{ fontSize: 12, color: "#BB2649", border: "1px solid #BB2649" }}>
            Reset filter
          </button>
        )}
        <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ fontSize: 11, color: tickColor, fontFamily: "DM Mono, monospace" }}>
            Business ID: <strong>{businessId}</strong>
          </span>
          <span style={{ fontSize: 11, color: tickColor, fontFamily: "DM Sans" }}>
            {lastSync
              ? `Sync: ${new Date(lastSync.started_at).toLocaleString("id-ID")} · ${lastSync.status}`
              : "Belum ada sync"}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="kpi-grid">
        <KpiCard label="Total Biaya"  value={totals ? idr(totals.spend)                  : "—"} accent="magenta" loading={kpiLoading} description={KPI_DESCRIPTIONS["Total Biaya"]} />
        <KpiCard label="Percakapan"   value={totals ? num(totals.messaging_conversations) : "—"} sub="pesan dimulai" loading={kpiLoading} description={KPI_DESCRIPTIONS["Percakapan"]} />
        <KpiCard label="Impresi"      value={totals ? num(totals.impressions)             : "—"} loading={kpiLoading} description={KPI_DESCRIPTIONS["Impresi"]} />
        <KpiCard label="Jangkauan"    value={totals ? num(totals.reach)                   : "—"} accent="info" loading={kpiLoading} description={KPI_DESCRIPTIONS["Jangkauan"]} />
        <KpiCard label="Klik Tautan"  value={totals ? num(totals.link_clicks)             : "—"} loading={kpiLoading} description={KPI_DESCRIPTIONS["Klik Tautan"]} />
        <KpiCard label="CPC (Semua)"  value={totals ? idr(totals.cpc)                    : "—"} sub="per klik" loading={kpiLoading} description={KPI_DESCRIPTIONS["CPC (Semua)"]} />
        <KpiCard label="CTR (Semua)"  value={totals ? `${totals.ctr.toFixed(2)}%`        : "—"} loading={kpiLoading} description={KPI_DESCRIPTIONS["CTR (Semua)"]} />
        <KpiCard label="CPM"          value={totals ? idr(totals.cpm)                    : "—"} sub="per 1.000 tayang" loading={kpiLoading} description={KPI_DESCRIPTIONS["CPM"]} />
      </section>

      {/* Metric tab bar — sama seperti Magenta */}
      <div className="metric-tab-bar">
        <span className="metric-tab-label">Tampilkan segmen berdasarkan:</span>
        {([
          { key: "impressions",             label: "Impresi" },
          { key: "reach",                   label: "Jangkauan" },
          { key: "messaging_conversations", label: "Percakapan Pesan Dimulai" },
        ] as const).map(({ key, label }) => (
          <button key={key} className={`breakdown-tab${audMetric === key ? " active" : ""}`}
            onClick={() => setAudMetric(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* Charts — urutan: Spend | Usia | Demografis | Wilayah | Platform | Engagement */}
      <section className="charts-grid">

        {/* 1. Spend Harian & CPA */}
        <div className="chart-card">
          <div className="chart-header-row">
            <div>
              <h3 className="chart-title" style={{ marginBottom: 2 }}>Spend Harian & CPA</h3>
              <div style={{ display: "flex", gap: 12, fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>
                <span>Total Spend: <strong style={{ color: "#BB2649" }}>{idr(totalSpend)}</strong></span>
                <span>·</span>
                <span>Percakapan: <strong style={{ color: "#2563EB" }}>{totalConversations.toLocaleString("id-ID")}</strong></span>
              </div>
            </div>
            <span style={{ fontSize: 10, color: tickColor, fontFamily: "DM Sans" }}>CPA = Spend ÷ Percakapan</span>
          </div>
          {spendLoading ? <div className="chart-skeleton" style={{ height: CHART_H }} /> : (
            <ResponsiveContainer width="100%" height={CHART_H}>
              <ComposedChart data={spendDataWithCpa} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 11, fill: tickColor, fontFamily: "DM Sans" }} />
                <YAxis yAxisId="spend" tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}jt`} tick={{ fontSize: 11, fill: tickColor, fontFamily: "DM Sans" }} />
                <YAxis yAxisId="cpa" orientation="right" tickFormatter={shortIdr} tick={{ fontSize: 11, fill: tickColor, fontFamily: "DM Sans" }} />
                <Tooltip
                  formatter={(v, name) => name === "Spend" ? [idr(Number(v)), "Spend"] : [idr(Number(v)), "CPA (Biaya/Percakapan)"]}
                  labelFormatter={fmt} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: "DM Sans" }} />
                <Bar  yAxisId="spend" dataKey="spend" name="Spend"                    fill="#BB2649" radius={[4, 4, 0, 0]} opacity={0.85} />
                <Line yAxisId="cpa"   dataKey="cpa"   name="CPA (Rp/Percakapan)"      stroke="#2563EB" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 2. Distribusi Usia */}
        <div className="chart-card">
          <div style={{ marginBottom: 8 }}>
            <h3 className="chart-title" style={{ marginBottom: 2 }}>Distribusi Usia — {audMetricLabel}</h3>
            <div style={{ fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>
              Est. Total {audMetricLabel}: <strong style={{ color: "#BB2649" }}>{num(ageTotal)}</strong>
              {audMetric === "reach" && (
                <span style={{ marginLeft: 6, fontSize: 10, color: "#A1A1AA" }}>*hanya pengguna dengan data usia tersedia</span>
              )}
            </div>
          </div>
          {loadAge ? <div className="chart-skeleton" style={{ height: CHART_H }} /> : byAge.length === 0 ? (
            <div className="chart-empty">Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={CHART_H}>
              <BarChart data={byAge} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="age" tick={xTick} />
                <YAxis tick={yTick} tickFormatter={num} width={42} />
                <Tooltip formatter={(v: unknown) => [num(Number(v ?? 0)), audMetricLabel]} contentStyle={tooltipStyle} />
                <Bar dataKey="value" name={audMetricLabel} fill="#BB2649" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 3. Demografis Usia & Gender */}
        <div className="chart-card">
          <div style={{ marginBottom: 8 }}>
            <h3 className="chart-title" style={{ marginBottom: 2 }}>Demografis Usia & Gender — {audMetricLabel}</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>
              <span>Est. Total: <strong style={{ color: "var(--gray-900)" }}>{num(demoTotal)}</strong></span>
              <span>·</span>
              <span style={{ color: "#BB2649" }}>P: <strong>{num(demoTotalP)}</strong></span>
              <span>·</span>
              <span style={{ color: "#2563EB" }}>L: <strong>{num(demoTotalL)}</strong></span>
              {audMetric === "reach" && (
                <span style={{ fontSize: 10, color: "#A1A1AA" }}>*hanya pengguna dengan data usia tersedia</span>
              )}
            </div>
          </div>
          {loadAge ? <div className="chart-skeleton" style={{ height: CHART_H }} /> : byAgeGender.length === 0 ? (
            <div className="chart-empty">Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={CHART_H}>
              <BarChart data={byAgeGender} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="age" tick={xTick} />
                <YAxis tick={yTick} tickFormatter={num} width={42} />
                <Tooltip formatter={(v: unknown, name: unknown) => [num(Number(v ?? 0)), String(name)]} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: "DM Sans" }} />
                <Bar dataKey="perempuan" name="Perempuan" stackId="a" fill="#BB2649" />
                <Bar dataKey="laki"      name="Laki-laki" stackId="a" fill="#2563EB" />
                <Bar dataKey="lainnya"   name="Lainnya"   stackId="a" fill="#9B9BA3" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 4. Top 10 Wilayah */}
        <div className="chart-card">
          <div style={{ marginBottom: 8 }}>
            <h3 className="chart-title" style={{ marginBottom: 2 }}>Top 10 Wilayah — {audMetricLabel}</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>
              <span>Est. Total: <strong style={{ color: "#BB2649" }}>{num(regionTotal)}</strong></span>
              <span>·</span>
              <span>{regionChart.length} wilayah</span>
              {audMetric === "reach" && (
                <span style={{ fontSize: 10, color: "#A1A1AA" }}>*hanya pengguna dengan data wilayah tersedia</span>
              )}
            </div>
          </div>
          {loadReg ? <div className="chart-skeleton" style={{ height: CHART_H }} /> : regionChart.length === 0 ? (
            <div className="chart-empty">Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={CHART_H}>
              <BarChart data={regionChart.slice(0, 10)} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" tick={xTick} tickFormatter={num} />
                <YAxis type="category" dataKey="region" interval={0} tick={{ fontSize: 9, fill: tickColor, fontFamily: "DM Sans" }} width={80} />
                <Tooltip formatter={(v: unknown) => [num(Number(v ?? 0)), audMetricLabel]} contentStyle={tooltipStyle} />
                <Bar dataKey="value" name={audMetricLabel} radius={[0, 3, 3, 0]}>
                  {regionChart.slice(0, 10).map((_, i) => <Cell key={i} fill={AUD_COLORS[i % AUD_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 5. Platform & Media */}
        <div className="chart-card">
          <div className="chart-header-row">
            <div>
              <h3 className="chart-title" style={{ marginBottom: 2 }}>Platform & Media</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>
                <span>Est. Total {audMetricLabel}: <strong style={{ color: "#BB2649" }}>{num(activePlatTotal)}</strong></span>
                {audMetric === "reach" && (
                  <span style={{ fontSize: 10, color: "#A1A1AA" }}>*hanya pengguna dengan data platform tersedia</span>
                )}
              </div>
            </div>
            <div className="eng-tabs">
              <button className={`eng-tab${platTab === "platform" ? " active" : ""}`}
                style={platTab === "platform" ? { borderColor: "#BB2649", color: "#BB2649" } : undefined}
                onClick={() => setPlatTab("platform")}>Platform</button>
              <button className={`eng-tab${platTab === "device" ? " active" : ""}`}
                style={platTab === "device" ? { borderColor: "#2563EB", color: "#2563EB" } : undefined}
                onClick={() => setPlatTab("device")}>Perangkat</button>
            </div>
          </div>
          {loadPlat ? <div className="chart-skeleton" style={{ height: CHART_H, marginTop: 12 }} /> : activePlatChart.length === 0 ? (
            <div className="chart-empty">Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={CHART_H}>
              <BarChart data={activePlatChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: tickColor, fontFamily: "DM Sans" }} interval={0} />
                <YAxis tick={yTick} tickFormatter={num} width={40} />
                <Tooltip formatter={(v: unknown) => [num(Number(v ?? 0)), audMetricLabel]} contentStyle={tooltipStyle} />
                <Bar dataKey="value" name={audMetricLabel} radius={[3, 3, 0, 0]}>
                  {activePlatChart.map((_, i) => <Cell key={i} fill={AUD_COLORS[i % AUD_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 6. Engagement */}
        <div className="chart-card">
          <div className="chart-header-row">
            <div>
              <h3 className="chart-title" style={{ marginBottom: 2 }}>Engagement</h3>
              <div style={{ fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>
                Total {activeEngMetric.label}: <strong style={{ color: activeEngMetric.color }}>{num(totalEngActive)}</strong>
              </div>
            </div>
            <div className="eng-tabs">
              {ENG_METRICS.map((m) => (
                <button key={m.key} className={`eng-tab${engMetric === m.key ? " active" : ""}`}
                  style={engMetric === m.key ? { borderColor: m.color, color: m.color } : undefined}
                  onClick={() => setEngMetric(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {engLoading ? <div className="chart-skeleton" style={{ height: CHART_H, marginTop: 12 }} /> : (
            <ResponsiveContainer width="100%" height={CHART_H}>
              <AreaChart data={engChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  {engMetric === "all" ? (
                    ENG_METRICS.filter((m) => m.key !== "all").map((m) => (
                      <linearGradient key={m.key} id={`ceng-grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={m.color} stopOpacity={0.05} />
                        <stop offset="95%" stopColor={m.color} stopOpacity={0.01} />
                      </linearGradient>
                    ))
                  ) : (
                    <linearGradient id={`ceng-grad-${activeEngMetric.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={activeEngMetric.color} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={activeEngMetric.color} stopOpacity={0.01} />
                    </linearGradient>
                  )}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} />
                <YAxis tick={yTick} tickFormatter={(v) => num(v)} width={38} />
                <Tooltip labelFormatter={fmt} formatter={(v, name) => [num(Number(v)), name]} contentStyle={tooltipStyle} />
                {engMetric === "all" ? (
                  ENG_METRICS.filter((m) => m.key !== "all").map((m) => (
                    <Area key={m.key} type="monotone" dataKey={m.key} name={m.label}
                      stroke={m.color} fill={`url(#ceng-grad-${m.key})`} strokeWidth={2} />
                  ))
                ) : (
                  <Area type="monotone" dataKey={engMetric} name={activeEngMetric.label}
                    stroke={activeEngMetric.color} fill={`url(#ceng-grad-${activeEngMetric.key})`} strokeWidth={2} />
                )}
                {engMetric === "all" && <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Sans" }} />}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

      </section>

      {/* Campaign table */}
      <div style={{ background: "var(--surface, #fff)", borderRadius: 12, border: "1px solid var(--border, #E5E5EA)", overflow: "hidden", marginTop: 16 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border, #E5E5EA)" }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "var(--text-primary, #1A1A2E)" }}>
            Performa per Campaign
          </h3>
        </div>
        {tableLoading ? (
          <div style={{ padding: 24, color: "#999", fontSize: 13 }}>Memuat data...</div>
        ) : tableData.length === 0 ? (
          <div style={{ padding: 24, color: "#999", fontSize: 13, textAlign: "center" }}>
            Tidak ada data untuk periode ini
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "DM Sans" }}>
              <thead>
                <tr style={{ background: "var(--gray-50, #F9FAFB)", textTransform: "uppercase", fontSize: 11, color: "#6B7280" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600 }}>Campaign</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>Biaya</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>Impresi</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>Jangkauan</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>Klik</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>Leads</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>Percakapan</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row) => (
                  <tr key={row.campaign_id} style={{ borderTop: "1px solid var(--border, #F3F4F6)" }}>
                    <td style={{ padding: "10px 16px", color: "var(--text-primary, #1A1A2E)", fontWeight: 500, maxWidth: 280 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {campaignMap[row.campaign_id] ?? row.campaign_id}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#BB2649", fontWeight: 600, fontFamily: "DM Mono, monospace" }}>{idr(row.spend)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "DM Mono, monospace" }}>{num(row.impressions)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "DM Mono, monospace" }}>{num(row.reach)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "DM Mono, monospace" }}>{num(row.clicks)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "DM Mono, monospace", color: "#16A34A", fontWeight: 600 }}>{num(row.leads)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "DM Mono, monospace", color: "#2563EB" }}>{num(row.conversations)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
