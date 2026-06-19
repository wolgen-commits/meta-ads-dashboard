"use client";
import { useState, useEffect } from "react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useIgAccounts, useIgContentOverview, useIgDailyChart, useIgTopMedia, useIgAccountInsightsTrend } from "@/hooks/useMetaData";
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
          <div className="ig-perincian-pill">Perincian: Semua ▾</div>
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

        {/* Chart + Breakdown panel */}
        <div className="ig-chart-layout">
          <div className="ig-chart-area">
            {loadingChart ? (
              <div className="chart-skeleton" style={{ height: IG_CHART_HEIGHT }} />
            ) : (dailyChart ?? []).length === 0 ? (
              <div className="chart-empty" style={{ height: IG_CHART_HEIGHT }}>Belum ada data jangkauan untuk periode ini</div>
            ) : (
              <ResponsiveContainer width="100%" height={IG_CHART_HEIGHT}>
                <LineChart
                  data={dailyChart ?? []}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtAxisDate}
                    tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }}
                    tickFormatter={num}
                    width={36}
                  />
                  <Tooltip
                    labelFormatter={fmtAxisDate}
                    formatter={(v: unknown, name: unknown) => [num(Number(v ?? 0)), String(name ?? "")]}
                    contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "DM Sans" }} />
                  <Line type="monotone" dataKey="total"   name="Jangkauan"     stroke="#1877F2" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="organic" name="Dari organik"  stroke="#00C6A7" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="paid"    name="Dari iklan"    stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="2 2" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="ig-breakdown-panel">
            <p className="ig-breakdown-title">Perincian tayangan</p>
            <p className="ig-breakdown-period">{fmtPeriod(dateStart, dateStop)}</p>
            {(() => {
              // Total tayangan dari API route (cocok dengan Meta Business Suite)
              const totalViews = overview?.views ?? 0;

              // Paid impressions dari ad_breakdown_platform; cap agar tidak melebihi total
              // (ad platform impressions bisa melebihi account views karena berbeda scope)
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

      {/* ── Analytics Charts ── */}
      <div className="ig-analytics-grid">

        {/* Chart 1: Pertumbuhan Pengikut */}
        <div className="chart-card">
          <h3 className="chart-title" style={{ marginBottom: 12 }}>Pertumbuhan Pengikut</h3>
          {loadingInsights ? (
            <div className="chart-skeleton" style={{ height: 220 }} />
          ) : (insightsTrend ?? []).length === 0 ? (
            <div className="chart-empty" style={{ height: 220 }}>Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={insightsTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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

        {/* Chart 2: Jangkauan Organik vs Berbayar (proxy follower vs non-follower) */}
        <div className="chart-card">
          <div style={{ marginBottom: 12 }}>
            <h3 className="chart-title" style={{ marginBottom: 2 }}>Jangkauan: Pengikut vs Non-Pengikut</h3>
            <div style={{ fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>Organik ≈ pengikut · Berbayar = dari iklan</div>
          </div>
          {loadingChart ? (
            <div className="chart-skeleton" style={{ height: 220 }} />
          ) : (dailyChart ?? []).length === 0 ? (
            <div className="chart-empty" style={{ height: 220 }}>Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ig-g-organic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C6A7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#00C6A7" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="ig-g-paid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.01} />
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
                <Area type="monotone" dataKey="organic" name="Organik (pengikut)" stroke="#00C6A7" fill="url(#ig-g-organic)" strokeWidth={2} />
                <Area type="monotone" dataKey="paid"    name="Berbayar (iklan)"  stroke="#F59E0B" fill="url(#ig-g-paid)"    strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 3: Interaksi Harian */}
        <div className="chart-card">
          <h3 className="chart-title" style={{ marginBottom: 12 }}>Interaksi Harian</h3>
          {loadingInsights ? (
            <div className="chart-skeleton" style={{ height: 220 }} />
          ) : (insightsTrend ?? []).length === 0 ? (
            <div className="chart-empty" style={{ height: 220 }}>Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={insightsTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  {[
                    { id: "ig-g-likes",    color: "#BB2649" },
                    { id: "ig-g-comments", color: "#2563EB" },
                    { id: "ig-g-shares",   color: "#16A34A" },
                    { id: "ig-g-saves",    color: "#D97706" },
                  ].map(({ id, color }) => (
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} />
                <YAxis tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} tickFormatter={num} width={36} />
                <Tooltip
                  labelFormatter={fmtAxisDate}
                  formatter={(v: unknown, name: unknown) => [num(Number(v ?? 0)), String(name ?? "")]}
                  contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
                />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Sans" }} />
                <Area type="monotone" dataKey="likes_count"    name="Suka"     stroke="#BB2649" fill="url(#ig-g-likes)"    strokeWidth={2} />
                <Area type="monotone" dataKey="comments_count" name="Komentar" stroke="#2563EB" fill="url(#ig-g-comments)" strokeWidth={2} />
                <Area type="monotone" dataKey="shares_count"   name="Bagikan"  stroke="#16A34A" fill="url(#ig-g-shares)"   strokeWidth={2} />
                <Area type="monotone" dataKey="saves_count"    name="Disimpan" stroke="#D97706" fill="url(#ig-g-saves)"    strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>

    </div>
  );
}
