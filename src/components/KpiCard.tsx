import type { ReactNode } from "react";

interface KpiCardProps {
  label: string; value: string; sub?: string;
  trend?: number; loading?: boolean; icon?: ReactNode;
}

export function KpiCard({ label, value, sub, trend, loading, icon }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {icon && <span className="kpi-icon">{icon}</span>}
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
  );
}
