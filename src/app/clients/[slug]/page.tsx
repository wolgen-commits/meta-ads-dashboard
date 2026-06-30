"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

import { KpiCard }         from "@/components/KpiCard";
import { DateRangePicker } from "@/components/DateRangePicker";
import { getClient, CLIENTS } from "@/lib/clients";
import {
  useClientCampaigns,
  useClientKpiTotals,
  useClientSpendChart,
  useClientCampaignTable,
  useClientSyncLog,
} from "@/hooks/useClientData";

const isoDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const num = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}rb` : String(n);

const fmt = (d: unknown) =>
  new Date(String(d)).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_AWARENESS:     "Kesadaran",
  OUTCOME_TRAFFIC:       "Lalu Lintas",
  OUTCOME_ENGAGEMENT:    "Interaksi",
  OUTCOME_LEADS:         "Prospek",
  OUTCOME_SALES:         "Penjualan",
  OUTCOME_APP_PROMOTION: "Promosi Aplikasi",
  MESSAGES:              "Pesan",
};

export default function ClientDashboardPage() {
  const params      = useParams();
  const slug        = typeof params.slug === "string" ? params.slug : "";
  const client      = getClient(slug);

  if (!client) notFound();

  const [dateStart, setDateStart] = useState(isoDate(-30));
  const [dateStop,  setDateStop]  = useState(isoDate(0));
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);

  const { data: campaigns, isLoading: campaignsLoading } = useClientCampaigns(slug, dateStart, dateStop);
  const { totals, isLoading: kpiLoading }                = useClientKpiTotals(slug, dateStart, dateStop, selectedCampaigns);
  const { chartData, isLoading: chartLoading }           = useClientSpendChart(slug, dateStart, dateStop, selectedCampaigns);
  const { tableData, isLoading: tableLoading }           = useClientCampaignTable(slug, dateStart, dateStop, selectedCampaigns);
  const { data: syncLog }                                = useClientSyncLog(slug);

  const campaignMap = useMemo(() => {
    const m: Record<string, string> = {};
    (campaigns ?? []).forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [campaigns]);

  type SyncLogRow = { id: number; started_at: string; status: string };
  const lastSync = syncLog ? (syncLog as SyncLogRow[])[0] : undefined;

  return (
    <div style={{ minHeight: "100vh", background: "var(--gray-50, #FAFAFA)" }}>
      {/* Header */}
      <header style={{
        background: "#fff",
        borderBottom: "1px solid #E5E5EA",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        height: 56,
        gap: 16,
      }}>
        <Link href="/" style={{ textDecoration: "none", color: "#BB2649", fontWeight: 700, fontSize: 15 }}>
          ← Magenta ERP
        </Link>
        <span style={{ color: "#E5E5EA" }}>|</span>

        {/* Portfolio switcher */}
        <div style={{ display: "flex", gap: 4 }}>
          {CLIENTS.map((c) => (
            <Link
              key={c.slug}
              href={`/clients/${c.slug}`}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: c.slug === slug ? 600 : 400,
                background: c.slug === slug ? "#BB2649" : "transparent",
                color: c.slug === slug ? "#fff" : "#666",
                textDecoration: "none",
                border: c.slug === slug ? "none" : "1px solid #E5E5EA",
              }}
            >
              {c.shortName}
            </Link>
          ))}
        </div>

        <div style={{ marginLeft: "auto", fontSize: 12, color: "#999" }}>
          {lastSync
            ? `Sync: ${new Date(lastSync.started_at).toLocaleString("id-ID")} · ${lastSync.status}`
            : "Belum ada sync"}
        </div>
      </header>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px" }}>

        {/* Page title */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A1A2E", margin: 0 }}>
            {client.name}
          </h1>
          <p style={{ color: "#666", fontSize: 13, margin: "4px 0 0" }}>
            Data Meta Ads · Business ID: {client.business_id.startsWith("TODO") ? "Belum dikonfigurasi" : client.business_id}
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <DateRangePicker
            dateStart={dateStart}
            dateStop={dateStop}
            onChange={(s, e) => { setDateStart(s); setDateStop(e); }}
          />

          {/* Campaign filter */}
          {(campaigns ?? []).length > 0 && (
            <CampaignFilter
              campaigns={campaigns ?? []}
              selected={selectedCampaigns}
              onChange={setSelectedCampaigns}
            />
          )}

          {selectedCampaigns.length > 0 && (
            <button
              onClick={() => setSelectedCampaigns([])}
              style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E5EA", background: "#fff", cursor: "pointer", color: "#666" }}
            >
              Reset filter
            </button>
          )}
        </div>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
          <KpiCard label="Total Biaya"  value={totals ? idr(totals.spend)                    : "-"} accent="magenta" loading={kpiLoading} />
          <KpiCard label="Impresi"      value={totals ? num(totals.impressions ?? 0)           : "-"} accent="info"    loading={kpiLoading} />
          <KpiCard label="Jangkauan"    value={totals ? num(totals.reach ?? 0)                 : "-"} accent="info"    loading={kpiLoading} />
          <KpiCard label="Klik"         value={totals ? num(totals.clicks ?? 0)                : "-"} accent="info"    loading={kpiLoading} />
          <KpiCard label="Leads"        value={totals ? num(totals.leads ?? 0)                 : "-"} accent="success" loading={kpiLoading} />
          <KpiCard label="Percakapan"   value={totals ? num(totals.messaging_conversations ?? 0) : "-"} accent="success" loading={kpiLoading} />
          <KpiCard label="CPM"          value={totals ? idr(totals.cpm ?? 0)                   : "-"} loading={kpiLoading} />
          <KpiCard label="CPC"          value={totals ? idr(totals.cpc ?? 0)                   : "-"} loading={kpiLoading} />
        </div>

        {/* Chart + Campaign list 2-kolom */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginBottom: 24 }}>

          {/* Spend chart */}
          <div className="chart-card">
            <div className="chart-header-row">
              <h3 className="chart-title">Spend Harian</h3>
              <span style={{ fontSize: 11, color: "#999" }}>
                Total: {totals ? idr(totals.spend) : "-"}
              </span>
            </div>
            {chartLoading ? (
              <div className="chart-skeleton" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                  <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 11, fill: "#A1A1AA", fontFamily: "DM Sans" }} />
                  <YAxis
                    yAxisId="spend"
                    tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}jt`}
                    tick={{ fontSize: 11, fill: "#A1A1AA", fontFamily: "DM Sans" }}
                  />
                  <YAxis yAxisId="results" orientation="right" tick={{ fontSize: 11, fill: "#A1A1AA", fontFamily: "DM Sans" }} />
                  <Tooltip
                    formatter={(v, name) => name === "Spend" ? [idr(Number(v)), "Spend"] : [num(Number(v)), "Hasil"]}
                    labelFormatter={fmt}
                    contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: "1px solid #E5E5EA", background: "#fff" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, fontFamily: "DM Sans" }} />
                  <Bar  yAxisId="spend"   dataKey="spend"   name="Spend"  fill="#BB2649" radius={[4, 4, 0, 0]} opacity={0.85} />
                  <Line yAxisId="results" dataKey="results" name="Hasil"  stroke="#16A34A" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Campaign list */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E5EA", padding: 16, overflow: "hidden" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 12px", color: "#1A1A2E" }}>
              Campaign ({(campaigns ?? []).length})
            </h3>
            {campaignsLoading ? (
              <div style={{ color: "#999", fontSize: 12 }}>Memuat...</div>
            ) : (campaigns ?? []).length === 0 ? (
              <div style={{ color: "#999", fontSize: 12 }}>Belum ada data campaign</div>
            ) : (
              <div style={{ overflowY: "auto", maxHeight: 220, fontSize: 12 }}>
                {(campaigns ?? []).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCampaigns((prev) =>
                      prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                    )}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: selectedCampaigns.includes(c.id) ? "#FFF0F3" : "transparent",
                      borderLeft: selectedCampaigns.includes(c.id) ? "3px solid #BB2649" : "3px solid transparent",
                      marginBottom: 2,
                    }}
                  >
                    <div style={{ fontWeight: 500, color: "#1A1A2E", marginBottom: 2 }}>{c.name}</div>
                    <div style={{ color: "#999", fontSize: 11 }}>
                      {OBJECTIVE_LABELS[c.objective ?? ""] ?? c.objective ?? "—"} · {c.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Campaign performance table */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E5EA", overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #E5E5EA" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#1A1A2E" }}>
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
                  <tr style={{ background: "#F9FAFB", textTransform: "uppercase", fontSize: 11, color: "#6B7280" }}>
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
                    <tr key={row.campaign_id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 16px", color: "#1A1A2E", fontWeight: 500, maxWidth: 260 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {campaignMap[row.campaign_id] ?? row.campaign_id}
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "#BB2649", fontWeight: 600, fontFamily: "DM Mono, monospace" }}>
                        {idr(row.spend)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "DM Mono, monospace" }}>{num(row.impressions)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "DM Mono, monospace" }}>{num(row.reach)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "DM Mono, monospace" }}>{num(row.clicks)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "DM Mono, monospace", color: "#16A34A" }}>{num(row.leads)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "DM Mono, monospace", color: "#2563EB" }}>{num(row.conversations)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info box untuk portfolio yang belum dikonfigurasi */}
        {client.business_id.startsWith("TODO") && (
          <div style={{
            background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 10,
            padding: "16px 20px", fontSize: 13, color: "#92400E",
          }}>
            <strong>Portfolio belum dikonfigurasi.</strong>{" "}
            Tambahkan ad account IDs untuk <em>{client.name}</em> di{" "}
            <code>supabase/functions/fetch-meta-clients/config.ts</code> dan{" "}
            deploy Edge Function untuk mulai sync data.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Campaign filter component ──────────────────────────────────────────────────

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

  const label = selected.length === 0
    ? "Semua Campaign"
    : selected.length === 1
      ? campaigns.find((c) => c.id === selected[0])?.name ?? "1 campaign"
      : `${selected.length} campaign`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "6px 12px", borderRadius: 8, border: "1px solid #E5E5EA",
          background: "#fff", cursor: "pointer", fontSize: 13, display: "flex",
          alignItems: "center", gap: 6, color: "#1A1A2E",
        }}
      >
        {label} <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
          background: "#fff", border: "1px solid #E5E5EA", borderRadius: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)", minWidth: 280, maxHeight: 280,
          overflowY: "auto", padding: 8,
        }}>
          {campaigns.map((c) => (
            <label
              key={c.id}
              style={{
                display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 8px",
                borderRadius: 6, cursor: "pointer", fontSize: 12,
                background: selected.includes(c.id) ? "#FFF0F3" : "transparent",
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 500, color: "#1A1A2E" }}>{c.name}</div>
                <div style={{ color: "#999", fontSize: 11 }}>
                  {OBJECTIVE_LABELS[c.objective ?? ""] ?? c.objective ?? "—"}
                </div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
