"use client";
import { useState } from "react";
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import {
  useGa4KpiTotals,
  useGa4DailyTrend,
  useGa4ByChannel,
  useGa4DemographicsSummary,
  useGa4PlatformSummary,
  useGa4LandingPages,
  useGa4Pages,
  useGa4Geography,
  useGa4SearchConsole,
} from "@/hooks/useGoogleData";

// ── Formatting helpers ────────────────────────────────────────────────────────

const isoDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};

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

const safeNum = (v: unknown) => num(Number(v ?? 0));
const safePct = (v: unknown) => pct(Number(v ?? 0));

// ── Color maps ────────────────────────────────────────────────────────────────

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

// ── Style constants ───────────────────────────────────────────────────────────

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

const PRESETS = [
  { label: "7H",  days: 6 },
  { label: "30H", days: 29 },
  { label: "90H", days: 89 },
  { label: "6B",  days: 179 },
  { label: "1T",  days: 364 },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function Empty({ msg }: { msg: string }) {
  return <div className="chart-empty">{msg}</div>;
}

function hoverRow(e: React.MouseEvent<HTMLTableRowElement>, enter: boolean) {
  e.currentTarget.style.background = enter ? "var(--gray-50)" : "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function WebsiteAnalyticsTab() {
  const [dateStart, setDateStart] = useState(isoDate(-29));
  const [dateStop,  setDateStop]  = useState(isoDate(0));
  const [trendTab,    setTrendTab]    = useState<"harian" | "channel">("harian");
  const [demoTab,     setDemoTab]     = useState<"usia" | "gender" | "device">("usia");
  const [contentTab,  setContentTab]  = useState<"landing" | "halaman">("landing");
  const [platformTab, setPlatformTab] = useState<"os" | "browser">("os");

  const applyPreset = (days: number) => {
    setDateStart(isoDate(-days));
    setDateStop(isoDate(0));
  };

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const { totals: ga4Totals, isLoading: ga4Loading } = useGa4KpiTotals(dateStart, dateStop);
  const { dailyTrend } = useGa4DailyTrend(dateStart, dateStop);
  const { byChannel }  = useGa4ByChannel(dateStart, dateStop);
  const { summary: demoSummary,     isLoading: demoLoading }     = useGa4DemographicsSummary(dateStart, dateStop);
  const { summary: platformSummary, isLoading: platformLoading } = useGa4PlatformSummary(dateStart, dateStop);
  const { data: landingPages, isLoading: lpLoading }    = useGa4LandingPages(dateStart, dateStop, 20);
  const { data: pages,        isLoading: pagesLoading } = useGa4Pages(dateStart, dateStop, 20);
  const { data: geoData,      isLoading: geoLoading }   = useGa4Geography(dateStart, dateStop, 20);
  const { data: searchConsole, isLoading: scLoading }   = useGa4SearchConsole(dateStart, dateStop, 50);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px 0" }}>

      {/* ── Date filter ── */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={LABEL_STYLE}>Dari</label>
          <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} style={INPUT_STYLE} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={LABEL_STYLE}>Sampai</label>
          <input type="date" value={dateStop} onChange={(e) => setDateStop(e.target.value)} style={INPUT_STYLE} />
        </div>
        <div style={{ display: "flex", gap: 6, marginLeft: 4 }}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.days)}
              style={{ padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1px solid var(--gray-200)", background: "var(--surface)", color: "var(--gray-600)", transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#BB2649"; e.currentTarget.style.color = "#BB2649"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--gray-200)"; e.currentTarget.style.color = "var(--gray-600)"; }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 12 }}>
        {[
          { label: "Sesi",         val: ga4Loading ? "—" : num(ga4Totals?.sessions ?? 0),        color: "#BB2649" },
          { label: "Pengguna",      val: ga4Loading ? "—" : num(ga4Totals?.users ?? 0),           color: "#2563EB" },
          { label: "Pengguna Baru", val: ga4Loading ? "—" : num(ga4Totals?.new_users ?? 0),       color: "#6B7280" },
          { label: "Konversi",      val: ga4Loading ? "—" : num(ga4Totals?.conversions ?? 0),     color: "#16A34A" },
          { label: "Bounce Rate",   val: ga4Loading ? "—" : pct(ga4Totals?.bounce_rate ?? 0),     color: (ga4Totals?.bounce_rate ?? 0) > 60 ? "#D97706" : "#16A34A" },
          { label: "Engagement",    val: ga4Loading ? "—" : pct(ga4Totals?.engagement_rate ?? 0), color: (ga4Totals?.engagement_rate ?? 0) >= 40 ? "#16A34A" : "#D97706" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: "var(--surface)", borderRadius: 8, padding: "8px 12px", borderTop: `3px solid ${color}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 10, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "var(--font-mono, monospace)", lineHeight: 1 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── Baris 1: Tren & Traffic | Demografi & Platform | Kueri Organik ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>

        {/* Card 1: Tren & Traffic */}
        <div className="chart-card" style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)" }}>Tren & Traffic</span>
            <div style={{ display: "flex", gap: 4 }}>
              {(["Harian", "Channel"] as const).map((t) => {
                const k = t === "Harian" ? "harian" : "channel";
                return (
                  <button key={t} onClick={() => setTrendTab(k as typeof trendTab)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: trendTab === k ? 600 : 400, cursor: "pointer", border: trendTab === k ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: trendTab === k ? "#BB2649" : "transparent", color: trendTab === k ? "#fff" : "var(--gray-500)" }}>
                    {t}
                  </button>
                );
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

        {/* Card 2: Demografi & Platform */}
        <div className="chart-card" style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)" }}>Demografi & Platform</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[{ k: "usia", l: "Usia" }, { k: "gender", l: "Gender" }, { k: "device", l: "Device" }].map(({ k, l }) => (
                <button key={k} onClick={() => setDemoTab(k as typeof demoTab)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: demoTab === k ? 600 : 400, cursor: "pointer", border: demoTab === k ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: demoTab === k ? "#BB2649" : "transparent", color: demoTab === k ? "#fff" : "var(--gray-500)" }}>{l}</button>
              ))}
            </div>
          </div>
          {demoTab === "usia" && (demoLoading ? <Empty msg="Memuat…" /> : demoSummary.byAge.length === 0 ? <Empty msg="Belum ada data." /> : (
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
          {demoTab === "gender" && (demoLoading ? <Empty msg="Memuat…" /> : demoSummary.byGender.length === 0 ? <Empty msg="Belum ada data." /> : (
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
          {demoTab === "device" && (platformLoading ? <Empty msg="Memuat…" /> : platformSummary.byDevice.length === 0 ? <Empty msg="Belum ada data." /> : (
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

        {/* Card 3: Kueri Organik Google */}
        <div className="chart-card" style={{ padding: "12px 14px", overflow: "hidden" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)", display: "block", marginBottom: 8 }}>Kueri Organik Google</span>
          {scLoading ? <Empty msg="Memuat…" /> : !searchConsole || searchConsole.length === 0 ? <Empty msg="Belum ada data Search Console." /> : (
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

      {/* ── Baris 2: Konten | Lokasi | Platform ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>

        {/* Card 4: Konten (Landing | Halaman) */}
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
            lpLoading ? <Empty msg="Memuat…" /> : !landingPages || landingPages.length === 0 ? <Empty msg="Belum ada data." /> : (
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
            pagesLoading ? <Empty msg="Memuat…" /> : !pages || pages.length === 0 ? <Empty msg="Belum ada data." /> : (
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

        {/* Card 5: Lokasi */}
        <div className="chart-card" style={{ padding: "12px 14px", overflow: "hidden" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)", display: "block", marginBottom: 8 }}>Lokasi</span>
          {geoLoading ? <Empty msg="Memuat…" /> : !geoData || geoData.length === 0 ? <Empty msg="Belum ada data." /> : (
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

        {/* Card 6: Platform (OS | Browser) */}
        <div className="chart-card" style={{ padding: "12px 14px", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)" }}>Platform</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[{ k: "os", l: "OS" }, { k: "browser", l: "Browser" }].map(({ k, l }) => (
                <button key={k} onClick={() => setPlatformTab(k as typeof platformTab)} style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: platformTab === k ? 600 : 400, cursor: "pointer", border: platformTab === k ? "1px solid #BB2649" : "1px solid var(--gray-200)", background: platformTab === k ? "#BB2649" : "transparent", color: platformTab === k ? "#fff" : "var(--gray-500)" }}>{l}</button>
              ))}
            </div>
          </div>
          {platformLoading ? <Empty msg="Memuat…" /> : (
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
    </div>
  );
}
