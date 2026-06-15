"use client";
import { useState } from "react";
import { useAudienceSegments } from "@/hooks/useMetaData";
import type { AudienceTopSegment } from "@/types/database";

const BREAKDOWNS = [
  { key: "age,gender",         label: "Usia & Gender" },
  { key: "region",             label: "Region" },
  { key: "impression_device",  label: "Perangkat" },
  { key: "publisher_platform", label: "Platform" },
];
const idr = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const num = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}jt` : n >= 1_000 ? `${(n/1_000).toFixed(1)}rb` : String(n);

export function AudienceTable({ campaignIds = [] }: { campaignIds?: string[] }) {
  const [breakdown, setBreakdown] = useState("age,gender");
  const { data, isLoading } = useAudienceSegments(breakdown, campaignIds);

  const label = (row: AudienceTopSegment) => {
    if (breakdown === "age,gender")        return `${row.age ?? "-"} · ${row.gender ?? "-"}`;
    if (breakdown === "region")            return row.region ?? "-";
    if (breakdown === "impression_device") return row.device_platform ?? "-";
    return row.placement ?? "-";
  };

  return (
    <div className="chart-card">
      <div className="table-header">
        <h3 className="chart-title">Audience insights</h3>
        <div className="breakdown-tabs">
          {BREAKDOWNS.map((b) => (
            <button key={b.key} className={`breakdown-tab ${breakdown === b.key ? "active" : ""}`} onClick={() => setBreakdown(b.key)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? <div className="chart-skeleton" /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Segmen</th><th className="num">Impresi</th>
                <th className="num">Klik</th><th className="num">Spend</th><th className="num">CTR</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row, i) => (
                <tr key={i}>
                  <td>{label(row)}</td>
                  <td className="num">{num(row.impressions)}</td>
                  <td className="num">{num(row.clicks)}</td>
                  <td className="num">{idr(row.spend)}</td>
                  <td className="num">{((row.avg_ctr ?? 0) * 100).toFixed(2)}%</td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", opacity: 0.5 }}>Belum ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
