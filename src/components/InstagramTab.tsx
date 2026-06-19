"use client";
import { useState, useEffect } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { useIgAccounts, useIgContentOverview, useIgDailyChart, useIgTopMedia, useIgAccountInsightsTrend, useIgAudienceDemographics, useIgOnlineFollowers } from "@/hooks/useMetaData";
import type { IgMedia, IgMediaInsight } from "@/hooks/useMetaData";
import { useTheme } from "@/hooks/useTheme";

const isoDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};

const num = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}rb` : String(n);

const fmtAxisDate = (d: unknown) =>
  new Date(String(d)).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

const COUNTRY_NAMES: Record<string, string> = {
  ID: "Indonesia", IN: "India", US: "Amerika Serikat", MY: "Malaysia",
  SG: "Singapura", PK: "Pakistan", BD: "Bangladesh", PH: "Filipina",
  GB: "Inggris", AU: "Australia", CA: "Kanada", AE: "Uni Emirat Arab",
  SA: "Arab Saudi", NG: "Nigeria", EG: "Mesir", TH: "Thailand",
  VN: "Vietnam", JP: "Jepang", KR: "Korea Selatan", CN: "Tiongkok",
  DE: "Jerman", FR: "Prancis", NL: "Belanda", IT: "Italia", ES: "Spanyol",
  BR: "Brasil", MX: "Meksiko", ZA: "Afrika Selatan", TR: "Turki",
  IR: "Iran", IQ: "Irak", KW: "Kuwait", QA: "Qatar", BH: "Bahrain",
};
const countryName = (code: string) => COUNTRY_NAMES[code.toUpperCase()] ?? code;

const fmtCardDate = (ts: string) =>
  new Date(ts).toLocaleString("id-ID", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).replace("pukul ", "");

const fmtPeriod = (start: string, stop: string) => {
  const s = new Date(start).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const e = new Date(stop).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  return `${s} – ${e}`;
};

function GrowthBadge({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="ig-growth-neutral">—</span>;
  if (pct === 0)   return <span className="ig-growth-neutral">0%</span>;
  const up = pct > 0;
  return (
    <span className={up ? "ig-growth-up" : "ig-growth-down"}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

const IG_CHART_HEIGHT = 300;

type ContentType = "semua" | "postingan" | "cerita";

const CONTENT_TABS: { key: ContentType; label: string }[] = [
  { key: "semua",     label: "Semua"     },
  { key: "postingan", label: "Postingan" },
  { key: "cerita",    label: "Cerita"    },
];

function PopularCard({ media, onClick }: { media: IgMedia & Partial<IgMediaInsight>; onClick: () => void }) {
  const isVideo = media.media_product_type === "REELS" || media.media_type === "VIDEO";
  return (
    <div className="ig-popular-card" onClick={onClick} style={{ cursor: "pointer" }}>
      <div className="ig-card-thumb">
        {media.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.thumbnail_url} alt="" loading="lazy" />
        ) : (
          <div className="ig-card-thumb-placeholder">
            <span>{isVideo ? "▶" : "🖼"}</span>
          </div>
        )}
        <span className="ig-card-type-badge">{isVideo ? "▶" : "📷"}</span>
      </div>
      <div className="ig-card-info">
        <p className="ig-card-caption">
          {media.caption
            ? media.caption.slice(0, 55) + (media.caption.length > 55 ? "…" : "")
            : "(tanpa caption)"}
        </p>
        <p className="ig-card-date">{fmtCardDate(media.timestamp)}</p>
        <div className="ig-card-metrics">
          <span title="Tayangan">👁 {num((media as IgMediaInsight).impressions ?? 0)}</span>
          <span title="Jangkauan">👥 {num(media.reach ?? 0)}</span>
          <span title="Suka">❤️ {num(media.likes ?? 0)}</span>
          <span title="Bagikan">↗ {num(media.shares ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}

function MediaDetailModal({ media, onClose }: { media: IgMedia & Partial<IgMediaInsight>; onClose: () => void }) {
  const isVideo  = media.media_product_type === "REELS" || media.media_type === "VIDEO";
  const isReels  = media.media_product_type === "REELS";
  const typeLabel = isReels ? "Reels" : isVideo ? "Video" : "Postingan";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const metrics: { label: string; value: number; show?: boolean }[] = [
    { label: "Tayangan",  value: (media as IgMediaInsight).impressions ?? 0 },
    { label: "Jangkauan", value: media.reach   ?? 0 },
    { label: "Suka",      value: media.likes   ?? 0 },
    { label: "Komentar",  value: media.comments ?? 0 },
    { label: "Bagikan",   value: media.shares  ?? 0 },
    { label: "Disimpan",  value: media.saved   ?? 0 },
    { label: "Ditonton",  value: media.video_views ?? 0, show: isVideo },
    { label: "Diputar",   value: media.plays       ?? 0, show: isReels },
  ].filter(m => m.show !== false);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--ig" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Detail Konten</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="ig-modal-body">
          <div className="ig-modal-thumb">
            {media.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.thumbnail_url} alt="" />
            ) : (
              <div className="ig-modal-thumb-placeholder">
                <span>{isVideo ? "▶" : "🖼"}</span>
              </div>
            )}
          </div>
          <div className="ig-modal-info">
            <span className="ig-modal-type">{isVideo ? "▶" : "📷"} {typeLabel}</span>
            <span className="ig-modal-date">{fmtCardDate(media.timestamp)}</span>
            <p className="ig-modal-caption">
              {media.caption ?? "(tanpa caption)"}
            </p>
          </div>
        </div>

        <div className="ig-modal-metrics">
          {metrics.map(m => (
            <div key={m.label} className="ig-modal-metric">
              <span className="ig-modal-metric-label">{m.label}</span>
              <span className="ig-modal-metric-value">{m.value.toLocaleString("id-ID")}</span>
            </div>
          ))}
        </div>

        <div className="ig-modal-footer">
          {media.permalink && (
            <a
              href={media.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="ig-action-btn"
            >
              Buka di Instagram ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function InstagramTab() {
  const [dateStart, setDateStart] = useState(isoDate(-29));
  const [dateStop,  setDateStop]  = useState(isoDate(0));
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [contentTab, setContentTab] = useState<ContentType>("semua");
  const [selectedMedia, setSelectedMedia] = useState<(IgMedia & Partial<IgMediaInsight>) | null>(null);
  const [chartView, setChartView] = useState<"organik" | "follow_type">("organik");

  const { data: accounts, isLoading: loadingAccounts } = useIgAccounts();
  const currentId      = activeAccount ?? accounts?.[0]?.id ?? "";
  const currentAccount = accounts?.find(a => a.id === currentId);

  const { data: overview, isLoading: loadingOverview } = useIgContentOverview(
    currentId, dateStart, dateStop, contentTab,
  );
  const { data: dailyChart, isLoading: loadingChart } = useIgDailyChart(
    currentId, dateStart, dateStop,
  );
  const { data: topMedia, isLoading: loadingMedia } = useIgTopMedia(
    currentId, "2000-01-01", isoDate(0), 10,
  );
  const { data: insightsTrend, isLoading: loadingInsights } = useIgAccountInsightsTrend(
    currentId, dateStart, dateStop,
  );
  const { byAge, byGender, byCountry, byCity, hasData: hasAudienceData, isLoading: loadingAudience } = useIgAudienceDemographics(currentId || null);
  const { data: onlineFollowers, isLoading: loadingOnline } = useIgOnlineFollowers(currentId || null);

  const { theme } = useTheme();
  const gridColor = theme === "dark" ? "#34343A" : "#E5E5EA";
  const tickColor = theme === "dark" ? "#9B9BA3" : "#A1A1AA";
  const tooltipBg = theme === "dark" ? "#1F1F22" : "#FFFFFF";

  if (loadingAccounts) return <div className="chart-skeleton" style={{ height: 300 }} />;
  if (!accounts || accounts.length === 0)
    return <p style={{ color: "var(--gray-400)", fontSize: 14 }}>Belum ada akun Instagram yang terhubung.</p>;

  const igUrl = `https://www.instagram.com/${currentAccount?.username ?? ""}/`;

  return (
    <div className="ig-tab">
      {selectedMedia && (
        <MediaDetailModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
      )}

      {/* ── Header: lihat lebih banyak + account selector + date range ── */}
      <div className="ig-tab-header">
        <a href={igUrl} target="_blank" rel="noopener noreferrer" className="ig-more-link">
          Lihat lebih banyak
        </a>

        <div className="ig-tab-header-controls">
          <div className="ig-account-select-wrap">
            <span className="ig-select-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
            </span>
            <select
              className="ig-account-select"
              value={currentId}
              onChange={e => setActiveAccount(e.target.value)}
            >
              {accounts.filter(a => a.id === "17841457712254566").map(a => (
                <option key={a.id} value={a.id}>
                  @{a.username ?? a.name}
                </option>
              ))}
            </select>
            <span className="ig-select-arrow">▾</span>
          </div>

          <div className="ig-date-picker">
            <span className="ig-date-icon">📅</span>
            <input
              type="date"
              className="ig-date-input"
              value={dateStart}
              max={dateStop}
              onChange={e => setDateStart(e.target.value)}
            />
            <span style={{ color: "var(--gray-400)", fontSize: 13 }}>–</span>
            <input
              type="date"
              className="ig-date-input"
              value={dateStop}
              min={dateStart}
              onChange={e => setDateStop(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Gambaran umum konten ── */}
      <div className="ig-overview-card">
        <div className="ig-overview-header">
          <h3 className="ig-overview-title">Gambaran umum konten</h3>
        </div>

        {/* Content type tabs */}
        <div className="ig-content-tabs">
          {CONTENT_TABS.map(t => (
            <button
              key={t.key}
              className={`ig-content-tab${contentTab === t.key ? " active" : ""}`}
              onClick={() => setContentTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Metrics row */}
        <div className="ig-metrics-row">
          {loadingOverview ? (
            <>
              <div className="ig-metric-skeleton" />
              <div className="ig-metric-skeleton" />
              <div className="ig-metric-skeleton" />
            </>
          ) : (
            <>
              <div className="ig-metric">
                <span className="ig-metric-label">Tayangan</span>
                {overview?.noInsights
                  ? <span className="ig-metric-value ig-metric-na">—</span>
                  : <span className="ig-metric-value">{num(overview?.views ?? 0)}</span>
                }
                {!overview?.noInsights && <GrowthBadge pct={overview?.viewsGrowth} />}
              </div>
              <div className="ig-metric-divider" />
              <div className="ig-metric">
                <span className="ig-metric-label">Jangkauan</span>
                {overview?.noInsights
                  ? <span className="ig-metric-value ig-metric-na">—</span>
                  : <span className="ig-metric-value">{num(overview?.reach ?? 0)}</span>
                }
                {!overview?.noInsights && <GrowthBadge pct={overview?.reachGrowth} />}
              </div>
              <div className="ig-metric-divider" />
              <div className="ig-metric">
                <span className="ig-metric-label">Interaksi konten</span>
                {overview?.noInsights
                  ? <span className="ig-metric-value ig-metric-na">—</span>
                  : <span className="ig-metric-value">{num(overview?.engagement ?? 0)}</span>
                }
                {!overview?.noInsights && <GrowthBadge pct={overview?.engagementGrowth} />}
              </div>
            </>
          )}
        </div>

        {/* Pesan keterbatasan data cerita */}
        {!loadingOverview && overview?.noInsights && (
          <p className="ig-no-insights-note">
            Data jangkauan dan interaksi cerita hanya tersedia dalam 24 jam setelah tayang. Cerita yang lebih lama tidak dapat diambil dari API Meta.
          </p>
        )}

        {/* Toggle view */}
        <div className="ig-chart-toggle">
          <button
            className={`ig-chart-toggle-btn${chartView === "organik" ? " active" : ""}`}
            onClick={() => setChartView("organik")}
          >
            Organik &amp; Iklan
          </button>
          <button
            className={`ig-chart-toggle-btn${chartView === "follow_type" ? " active" : ""}`}
            onClick={() => setChartView("follow_type")}
          >
            Follower &amp; Non-Follower
          </button>
        </div>

        {/* Chart + Breakdown panel */}
        <div className="ig-chart-layout">
          <div className="ig-chart-area">
            {chartView === "organik" ? (
              loadingChart ? (
                <div className="chart-skeleton" style={{ height: IG_CHART_HEIGHT }} />
              ) : (dailyChart ?? []).length === 0 ? (
                <div className="chart-empty" style={{ height: IG_CHART_HEIGHT }}>Belum ada data tayangan untuk periode ini</div>
              ) : (
                <ResponsiveContainer width="100%" height={IG_CHART_HEIGHT}>
                  <LineChart data={dailyChart ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} />
                    <YAxis tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} tickFormatter={num} width={36} />
                    <Tooltip
                      labelFormatter={fmtAxisDate}
                      formatter={(v: unknown, name: unknown) => [num(Number(v ?? 0)), String(name ?? "")]}
                      contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: "DM Sans" }} />
                    <Line type="monotone" dataKey="total"   name="Tayangan"     stroke="#1877F2" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="organic" name="Dari organik"  stroke="#00C6A7" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="paid"    name="Dari iklan"    stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="2 2" />
                  </LineChart>
                </ResponsiveContainer>
              )
            ) : (() => {
              const followData = (insightsTrend ?? []).map(d => ({
                date: d.date,
                followers: d.reach_followers ?? 0,
                nonFollowers: d.reach_non_followers ?? 0,
              }));
              const hasFollowData = followData.some(d => d.followers > 0 || d.nonFollowers > 0);
              return loadingInsights ? (
                <div className="chart-skeleton" style={{ height: IG_CHART_HEIGHT }} />
              ) : !hasFollowData ? (
                <div className="chart-empty" style={{ height: IG_CHART_HEIGHT }}>Data akan tersedia setelah sync berikutnya</div>
              ) : (
                <ResponsiveContainer width="100%" height={IG_CHART_HEIGHT}>
                  <AreaChart data={followData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ft-g-followers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00C6A7" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#00C6A7" stopOpacity={0.01} />
                      </linearGradient>
                      <linearGradient id="ft-g-nonfollowers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#BB2649" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#BB2649" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} />
                    <YAxis tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} tickFormatter={num} width={42} />
                    <Tooltip
                      labelFormatter={fmtAxisDate}
                      formatter={(v: unknown, name: unknown) => [num(Number(v ?? 0)), String(name ?? "")]}
                      contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Sans" }} />
                    <Area type="monotone" dataKey="followers"    name="Pengikut"     stroke="#00C6A7" fill="url(#ft-g-followers)"    strokeWidth={2} />
                    <Area type="monotone" dataKey="nonFollowers" name="Non-pengikut" stroke="#BB2649" fill="url(#ft-g-nonfollowers)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              );
            })()}
          </div>

          <div className="ig-breakdown-panel">
            {chartView === "organik" ? (
              <>
                <p className="ig-breakdown-title">Perincian tayangan</p>
                <p className="ig-breakdown-period">{fmtPeriod(dateStart, dateStop)}</p>
                {(() => {
                  const totalViews   = overview?.views ?? 0;
                  const rawPaid      = (dailyChart ?? []).reduce((s, d) => s + d.paidImpressions, 0);
                  const paidViews    = Math.min(rawPaid, totalViews);
                  const organicViews = Math.max(0, totalViews - paidViews);
                  return (
                    <div className="ig-breakdown-items">
                      <div className="ig-breakdown-item">
                        <span className="ig-breakdown-label">Total</span>
                        <span className="ig-breakdown-value">{num(totalViews)}</span>
                      </div>
                      <div className="ig-breakdown-item">
                        <span className="ig-breakdown-label">Dari organik</span>
                        <span className="ig-breakdown-value">{num(organicViews)}</span>
                      </div>
                      <div className="ig-breakdown-item">
                        <span className="ig-breakdown-label">Dari iklan</span>
                        <span className="ig-breakdown-value">{num(paidViews)}</span>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <p className="ig-breakdown-title">Tayangan per tipe</p>
                <p className="ig-breakdown-period">{fmtPeriod(dateStart, dateStop)}</p>
                {(() => {
                  const totalF   = (insightsTrend ?? []).reduce((s, d) => s + (d.reach_followers    ?? 0), 0);
                  const totalNF  = (insightsTrend ?? []).reduce((s, d) => s + (d.reach_non_followers ?? 0), 0);
                  return (
                    <div className="ig-breakdown-items">
                      <div className="ig-breakdown-item">
                        <span className="ig-breakdown-label">Pengikut</span>
                        <span className="ig-breakdown-value" style={{ color: "#00C6A7" }}>{num(totalF)}</span>
                      </div>
                      <div className="ig-breakdown-item">
                        <span className="ig-breakdown-label">Non-pengikut</span>
                        <span className="ig-breakdown-value" style={{ color: "#BB2649" }}>{num(totalNF)}</span>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Konten populer ── */}
      <div className="ig-popular-section">
        <div className="ig-popular-header">
          <h3 className="ig-popular-title">Konten populer sepanjang masa</h3>
          <div className="ig-popular-actions">
            <button className="ig-action-btn">Promosikan konten</button>
            <a href={igUrl} target="_blank" rel="noopener noreferrer" className="ig-action-btn">
              Lihat semua konten
            </a>
          </div>
        </div>

        <div className="ig-popular-scroll">
          {loadingMedia ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="ig-popular-card ig-popular-card--skeleton" />
            ))
          ) : (topMedia ?? []).length === 0 ? (
            <p style={{ color: "var(--gray-400)", fontSize: 14 }}>Belum ada konten.</p>
          ) : (
            (topMedia ?? []).map(m => <PopularCard key={m.id} media={m} onClick={() => setSelectedMedia(m)} />)
          )}
        </div>
      </div>

      {/* ── Demografi Audience (lifetime, dari ig_audience_breakdown) ── */}
      <div className="ig-audience-section">
        <p className="ig-audience-section-title">Demografi Audience</p>
        {loadingAudience ? (
          <div className="ig-audience-grid">
            {[0,1,2,3].map(i => <div key={i} className="chart-card"><div className="chart-skeleton" style={{ height: 200 }} /></div>)}
          </div>
        ) : !hasAudienceData ? (
          <div className="chart-empty" style={{ padding: "40px 0" }}>
            Data demografi belum tersedia — akan muncul setelah sync berikutnya
          </div>
        ) : (
          <div className="ig-audience-grid">

            {/* Usia */}
            {byAge.length > 0 && (
              <div className="chart-card">
                <div style={{ marginBottom: 6 }}>
                  <h3 className="chart-title" style={{ marginBottom: 2 }}>Usia</h3>
                  <div style={{ fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>
                    Total: <strong style={{ color: "var(--gray-900)" }}>{num(byAge.reduce((s, d) => s + d.follower_count, 0))}</strong>
                    {byAge[0] && <> · Terbanyak: <strong style={{ color: "#BB2649" }}>{byAge[0].breakdown_value}</strong></>}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byAge} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} tickFormatter={num} />
                    <YAxis type="category" dataKey="breakdown_value" width={46} tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} />
                    <Tooltip formatter={(v: unknown) => [num(Number(v ?? 0)), "Pengikut"]} contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }} />
                    <Bar dataKey="follower_count" name="Pengikut" fill="#BB2649" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Gender */}
            {byGender.length > 0 && (
              <div className="chart-card">
                <div style={{ marginBottom: 6 }}>
                  <h3 className="chart-title" style={{ marginBottom: 2 }}>Gender</h3>
                  <div style={{ display: "flex", gap: 10, fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>
                    {byGender.find(g => g.breakdown_value === "F") && <span style={{ color: "#BB2649" }}>P: <strong>{num(byGender.find(g => g.breakdown_value === "F")!.follower_count)}</strong></span>}
                    {byGender.find(g => g.breakdown_value === "M") && <><span>·</span><span style={{ color: "#2563EB" }}>L: <strong>{num(byGender.find(g => g.breakdown_value === "M")!.follower_count)}</strong></span></>}
                    {byGender.find(g => g.breakdown_value === "U") && <><span>·</span><span style={{ color: "#9B9BA3" }}>Lainnya: <strong>{num(byGender.find(g => g.breakdown_value === "U")!.follower_count)}</strong></span></>}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byGender} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="breakdown_value" tickFormatter={v => v === "M" ? "Laki-laki" : v === "F" ? "Perempuan" : "Lainnya"} tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} />
                    <YAxis tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} tickFormatter={num} width={42} />
                    <Tooltip formatter={(v: unknown) => [num(Number(v ?? 0)), "Pengikut"]} labelFormatter={v => v === "M" ? "Laki-laki" : v === "F" ? "Perempuan" : "Lainnya"} contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }} />
                    <Bar dataKey="follower_count" name="Pengikut" radius={[3, 3, 0, 0]}>
                      {byGender.map((entry) => (
                        <Cell key={entry.breakdown_value} fill={entry.breakdown_value === "F" ? "#BB2649" : entry.breakdown_value === "M" ? "#2563EB" : "#9B9BA3"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Negara */}
            {byCountry.length > 0 && (
              <div className="chart-card">
                <div style={{ marginBottom: 6 }}>
                  <h3 className="chart-title" style={{ marginBottom: 2 }}>Negara (Top 5)</h3>
                  <div style={{ fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>
                    Terbanyak: <strong style={{ color: "#2563EB" }}>{countryName(byCountry[0]?.breakdown_value ?? "")} ({num(byCountry[0]?.follower_count ?? 0)})</strong>
                  </div>
                </div>
                {(() => {
                  const top5 = byCountry.slice(0, 5).map(d => ({ ...d, name: countryName(d.breakdown_value) }));
                  return (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={top5} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} angle={-25} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} tickFormatter={num} width={42} />
                        <Tooltip
                          formatter={(v: unknown) => [num(Number(v ?? 0)), "Pengikut"]}
                          contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }} />
                        <Bar dataKey="follower_count" name="Pengikut" fill="#2563EB" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            )}

            {/* Kota */}
            {byCity.length > 0 && (
              <div className="chart-card">
                <div style={{ marginBottom: 6 }}>
                  <h3 className="chart-title" style={{ marginBottom: 2 }}>Kota (Top 5)</h3>
                  <div style={{ fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>
                    Terbanyak: <strong style={{ color: "#16A34A" }}>{byCity[0]?.breakdown_value} ({num(byCity[0]?.follower_count ?? 0)})</strong>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byCity.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} tickFormatter={num} />
                    <YAxis type="category" dataKey="breakdown_value" width={90} interval={0} tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} />
                    <Tooltip formatter={(v: unknown) => [num(Number(v ?? 0)), "Pengikut"]} contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }} />
                    <Bar dataKey="follower_count" name="Pengikut" fill="#16A34A" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Pertumbuhan Pengikut */}
            {(() => {
              const trend = insightsTrend ?? [];
              const lastFollowers  = [...trend].reverse().find(d => d.followers_count > 0)?.followers_count ?? 0;
              const firstFollowers = trend.find(d => d.followers_count > 0)?.followers_count ?? 0;
              const delta = lastFollowers - firstFollowers;
              return (
                <div className="chart-card">
                  <div style={{ marginBottom: 8 }}>
                    <h3 className="chart-title" style={{ marginBottom: 2 }}>Pertumbuhan Pengikut</h3>
                    {trend.length > 0 && (
                      <div style={{ display: "flex", gap: 10, fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>
                        <span>Saat ini: <strong style={{ color: "var(--gray-900)" }}>{num(lastFollowers)}</strong></span>
                        {delta !== 0 && (
                          <><span>·</span>
                          <span style={{ color: delta > 0 ? "#16A34A" : "#DC2626" }}>
                            {delta > 0 ? "+" : ""}{num(delta)} periode ini
                          </span></>
                        )}
                      </div>
                    )}
                  </div>
                  {loadingInsights ? (
                    <div className="chart-skeleton" style={{ height: 220 }} />
                  ) : trend.length === 0 ? (
                    <div className="chart-empty" style={{ height: 220 }}>Belum ada data</div>
                  ) : trend.every(d => d.followers_count === 0) ? (
                    <div className="chart-empty" style={{ height: 220 }}>
                      Data pengikut hanya tersedia untuk 30 hari terakhir.<br />
                      Pilih rentang tanggal yang lebih baru.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} />
                        <YAxis tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} tickFormatter={num} width={42} />
                        <Tooltip
                          labelFormatter={fmtAxisDate}
                          formatter={(v: unknown) => [num(Number(v ?? 0)), "Pengikut"]}
                          contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
                        />
                        <Line type="monotone" dataKey="followers_count" name="Pengikut" stroke="#BB2649" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              );
            })()}

          </div>
        )}
      </div>


    </div>
  );
}
