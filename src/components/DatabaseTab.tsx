"use client";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { useTableData, exportTableData, type TableKey, type TableFilters } from "@/hooks/useTableData";
import { useCampaignList, useObjectiveList } from "@/hooks/useMetaData";

const isoDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};
const idr = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const num = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}jt`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}rb`;
  return n.toFixed(n % 1 !== 0 ? 2 : 0);
};
const pct = (n: number | null | undefined) => n == null ? "—" : `${Number(n).toFixed(2)}%`;
const dur = (ms: number | null | undefined) => {
  if (ms == null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
};
const fmtDate = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtDatetime = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

interface ColDef {
  key: string;
  label: string;
  type: "text" | "number" | "currency" | "date" | "datetime" | "pct" | "status" | "duration";
  truncate?: boolean;
}

const TABLE_COLUMNS: Record<TableKey, ColDef[]> = {
  meta_campaigns: [
    { key: "name",         label: "Nama Campaign",   type: "text",     truncate: true },
    { key: "objective",    label: "Objective",        type: "text"      },
    { key: "status",       label: "Status",           type: "status"    },
    { key: "daily_budget", label: "Budget Harian",    type: "currency"  },
    { key: "created_at",   label: "Dibuat",           type: "datetime"  },
    { key: "synced_at",    label: "Sync Terakhir",    type: "datetime"  },
  ],
  ad_performance: [
    { key: "date_start",       label: "Tanggal",         type: "date"     },
    { key: "campaign_id",      label: "Campaign ID",     type: "text"     },
    { key: "spend",            label: "Spend",           type: "currency" },
    { key: "impressions",      label: "Impresi",         type: "number"   },
    { key: "reach",            label: "Reach",           type: "number"   },
    { key: "clicks",           label: "Klik",            type: "number"   },
    { key: "ctr",              label: "CTR",             type: "pct"      },
    { key: "cpc",              label: "CPC",             type: "currency" },
    { key: "cpm",              label: "CPM",             type: "currency" },
    { key: "leads",            label: "Leads",           type: "number"   },
    { key: "purchases",        label: "Pembelian",       type: "number"   },
    { key: "purchase_value",   label: "Nilai Pembelian", type: "currency" },
    { key: "roas",             label: "ROAS",            type: "number"   },
  ],
  engagement_metrics: [
    { key: "date_start",      label: "Tanggal",     type: "date"   },
    { key: "campaign_id",     label: "Campaign ID", type: "text"   },
    { key: "post_engagement", label: "Engagement",  type: "number" },
    { key: "post_reactions",  label: "Reaksi",      type: "number" },
    { key: "post_comments",   label: "Komentar",    type: "number" },
    { key: "post_shares",     label: "Share",       type: "number" },
    { key: "post_saves",      label: "Saves",       type: "number" },
    { key: "video_views",     label: "Video Views", type: "number" },
  ],
  audience_insights: [
    { key: "date_start",       label: "Tanggal",    type: "date"     },
    { key: "breakdown_type",   label: "Breakdown",  type: "text"     },
    { key: "age",              label: "Usia",       type: "text"     },
    { key: "gender",           label: "Gender",     type: "text"     },
    { key: "region",           label: "Region",     type: "text",    truncate: true },
    { key: "device_platform",  label: "Device",     type: "text"     },
    { key: "placement",        label: "Penempatan", type: "text"     },
    { key: "impressions",      label: "Impresi",    type: "number"   },
    { key: "reach",            label: "Reach",      type: "number"   },
    { key: "clicks",           label: "Klik",       type: "number"   },
    { key: "spend",            label: "Spend",      type: "currency" },
    { key: "ctr",              label: "CTR",        type: "pct"      },
  ],
  meta_sync_log: [
    { key: "started_at",        label: "Waktu",      type: "datetime" },
    { key: "sync_type",         label: "Tipe",       type: "text"     },
    { key: "status",            label: "Status",     type: "status"   },
    { key: "records_upserted",  label: "Records",    type: "number"   },
    { key: "meta_api_calls",    label: "API Calls",  type: "number"   },
    { key: "duration_ms",       label: "Durasi",     type: "duration" },
    { key: "error_message",     label: "Error",      type: "text",    truncate: true },
  ],
  v_campaign_daily_summary: [
    { key: "date_start",         label: "Tanggal",    type: "date"     },
    { key: "campaign_name",      label: "Campaign",   type: "text",    truncate: true },
    { key: "objective",          label: "Objective",  type: "text"     },
    { key: "campaign_status",    label: "Status",     type: "status"   },
    { key: "total_spend",        label: "Spend",      type: "currency" },
    { key: "total_impressions",  label: "Impresi",    type: "number"   },
    { key: "total_reach",        label: "Reach",      type: "number"   },
    { key: "total_clicks",       label: "Klik",       type: "number"   },
    { key: "ctr_pct",            label: "CTR",        type: "pct"      },
    { key: "cpc",                label: "CPC",        type: "currency" },
    { key: "total_leads",        label: "Leads",      type: "number"   },
    { key: "total_purchases",    label: "Pembelian",  type: "number"   },
    { key: "roas",               label: "ROAS",       type: "number"   },
  ],
  v_campaign_engagement_daily: [
    { key: "date_start",          label: "Tanggal",     type: "date"   },
    { key: "campaign_name",       label: "Campaign",    type: "text",  truncate: true },
    { key: "total_engagement",    label: "Engagement",  type: "number" },
    { key: "total_reactions",     label: "Reaksi",      type: "number" },
    { key: "total_comments",      label: "Komentar",    type: "number" },
    { key: "total_shares",        label: "Share",       type: "number" },
    { key: "total_saves",         label: "Saves",       type: "number" },
    { key: "total_video_views",   label: "Video Views", type: "number" },
    { key: "total_reach",         label: "Reach",       type: "number" },
    { key: "engagement_rate_pct", label: "Eng. Rate",   type: "pct"    },
  ],
  v_audience_top_segments: [
    { key: "campaign_name",   label: "Campaign",   type: "text",    truncate: true },
    { key: "breakdown_type",  label: "Breakdown",  type: "text"     },
    { key: "age",             label: "Usia",       type: "text"     },
    { key: "gender",          label: "Gender",     type: "text"     },
    { key: "region",          label: "Region",     type: "text",    truncate: true },
    { key: "device_platform", label: "Device",     type: "text"     },
    { key: "placement",       label: "Penempatan", type: "text"     },
    { key: "impressions",     label: "Impresi",    type: "number"   },
    { key: "clicks",          label: "Klik",       type: "number"   },
    { key: "spend",           label: "Spend",      type: "currency" },
    { key: "avg_ctr",         label: "Avg CTR",    type: "pct"      },
  ],
};

const TABLE_OPTIONS: {
  key: TableKey; label: string; icon: string; defaultSort: string; defaultAsc: boolean;
}[] = [
  { key: "v_campaign_daily_summary",    label: "Campaign Summary",    icon: "📊", defaultSort: "date_start",   defaultAsc: false },
  { key: "v_campaign_engagement_daily", label: "Engagement Daily",    icon: "💬", defaultSort: "date_start",   defaultAsc: false },
  { key: "v_audience_top_segments",     label: "Top Audience",        icon: "👥", defaultSort: "impressions",  defaultAsc: false },
  { key: "meta_campaigns",              label: "Campaigns",           icon: "🎯", defaultSort: "name",         defaultAsc: true  },
  { key: "ad_performance",              label: "Ad Performance",      icon: "📈", defaultSort: "date_start",   defaultAsc: false },
  { key: "engagement_metrics",          label: "Engagement (Raw)",    icon: "❤️", defaultSort: "date_start",   defaultAsc: false },
  { key: "audience_insights",           label: "Audience (Raw)",      icon: "🌍", defaultSort: "date_start",   defaultAsc: false },
  { key: "meta_sync_log",               label: "Sync Log",            icon: "🔄", defaultSort: "started_at",   defaultAsc: false },
];

const HAS_DATE_FILTER     = new Set<TableKey>(["ad_performance", "engagement_metrics", "audience_insights", "v_campaign_daily_summary", "v_campaign_engagement_daily"]);
const HAS_CAMPAIGN_FILTER = new Set<TableKey>(["ad_performance", "engagement_metrics", "audience_insights", "v_campaign_daily_summary", "v_campaign_engagement_daily", "v_audience_top_segments"]);
const HAS_BREAKDOWN_FILTER = new Set<TableKey>(["audience_insights", "v_audience_top_segments"]);

const BREAKDOWN_OPTIONS = ["age_gender", "region", "device_platform", "placement"];
const CAMPAIGN_STATUS_OPTIONS = ["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"];
const SYNC_STATUS_OPTIONS = ["success", "failed", "running"];

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_AWARENESS: "Awareness", OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_ENGAGEMENT: "Engagement", OUTCOME_LEADS: "Leads",
  OUTCOME_SALES: "Sales", OUTCOME_APP_PROMOTION: "App Promotion",
  LINK_CLICKS: "Link Clicks", PAGE_LIKES: "Page Likes",
  POST_ENGAGEMENT: "Post Engagement", REACH: "Reach",
};

function cellValue(col: ColDef, row: Record<string, unknown>): ReactNode {
  const v = row[col.key];
  if (v === null || v === undefined) return "—";
  switch (col.type) {
    case "currency": return idr(v as number);
    case "number":   return num(v as number);
    case "pct":      return pct(v as number);
    case "duration": return dur(v as number);
    case "date":     return fmtDate(v as string);
    case "datetime": return fmtDatetime(v as string);
    case "status":
      return <span className={`db-status db-status-${String(v).toLowerCase()}`}>{String(v)}</span>;
    default: {
      const s = String(v);
      if (col.truncate && s.length > 45) return <span title={s}>{s.slice(0, 45)}…</span>;
      return s || "—";
    }
  }
}

function downloadCsv(rows: Record<string, unknown>[], cols: ColDef[], filename: string) {
  const header = cols.map((c) => `"${c.label}"`).join(",");
  const body = rows.map((row) =>
    cols.map((c) => {
      const v = row[c.key];
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(","),
  );
  const csv = [header, ...body].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CampaignSelect({
  campaigns, selected, onChange,
}: {
  campaigns: { id: string; name: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);
  const label = selected.length === 0 ? "Semua Campaign" : `${selected.length} dipilih`;
  return (
    <div className="cf-wrap" ref={ref}>
      <button className="cf-btn" onClick={() => setOpen(!open)}>
        <span>{label}</span>
        <span className="cf-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="cf-dropdown">
          <div className="cf-search-wrap">
            <button className="cf-all" onClick={() => onChange(selected.length === 0 ? campaigns.map((c) => c.id) : [])}>
              {selected.length === 0 ? "Pilih semua" : "Batalkan semua"}
            </button>
          </div>
          <div className="cf-list">
            {campaigns.map((c) => (
              <label key={c.id} className="cf-item">
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() =>
                    onChange(selected.includes(c.id) ? selected.filter((x) => x !== c.id) : [...selected, c.id])
                  }
                />
                <span>{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DatabaseTab() {
  const [activeTable, setActiveTable] = useState<TableKey>("v_campaign_daily_summary");
  const tableOpt = TABLE_OPTIONS.find((t) => t.key === activeTable)!;

  // Filters
  const [dateStart,          setDateStart]          = useState(isoDate(-29));
  const [dateStop,           setDateStop]            = useState(isoDate(0));
  const [selectedCampaigns,  setSelectedCampaigns]  = useState<string[]>([]);
  const [selectedStatuses,   setSelectedStatuses]   = useState<string[]>([]);
  const [breakdownType,      setBreakdownType]      = useState("");
  const [searchName,         setSearchName]         = useState("");
  const [objectiveFilter,    setObjectiveFilter]    = useState("");

  // Sort & pagination
  const [sortCol,  setSortCol]  = useState(tableOpt.defaultSort);
  const [sortAsc,  setSortAsc]  = useState(tableOpt.defaultAsc);
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);

  const { data: campaigns } = useCampaignList();
  const { data: objectives } = useObjectiveList();

  const handleTableChange = (key: TableKey) => {
    const opt = TABLE_OPTIONS.find((t) => t.key === key)!;
    setActiveTable(key);
    setSortCol(opt.defaultSort);
    setSortAsc(opt.defaultAsc);
    setPage(1);
    setSelectedCampaigns([]);
    setSelectedStatuses([]);
    setBreakdownType("");
    setSearchName("");
    setObjectiveFilter("");
  };

  const handleSort = (col: string) => {
    if (col === sortCol) setSortAsc((a) => !a);
    else { setSortCol(col); setSortAsc(true); }
    setPage(1);
  };

  const hasDateFilter      = HAS_DATE_FILTER.has(activeTable);
  const hasCampaignFilter  = HAS_CAMPAIGN_FILTER.has(activeTable);
  const hasBreakdown       = HAS_BREAKDOWN_FILTER.has(activeTable);
  const hasCampStatus      = activeTable === "meta_campaigns";
  const hasSyncStatus      = activeTable === "meta_sync_log";
  const hasNameSearch      = activeTable === "meta_campaigns";
  const hasObjective       = activeTable === "meta_campaigns";

  const filters: TableFilters = {
    ...(hasDateFilter                           ? { dateStart, dateStop }      : {}),
    ...(hasCampaignFilter && selectedCampaigns.length ? { campaignIds: selectedCampaigns } : {}),
    ...(hasBreakdown && breakdownType           ? { breakdownType }            : {}),
    ...((hasCampStatus || hasSyncStatus) && selectedStatuses.length ? { statuses: selectedStatuses } : {}),
    ...(hasNameSearch && searchName             ? { searchName }               : {}),
    ...(hasObjective && objectiveFilter         ? { objectiveFilter }          : {}),
  };

  const { data, isLoading, error } = useTableData(activeTable, filters, page, pageSize, sortCol, sortAsc);
  const cols = TABLE_COLUMNS[activeTable];
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await exportTableData(activeTable, filters, sortCol, sortAsc);
      const ts = dateStart ? `${dateStart}_${dateStop}` : new Date().toISOString().split("T")[0];
      downloadCsv(rows, cols, `${activeTable}_${ts}.csv`);
    } finally {
      setExporting(false);
    }
  };

  // Pagination page numbers
  const pageNums: number[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNums.push(i);
  } else {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const end   = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pageNums.push(i);
  }

  return (
    <div className="db-tab">
      {/* Table selector */}
      <div className="db-table-selector">
        {TABLE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            className={`db-table-btn ${activeTable === opt.key ? "active" : ""}`}
            onClick={() => handleTableChange(opt.key)}
          >
            <span>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="db-filter-bar">
        {/* Date range */}
        {hasDateFilter && (
          <>
            <div className="filter-group">
              <label className="filter-label">Dari</label>
              <input type="date" className="date-input" value={dateStart} max={dateStop}
                onChange={(e) => { setDateStart(e.target.value); setPage(1); }} />
            </div>
            <div className="filter-group">
              <label className="filter-label">Sampai</label>
              <input type="date" className="date-input" value={dateStop} min={dateStart} max={isoDate(0)}
                onChange={(e) => { setDateStop(e.target.value); setPage(1); }} />
            </div>
            <div className="preset-group" style={{ alignSelf: "flex-end" }}>
              {[7, 14, 30].map((d) => (
                <button key={d} className="preset-btn"
                  onClick={() => { setDateStart(isoDate(-d + 1)); setDateStop(isoDate(0)); setPage(1); }}>
                  {d}h
                </button>
              ))}
            </div>
          </>
        )}

        {/* Campaign multi-select */}
        {hasCampaignFilter && (
          <div className="filter-group">
            <label className="filter-label">Campaign</label>
            <CampaignSelect
              campaigns={(campaigns ?? []).map((c) => ({ id: c.id, name: c.name }))}
              selected={selectedCampaigns}
              onChange={(v) => { setSelectedCampaigns(v); setPage(1); }}
            />
          </div>
        )}

        {/* Breakdown type */}
        {hasBreakdown && (
          <div className="filter-group">
            <label className="filter-label">Breakdown</label>
            <select className="date-input" value={breakdownType}
              onChange={(e) => { setBreakdownType(e.target.value); setPage(1); }}>
              <option value="">Semua</option>
              {BREAKDOWN_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}

        {/* Campaign status chips */}
        {hasCampStatus && (
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <div className="db-chip-group">
              {CAMPAIGN_STATUS_OPTIONS.map((s) => (
                <button key={s}
                  className={`db-chip ${selectedStatuses.includes(s) ? "active" : ""}`}
                  onClick={() => { setSelectedStatuses((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]); setPage(1); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sync status chips */}
        {hasSyncStatus && (
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <div className="db-chip-group">
              {SYNC_STATUS_OPTIONS.map((s) => (
                <button key={s}
                  className={`db-chip ${selectedStatuses.includes(s) ? "active" : ""}`}
                  onClick={() => { setSelectedStatuses((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]); setPage(1); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Name search */}
        {hasNameSearch && (
          <div className="filter-group">
            <label className="filter-label">Cari Nama</label>
            <input type="text" className="date-input db-search-input"
              placeholder="Ketik nama campaign…"
              value={searchName}
              onChange={(e) => { setSearchName(e.target.value); setPage(1); }} />
          </div>
        )}

        {/* Objective filter */}
        {hasObjective && (
          <div className="filter-group">
            <label className="filter-label">Objective</label>
            <select className="date-input" value={objectiveFilter}
              onChange={(e) => { setObjectiveFilter(e.target.value); setPage(1); }}>
              <option value="">Semua Objective</option>
              {(objectives ?? []).map((o) => (
                <option key={o} value={o}>{OBJECTIVE_LABELS[o] ?? o}</option>
              ))}
            </select>
          </div>
        )}

        {/* Export button — pushed to end */}
        <button className="db-export-btn" onClick={handleExport} disabled={exporting} style={{ marginLeft: "auto" }}>
          {exporting ? "Exporting…" : "⬇ Export CSV"}
        </button>
      </div>

      {/* DataTable card */}
      <div className="chart-card db-card">
        {/* Table info bar */}
        <div className="db-table-info">
          <span className="db-table-name">{tableOpt.icon} {tableOpt.label}</span>
          {data && (
            <span className="db-table-count">
              {data.total.toLocaleString("id-ID")} baris
              {data.total > pageSize && ` · halaman ${page} dari ${totalPages}`}
            </span>
          )}
          <div className="db-pagesize-wrap">
            <label className="filter-label" style={{ marginBottom: 0 }}>Baris/hal:</label>
            <select className="date-input" value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="table-wrap">
          {isLoading ? (
            <div className="db-loading">
              {Array.from({ length: pageSize < 10 ? pageSize : 8 }).map((_, i) => (
                <div key={i} className="db-row-skeleton" />
              ))}
            </div>
          ) : error ? (
            <div className="db-error">Error: {(error as Error).message}</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {cols.map((col) => (
                    <th
                      key={col.key}
                      className={`th-sortable ${col.type !== "text" ? "num" : ""}`}
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      <span className="sort-icon">
                        {sortCol === col.key ? (sortAsc ? " ↑" : " ↓") : " ↕"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((row, i) => (
                  <tr key={i}>
                    {cols.map((col) => (
                      <td key={col.key} className={col.type !== "text" ? "num" : ""}>
                        {cellValue(col, row)}
                      </td>
                    ))}
                  </tr>
                ))}
                {(data?.rows ?? []).length === 0 && (
                  <tr>
                    <td colSpan={cols.length} className="db-empty">
                      Tidak ada data untuk filter yang dipilih.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && data && data.total > pageSize && (
          <div className="db-pagination">
            <button className="db-page-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button className="db-page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            {pageNums[0] > 1 && <span className="db-page-ellipsis">…</span>}
            {pageNums.map((p) => (
              <button key={p} className={`db-page-btn ${page === p ? "active" : ""}`} onClick={() => setPage(p)}>
                {p}
              </button>
            ))}
            {pageNums[pageNums.length - 1] < totalPages && <span className="db-page-ellipsis">…</span>}
            <button className="db-page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
            <button className="db-page-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
          </div>
        )}
      </div>
    </div>
  );
}
