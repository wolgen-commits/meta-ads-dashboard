"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const TABLES = [
  { key: "meta_ad_accounts",    label: "Ad Accounts" },
  { key: "meta_campaigns",      label: "Campaigns" },
  { key: "meta_adsets",         label: "Adsets" },
  { key: "meta_ads",            label: "Ads" },
  { key: "ad_performance",      label: "Ad Performance" },
  { key: "engagement_metrics",  label: "Engagement" },
  { key: "audience_insights",   label: "Audience Insights" },
  { key: "meta_sync_log",       label: "Sync Log" },
  { key: "ig_accounts",         label: "IG Accounts" },
  { key: "ig_media",            label: "IG Media" },
  { key: "ig_media_insights",   label: "IG Media Insights" },
  { key: "ig_account_insights", label: "IG Account Insights" },
];

const PAGE_SIZE = 20;

function formatCell(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "object") {
    const s = JSON.stringify(val);
    return s.length > 80 ? s.slice(0, 80) + "…" : s;
  }
  const str = String(val);
  return str.length > 80 ? str.slice(0, 80) + "…" : str;
}

export function DatabaseTab() {
  const [activeTable, setActiveTable] = useState(TABLES[0].key);
  const [data,        setData]        = useState<Record<string, unknown>[]>([]);
  const [columns,     setColumns]     = useState<string[]>([]);
  const [totalCount,  setTotalCount]  = useState(0);
  const [page,        setPage]        = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [search,      setSearch]      = useState("");

  useEffect(() => { setPage(0); setSearch(""); }, [activeTable]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const from = page * PAGE_SIZE;
      const to   = from + PAGE_SIZE - 1;
      const { data: rows, error, count } = await supabase
        .from(activeTable)
        .select("*", { count: "exact" })
        .range(from, to)
        .order("id", { ascending: false });
      if (!cancelled) {
        if (error) { console.error(error); setData([]); setColumns([]); }
        else {
          setData(rows ?? []);
          setColumns(rows && rows.length > 0 ? Object.keys(rows[0]) : []);
          setTotalCount(count ?? 0);
        }
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeTable, page]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const filteredData = search
    ? data.filter((row) => Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(search.toLowerCase())))
    : data;

  return (
    <div className="db-tab">
      <div className="db-table-list">
        {TABLES.map((t) => (
          <button key={t.key} className={`db-table-btn ${activeTable === t.key ? "active" : ""}`} onClick={() => setActiveTable(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="db-header">
        <div className="db-title-row">
          <h3 className="db-title">{TABLES.find((t) => t.key === activeTable)?.label}</h3>
          <span className="db-count">{totalCount.toLocaleString("id-ID")} baris</span>
        </div>
        <input className="db-search" placeholder="Cari di halaman ini..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="db-table-wrap">
        {loading ? (
          <div className="chart-skeleton" style={{ height: 300 }} />
        ) : filteredData.length === 0 ? (
          <div className="db-empty">Tidak ada data</div>
        ) : (
          <table className="db-table">
            <thead>
              <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
            </thead>
            <tbody>
              {filteredData.map((row, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col} title={String(row[col] ?? "")}>{formatCell(row[col])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!search && totalPages > 1 && (
        <div className="db-pagination">
          <button className="db-page-btn" onClick={() => setPage(0)} disabled={page === 0}>«</button>
          <button className="db-page-btn" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>‹</button>
          <span className="db-page-info">Halaman {page + 1} dari {totalPages}</span>
          <button className="db-page-btn" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>›</button>
          <button className="db-page-btn" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</button>
        </div>
      )}
    </div>
  );
}
