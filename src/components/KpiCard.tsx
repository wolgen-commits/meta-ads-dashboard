"use client";
import { useState } from "react";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  loading?: boolean;
  description?: string;
  accent?: "magenta" | "success" | "warning" | "info";
}

export function KpiCard({ label, value, sub, trend, loading, description, accent }: KpiCardProps) {
  const [showInfo, setShowInfo] = useState(false);

  const accentStyle: Record<string, string> = {
    magenta: "3px solid #BB2649",
    success: "3px solid #16A34A",
    warning: "3px solid #D97706",
    info:    "3px solid #2563EB",
  };

  return (
    <>
      <div
        className={`kpi-card ${description ? "clickable" : ""}`}
        onClick={() => description && setShowInfo(true)}
        style={accent ? { "--kpi-accent": accentStyle[accent] } as React.CSSProperties : undefined}
      >
        {accent && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accentStyle[accent].split(" ")[2] }} />
        )}
        <div className="kpi-top">
          <span className="kpi-label">{label}</span>
          {description && <span className="kpi-info-icon">?</span>}
        </div>
        {loading ? (
          <div className="kpi-skeleton" />
        ) : (
          <>
            <div className="kpi-value">{value}</div>
            <div className="kpi-bottom">
              {sub && <span className="kpi-sub">{sub}</span>}
              {trend !== undefined && (
                <span className={`kpi-trend ${trend >= 0 ? "up" : "down"}`}>
                  {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {showInfo && description && (
        <div className="modal-overlay" onClick={() => setShowInfo(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{label}</span>
              <button className="modal-close" onClick={() => setShowInfo(false)}>✕</button>
            </div>
            <div className="modal-value">{value}</div>
            <p className="modal-desc">{description}</p>
          </div>
        </div>
      )}
    </>
  );
}
