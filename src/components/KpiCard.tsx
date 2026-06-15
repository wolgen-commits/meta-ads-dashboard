"use client";
import { useState } from "react";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  loading?: boolean;
  description?: string;
}

export function KpiCard({ label, value, sub, trend, loading, description }: KpiCardProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <div className={`kpi-card ${description ? "clickable" : ""}`} onClick={() => description && setShowInfo(true)}>
        <div className="kpi-top">
          <span className="kpi-label">{label}</span>
          {description && <span className="kpi-info-icon">?</span>}
        </div>
        {loading ? <div className="kpi-skeleton" /> : (
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
