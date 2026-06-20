"use client";
import { useState, useCallback } from "react";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  useCompetitorAdsList,
  useCompetitorAdsSummary,
  useJobStatus,
  useCompetitorList,
} from "@/hooks/useCompetitorAds";
import { useSWRConfig } from "swr";
import type { CompetitorAd } from "@/types/database";

const COUNTRY_OPTIONS = [
  { value: "ID", label: "Indonesia" },
  { value: "MY", label: "Malaysia" },
  { value: "SG", label: "Singapura" },
  { value: "AU", label: "Australia" },
  { value: "US", label: "Amerika Serikat" },
];

const OBJECTIVE_OPTIONS = [
  "AWARENESS", "TRAFFIC", "ENGAGEMENT", "LEADS", "SALES", "APP_PROMOTION",
];

const OBJECTIVE_COLORS: Record<string, string> = {
  AWARENESS: "#2563EB",
  TRAFFIC: "#16A34A",
  ENGAGEMENT: "#D97706",
  LEADS: "#BB2649",
  SALES: "#7B162F",
  APP_PROMOTION: "#52525A",
};

const CONFIDENCE_STYLE: Record<string, { bg: string; color: string }> = {
  HIGH:   { bg: "#DCFCE7", color: "#16A34A" },
  MEDIUM: { bg: "#FEF3C7", color: "#D97706" },
  LOW:    { bg: "#FEE2E2", color: "#DC2626" },
};

function scoreColor(score: number) {
  if (score >= 8) return "#16A34A";
  if (score >= 5) return "#D97706";
  return "#DC2626";
}

// ── AdCard ────────────────────────────────────────────────────────────────────

function AdCard({ ad }: { ad: CompetitorAd }) {
  const [expanded, setExpanded] = useState(false);
  const objColor = OBJECTIVE_COLORS[ad.inferred_objective ?? ""] ?? "#52525A";
  const confStyle = CONFIDENCE_STYLE[ad.objective_confidence ?? ""] ?? { bg: "#F2F2F7", color: "#71717A" };
  const score = ad.ad_strength_score ?? 0;

  return (
    <div className="al-card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Header */}
      <div className="al-card-header" style={{ marginBottom: 10 }}>
        <div className="al-card-page" style={{ flex: 1, minWidth: 0 }}>
          <span className="al-card-page-name" style={{ fontSize: 13, fontWeight: 600 }}>
            {ad.page_name || ad.competitor_name}
          </span>
          <span style={{ fontSize: 11, color: "var(--gray-500)" }}>{ad.competitor_name}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          {ad.inferred_objective && (
            <span className="ca-objective-badge" style={{ background: objColor + "22", color: objColor }}>
              {ad.inferred_objective}
            </span>
          )}
          {ad.objective_confidence && (
            <span className="ca-confidence-pill" style={{ background: confStyle.bg, color: confStyle.color }}>
              {ad.objective_confidence}
            </span>
          )}
        </div>
      </div>

      {/* Ad copy */}
      <div className="al-card-body" style={{ flex: 1 }}>
        <p className="al-card-text" style={{ WebkitLineClamp: 4, overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical" }}>
          {ad.ad_copy || <span className="al-card-text--empty">Tidak ada teks iklan</span>}
        </p>

        {/* CTA + platforms */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
          {ad.cta && (
            <span style={{ fontSize: 11, background: "var(--gray-100)", color: "var(--gray-700)", borderRadius: 4, padding: "2px 7px", fontWeight: 600 }}>
              {ad.cta}
            </span>
          )}
          {(ad.platforms ?? []).map((p) => (
            <span key={p} style={{ fontSize: 10, background: "var(--info-100)", color: "var(--info-600)", borderRadius: 4, padding: "2px 6px" }}>
              {p}
            </span>
          ))}
          {ad.media_type && (
            <span style={{ fontSize: 10, background: "var(--gray-100)", color: "var(--gray-500)", borderRadius: 4, padding: "2px 6px" }}>
              {ad.media_type}
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--gray-200)", margin: "10px 0" }} />

      {/* AI Analysis */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Score bar */}
        <div className="ca-score-bar-wrap">
          <span style={{ fontSize: 11, color: "var(--gray-500)", whiteSpace: "nowrap" }}>Kekuatan</span>
          <div className="ca-score-bar" style={{ flex: 1 }}>
            <div className="ca-score-fill" style={{ width: `${score * 10}%`, background: scoreColor(score) }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(score), minWidth: 28, textAlign: "right" }}>
            {score}/10
          </span>
        </div>

        {/* Strategy + audience */}
        {ad.creative_strategy && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Strategi</span>
            <span style={{ fontSize: 11, background: "var(--warning-100)", color: "var(--warning-600)", borderRadius: 4, padding: "2px 7px", fontWeight: 600 }}>
              {ad.creative_strategy}
            </span>
          </div>
        )}
        {ad.target_audience_guess && (
          <div style={{ fontSize: 11, color: "var(--gray-600)" }}>
            <span style={{ color: "var(--gray-400)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Target </span>
            {ad.target_audience_guess}
          </div>
        )}

        {/* Competitive insight */}
        {ad.competitive_insight && (
          <div className="ca-insight-block">
            <div className="ca-insight-label">Insight Kompetitif</div>
            <div style={{ fontSize: 12, color: "var(--gray-700)", marginTop: 3, lineHeight: 1.5 }}>{ad.competitive_insight}</div>
          </div>
        )}

        {/* Counter strategy (expandable) */}
        {ad.suggested_counter_strategy && (
          <div>
            <button className="ca-expand-btn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Sembunyikan strategi counter ▲" : "Lihat strategi counter ▼"}
            </button>
            {expanded && (
              <div className="ca-insight-block" style={{ marginTop: 6, background: "var(--success-50)", borderColor: "var(--success-100)" }}>
                <div className="ca-insight-label" style={{ color: "var(--success-600)" }}>Strategi Counter</div>
                <div style={{ fontSize: 12, color: "var(--gray-700)", marginTop: 3, lineHeight: 1.5 }}>{ad.suggested_counter_strategy}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--gray-200)", alignItems: "center" }}>
        {ad.started_running && (
          <span style={{ fontSize: 11, color: "var(--gray-400)" }}>Mulai: {ad.started_running}</span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 10, background: "var(--gray-100)", color: "var(--gray-500)", borderRadius: 4, padding: "2px 6px" }}>
          {ad.country ?? "ID"}
        </span>
        {ad.snapshot_url && (
          <a href={ad.snapshot_url} target="_blank" rel="noopener noreferrer" className="al-card-link" style={{ fontSize: 11 }}>
            Lihat ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ── AdTableRow ────────────────────────────────────────────────────────────────

function AdTableRow({ ad, onDetail }: { ad: CompetitorAd; onDetail: (ad: CompetitorAd) => void }) {
  const objColor = OBJECTIVE_COLORS[ad.inferred_objective ?? ""] ?? "#52525A";
  const confStyle = CONFIDENCE_STYLE[ad.objective_confidence ?? ""] ?? { bg: "#F2F2F7", color: "#71717A" };
  const score = ad.ad_strength_score ?? 0;

  return (
    <tr onClick={() => onDetail(ad)} style={{ cursor: "pointer" }}>
      <td><strong style={{ fontSize: 12 }}>{ad.competitor_name}</strong></td>
      <td style={{ maxWidth: 220 }}>
        <span style={{ fontSize: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {ad.ad_copy || "—"}
        </span>
      </td>
      <td><span style={{ fontSize: 11 }}>{ad.cta || "—"}</span></td>
      <td>
        {ad.inferred_objective && (
          <span className="ca-objective-badge" style={{ background: objColor + "22", color: objColor }}>
            {ad.inferred_objective}
          </span>
        )}
      </td>
      <td>
        {ad.objective_confidence && (
          <span className="ca-confidence-pill" style={{ background: confStyle.bg, color: confStyle.color }}>
            {ad.objective_confidence}
          </span>
        )}
      </td>
      <td>
        <div className="ca-score-bar-wrap" style={{ gap: 6 }}>
          <div className="ca-score-bar" style={{ width: 60 }}>
            <div className="ca-score-fill" style={{ width: `${score * 10}%`, background: scoreColor(score) }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(score) }}>{score}</span>
        </div>
      </td>
      <td>
        {ad.creative_strategy && (
          <span style={{ fontSize: 11, background: "var(--warning-100)", color: "var(--warning-600)", borderRadius: 4, padding: "2px 6px" }}>
            {ad.creative_strategy}
          </span>
        )}
      </td>
      <td><span style={{ fontSize: 11, color: "var(--gray-500)" }}>{ad.scraped_at ? ad.scraped_at.slice(0, 10) : "—"}</span></td>
    </tr>
  );
}

// ── AdDetailModal ─────────────────────────────────────────────────────────────

function AdDetailModal({ ad, onClose }: { ad: CompetitorAd; onClose: () => void }) {
  const objColor = OBJECTIVE_COLORS[ad.inferred_objective ?? ""] ?? "#52525A";
  const confStyle = CONFIDENCE_STYLE[ad.objective_confidence ?? ""] ?? { bg: "#F2F2F7", color: "#71717A" };
  const score = ad.ad_strength_score ?? 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        style={{ width: "70vw", maxWidth: "70vw", maxHeight: "85vh", display: "flex", flexDirection: "column", padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header (sticky) ── */}
        <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid var(--gray-200)", display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17, wordBreak: "break-word" }}>{ad.page_name || ad.competitor_name}</div>
            <div style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 3 }}>Kompetitor: {ad.competitor_name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {ad.inferred_objective && (
              <span className="ca-objective-badge" style={{ background: objColor + "22", color: objColor }}>
                {ad.inferred_objective}
              </span>
            )}
            {ad.objective_confidence && (
              <span className="ca-confidence-pill" style={{ background: confStyle.bg, color: confStyle.color }}>
                {ad.objective_confidence}
              </span>
            )}
            {ad.country && (
              <span style={{ fontSize: 11, background: "var(--gray-100)", color: "var(--gray-500)", borderRadius: 4, padding: "3px 8px" }}>
                {ad.country}
              </span>
            )}
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--gray-400)", padding: "0 2px", lineHeight: 1, marginLeft: 4 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Body (scrollable) ── */}
        <div style={{ overflowY: "auto", flex: 1, padding: "24px 28px" }}>
          {/* Dua kolom utama */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, alignItems: "start" }}>

            {/* KOLOM KIRI — Data iklan */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div className="ca-insight-label" style={{ marginBottom: 6 }}>Teks Iklan</div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--gray-800)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {ad.ad_copy || <span style={{ color: "var(--gray-400)", fontStyle: "italic" }}>Tidak ada teks iklan</span>}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <div className="ca-insight-label">CTA</div>
                  <div style={{ fontSize: 13, marginTop: 4, fontWeight: 600 }}>{ad.cta || "—"}</div>
                </div>
                <div>
                  <div className="ca-insight-label">Tipe Media</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{ad.media_type || "—"}</div>
                </div>
                <div>
                  <div className="ca-insight-label">Platform Tayang</div>
                  <div style={{ fontSize: 13, marginTop: 4, wordBreak: "break-word" }}>{(ad.platforms ?? []).join(", ") || "—"}</div>
                </div>
                <div>
                  <div className="ca-insight-label">Mulai Tayang</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{ad.started_running || "—"}</div>
                </div>
              </div>

              <div>
                <div className="ca-insight-label" style={{ marginBottom: 8 }}>Kekuatan Iklan</div>
                <div className="ca-score-bar-wrap">
                  <div className="ca-score-bar" style={{ flex: 1, height: 10 }}>
                    <div className="ca-score-fill" style={{ width: `${score * 10}%`, background: scoreColor(score) }} />
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: scoreColor(score), minWidth: 40 }}>{score}/10</span>
                </div>
              </div>

              {ad.snapshot_url && (
                <a href={ad.snapshot_url} target="_blank" rel="noopener noreferrer" className="al-card-link" style={{ fontSize: 12 }}>
                  Lihat iklan asli di Meta Ad Library ↗
                </a>
              )}
            </div>

            {/* KOLOM KANAN — Analisis AI */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--magenta-600)", marginBottom: 2 }}>
                Analisis AI
              </div>

              {ad.creative_strategy && (
                <div>
                  <div className="ca-insight-label">Strategi Kreatif</div>
                  <div style={{ marginTop: 5 }}>
                    <span style={{ fontSize: 12, background: "var(--warning-100)", color: "var(--warning-600)", borderRadius: 5, padding: "3px 10px", fontWeight: 700 }}>
                      {ad.creative_strategy}
                    </span>
                  </div>
                </div>
              )}

              {ad.target_audience_guess && (
                <div>
                  <div className="ca-insight-label">Target Audiens (Perkiraan AI)</div>
                  <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.6, color: "var(--gray-700)", wordBreak: "break-word" }}>
                    {ad.target_audience_guess}
                  </div>
                </div>
              )}

              {ad.objective_reasoning && (
                <div>
                  <div className="ca-insight-label">Alasan Objective</div>
                  <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6, color: "var(--gray-600)", wordBreak: "break-word" }}>
                    {ad.objective_reasoning}
                  </div>
                </div>
              )}

              {ad.key_messages && ad.key_messages.length > 0 && (
                <div>
                  <div className="ca-insight-label">Pesan Kunci</div>
                  <ul style={{ margin: "6px 0 0 18px", padding: 0, fontSize: 12, color: "var(--gray-700)", lineHeight: 1.7 }}>
                    {ad.key_messages.map((m, i) => (
                      <li key={i} style={{ wordBreak: "break-word" }}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {ad.competitive_insight && (
                <div className="ca-insight-block">
                  <div className="ca-insight-label">Insight Kompetitif</div>
                  <div style={{ fontSize: 12, marginTop: 5, lineHeight: 1.6, color: "var(--gray-700)", wordBreak: "break-word" }}>
                    {ad.competitive_insight}
                  </div>
                </div>
              )}

              {ad.suggested_counter_strategy && (
                <div className="ca-insight-block" style={{ background: "var(--success-50)", borderColor: "var(--success-100)" }}>
                  <div className="ca-insight-label" style={{ color: "var(--success-600)" }}>Strategi Counter yang Disarankan</div>
                  <div style={{ fontSize: 12, marginTop: 5, lineHeight: 1.6, color: "var(--gray-700)", wordBreak: "break-word" }}>
                    {ad.suggested_counter_strategy}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer (sticky) ── */}
        <div style={{ padding: "14px 28px", borderTop: "1px solid var(--gray-200)", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button
            onClick={onClose}
            className="al-search-btn"
            style={{ padding: "8px 24px", fontSize: 13 }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CompetitorAdsTab() {
  const { mutate } = useSWRConfig();

  // Form state
  const [competitorInput, setCompetitorInput] = useState("");
  const [countryInput, setCountryInput] = useState("ID");
  const [maxAdsInput, setMaxAdsInput] = useState(20);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Job tracking
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [lastScrapedCompetitor, setLastScrapedCompetitor] = useState<string>("");

  // Filters
  const [filterCompetitor, setFilterCompetitor] = useState("");
  const [filterObjective, setFilterObjective] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Modal
  const [modalAd, setModalAd] = useState<CompetitorAd | null>(null);

  const { data: ads, isLoading: adsLoading } = useCompetitorAdsList(
    filterCompetitor || undefined,
    filterObjective || undefined
  );
  const { data: summary } = useCompetitorAdsSummary(filterCompetitor || undefined);
  const { data: jobStatus } = useJobStatus(activeJobId);
  const { data: competitorList } = useCompetitorList();

  // Submit scraping job
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competitorInput.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/competitor-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitor_name: competitorInput.trim(),
          country: countryInput,
          max_ads: maxAdsInput,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSubmitError(data.error ?? "Gagal memulai scraping.");
      } else {
        setActiveJobId(data.job_id);
        setLastScrapedCompetitor(competitorInput.trim());
      }
    } catch {
      setSubmitError("Tidak bisa terhubung ke server. Pastikan Python agent sudah berjalan.");
    } finally {
      setIsSubmitting(false);
    }
  }, [competitorInput, countryInput, maxAdsInput]);

  // When job done, refresh data
  const handleViewResults = useCallback(() => {
    mutate(["competitor_ads_list", lastScrapedCompetitor, undefined, 50]);
    mutate(["competitor_ads_summary_raw", lastScrapedCompetitor]);
    mutate("competitor_names_list");
    setFilterCompetitor(lastScrapedCompetitor);
    setActiveJobId(null);
  }, [mutate, lastScrapedCompetitor]);

  // Pie chart data
  const pieData = Object.entries(summary.objectives_distribution).map(([name, value]) => ({ name, value }));

  // Bar chart data
  const barData = Object.entries(summary.ads_per_competitor).map(([name, count]) => ({ name, count }));

  return (
    <div className="page-section">
      {/* ── Quick Keywords ── */}
      <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--gray-400)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Cepat:</span>
        {[
          "kemasan flexibel",
          "standing pouch",
          "flexible packaging",
          "kemasan plastik",
          "kemasan rotogravure",
          "kemasan makanan",
          "custom packaging",
          "cetak kemasan",
        ].map((kw) => (
          <button
            key={kw}
            type="button"
            className="preset-btn"
            style={{ fontSize: 12 }}
            onClick={() => setCompetitorInput(kw)}
            disabled={isSubmitting || activeJobId !== null}
          >
            {kw}
          </button>
        ))}
      </div>

      {/* ── Search Form ── */}
      <form className="al-search-bar" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <div className="al-search-group" style={{ flex: "2 1 200px" }}>
          <label>Kata Kunci / Nama Halaman Iklan</label>
          <input
            type="text"
            placeholder="Contoh: kemasan flexibel, standing pouch, packaging..."
            value={competitorInput}
            onChange={(e) => setCompetitorInput(e.target.value)}
            required
          />
        </div>
        <div className="al-search-group">
          <label>Negara</label>
          <select value={countryInput} onChange={(e) => setCountryInput(e.target.value)}>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="al-search-group">
          <label>Maks. Iklan</label>
          <input
            type="number"
            min={5}
            max={50}
            value={maxAdsInput}
            onChange={(e) => setMaxAdsInput(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </div>
        <div className="al-search-group" style={{ justifyContent: "flex-end" }}>
          <label style={{ opacity: 0 }}>–</label>
          <button
            type="submit"
            className="al-search-btn"
            disabled={isSubmitting || activeJobId !== null}
          >
            {isSubmitting ? "Menghubungi agent..." : "Mulai Scraping"}
          </button>
        </div>
      </form>

      {/* Submit error */}
      {submitError && (
        <div className="ca-job-banner ca-job-banner--error" style={{ marginBottom: 16 }}>
          <span style={{ fontWeight: 600 }}>Error:</span> {submitError}
          <button className="ca-job-action-btn" onClick={() => setSubmitError(null)} style={{ marginLeft: "auto" }}>Tutup</button>
        </div>
      )}

      {/* ── Job Status Banner ── */}
      {activeJobId && jobStatus && (
        <div
          className={`ca-job-banner ca-job-banner--${jobStatus.status}`}
          style={{ marginBottom: 20 }}
        >
          {jobStatus.status === "running" && (
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div className="ca-job-spinner" />
                <span style={{ fontWeight: 700 }}>
                  Sedang scraping iklan &ldquo;{lastScrapedCompetitor}&rdquo;
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--magenta-700)", marginBottom: 8 }}>
                {jobStatus.progress?.message ?? "Mempersiapkan agent..."}
              </div>
              {(jobStatus.progress?.ads_found ?? 0) > 0 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4, color: "var(--magenta-700)" }}>
                    <span>
                      {jobStatus.progress?.step === "saving"
                        ? "Menyimpan ke database"
                        : "Analisis AI"}
                    </span>
                    <span style={{ fontWeight: 700 }}>
                      {jobStatus.progress?.ads_analyzed ?? 0} / {jobStatus.progress?.ads_found} iklan
                    </span>
                  </div>
                  <div className="ca-score-bar" style={{ height: 8 }}>
                    <div
                      className="ca-score-fill"
                      style={{
                        width: `${Math.round(((jobStatus.progress?.ads_analyzed ?? 0) / (jobStatus.progress?.ads_found ?? 1)) * 100)}%`,
                        background: "var(--magenta-600)",
                      }}
                    />
                  </div>
                  {jobStatus.progress?.current_page && (
                    <div style={{ fontSize: 11, marginTop: 5, color: "var(--magenta-700)", opacity: 0.8 }}>
                      Halaman: {jobStatus.progress.current_page}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {jobStatus.status === "done" && (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                  ✓ Scraping selesai!
                </div>
                <div style={{ fontSize: 12 }}>
                  <strong>{jobStatus.summary?.total_analyzed ?? 0}</strong> iklan &ldquo;{lastScrapedCompetitor}&rdquo; berhasil dianalisis oleh AI dan disimpan ke database.
                </div>
              </div>
              <button className="ca-job-action-btn" onClick={handleViewResults}>
                Lihat Hasil
              </button>
            </>
          )}
          {jobStatus.status === "error" && (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Scraping gagal</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {jobStatus.error
                    ? jobStatus.error
                    : "Error tidak diketahui. Periksa terminal Python untuk detail."}
                </div>
                {(!jobStatus.error || jobStatus.error.includes("does not exist") || jobStatus.error.includes("42P01")) && (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600 }}>
                    → Kemungkinan tabel <code>competitor_ads</code> belum dibuat. Jalankan SQL schema di Supabase SQL Editor terlebih dahulu.
                  </div>
                )}
              </div>
              <button className="ca-job-action-btn" onClick={() => setActiveJobId(null)}>
                Tutup
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Summary Stats ── */}
      {summary.total_ads > 0 && (
        <div style={{ marginBottom: 24 }}>
          {/* KPI mini cards */}
          <div className="ca-summary-row">
            <div className="ca-summary-kpi">
              <div className="ca-insight-label">Total Iklan Dianalisis</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--magenta-600)", marginTop: 4 }}>{summary.total_ads}</div>
            </div>
            <div className="ca-summary-kpi">
              <div className="ca-insight-label">Rata-rata Kekuatan Iklan</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: scoreColor(summary.average_strength_score), marginTop: 4 }}>
                {summary.average_strength_score.toFixed(1)}<span style={{ fontSize: 14, fontWeight: 400, color: "var(--gray-400)" }}>/10</span>
              </div>
            </div>
            <div className="ca-summary-kpi">
              <div className="ca-insight-label">Kompetitor Terlacak</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--info-600)", marginTop: 4 }}>
                {Object.keys(summary.ads_per_competitor).length}
              </div>
            </div>
          </div>

          {/* Charts */}
          {(pieData.length > 0 || barData.length > 0) && (
            <div className="ca-summary-charts">
              {pieData.length > 0 && (
                <div className="chart-card">
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Distribusi Objective Iklan</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={OBJECTIVE_COLORS[entry.name] ?? "#52525A"} />
                        ))}
                      </Pie>
                      <ReTooltip formatter={(v) => [`${v} iklan`, "Jumlah"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              {barData.length > 0 && (
                <div className="chart-card">
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Iklan per Kompetitor</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={barData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <ReTooltip formatter={(v) => [`${v} iklan`, "Jumlah"]} />
                      <Bar dataKey="count" fill="var(--magenta-600)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="filter-bar" style={{ marginBottom: 16, alignItems: "flex-end" }}>
        <div className="filter-group">
          <label className="filter-label">Filter Kompetitor</label>
          <select
            className="date-input"
            value={filterCompetitor}
            onChange={(e) => setFilterCompetitor(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="">Semua kompetitor</option>
            {(competitorList ?? []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Filter Objective</label>
          <select
            className="date-input"
            value={filterObjective}
            onChange={(e) => setFilterObjective(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="">Semua objective</option>
            {OBJECTIVE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="filter-group" style={{ marginLeft: "auto" }}>
          <label className="filter-label">Tampilan</label>
          <div className="ca-view-toggle">
            <button className={`ca-view-btn${viewMode === "cards" ? " active" : ""}`} onClick={() => setViewMode("cards")}>Kartu</button>
            <button className={`ca-view-btn${viewMode === "table" ? " active" : ""}`} onClick={() => setViewMode("table")}>Tabel</button>
          </div>
        </div>
        {(filterCompetitor || filterObjective) && (
          <div className="filter-group" style={{ justifyContent: "flex-end" }}>
            <label className="filter-label" style={{ opacity: 0 }}>–</label>
            <button className="preset-btn" onClick={() => { setFilterCompetitor(""); setFilterObjective(""); }}>
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {adsLoading ? (
        <div className="al-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="al-card al-card--skeleton" style={{ height: 280 }} />
          ))}
        </div>
      ) : !ads || ads.length === 0 ? (
        summary.total_ads === 0 ? (
          <div className="al-intro">
            <div className="al-intro-icon">🔍</div>
            <p>Belum ada data iklan kompetitor.</p>
            <p>Klik salah satu keyword cepat (kemasan flexibel, standing pouch, dll.) atau isi nama halaman iklan, lalu klik <strong>Mulai Scraping</strong>.</p>
            <p>Pastikan Python agent sudah berjalan: <code style={{ fontSize: 11, background: "var(--gray-100)", padding: "2px 6px", borderRadius: 4 }}>uvicorn api_server:app --port 8000</code></p>
          </div>
        ) : (
          <div className="al-empty">Tidak ada iklan yang sesuai filter.</div>
        )
      ) : viewMode === "cards" ? (
        <div className="al-grid">
          {ads.map((ad) => (
            <AdCard key={ad.id} ad={ad} />
          ))}
        </div>
      ) : (
        <div className="db-table-wrap">
          <table className="db-table">
            <thead>
              <tr>
                <th>Kompetitor</th>
                <th>Teks Iklan</th>
                <th>CTA</th>
                <th>Objective</th>
                <th>Confidence</th>
                <th>Score</th>
                <th>Strategi</th>
                <th>Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {ads.map((ad) => (
                <AdTableRow key={ad.id} ad={ad} onDetail={setModalAd} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {modalAd && <AdDetailModal ad={modalAd} onClose={() => setModalAd(null)} />}
    </div>
  );
}
