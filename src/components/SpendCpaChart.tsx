"use client";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useSpendChart } from "@/hooks/useMetaData";
import { useTheme } from "@/hooks/useTheme";

interface Props { dateStart: string; dateStop: string; campaignIds?: string[]; adsetIds?: string[]; adIds?: string[]; }

const fmt = (d: unknown) => new Date(String(d)).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const idr = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const shortIdr = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}rb` : String(Math.round(v));

export function SpendCpaChart({ dateStart, dateStop, campaignIds = [], adsetIds = [], adIds = [] }: Props) {
  const { chartData, isLoading } = useSpendChart(dateStart, dateStop, campaignIds, adsetIds, adIds);
  const { theme } = useTheme();
  const gridColor = theme === "dark" ? "#34343A" : "#E5E5EA";
  const tickColor = theme === "dark" ? "#9B9BA3" : "#A1A1AA";
  const tooltipBg = theme === "dark" ? "#1F1F22" : "#FFFFFF";

  if (isLoading) return <div className="chart-skeleton" />;

  return (
    <div className="chart-card">
      <div className="chart-header-row">
        <h3 className="chart-title" style={{ marginBottom: 0 }}>Spend Harian & CPA</h3>
        <span style={{ fontSize: 10, color: tickColor, fontFamily: "DM Sans" }}>CPA = Spend ÷ Percakapan</span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 11, fill: tickColor, fontFamily: "DM Sans" }} />
          <YAxis
            yAxisId="spend"
            tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}jt`}
            tick={{ fontSize: 11, fill: tickColor, fontFamily: "DM Sans" }}
          />
          <YAxis
            yAxisId="cpa"
            orientation="right"
            tickFormatter={shortIdr}
            tick={{ fontSize: 11, fill: tickColor, fontFamily: "DM Sans" }}
          />
          <Tooltip
            formatter={(value, name) =>
              name === "Spend"
                ? [idr(Number(value)), "Spend"]
                : [idr(Number(value)), "CPA (Biaya/Percakapan)"]
            }
            labelFormatter={fmt}
            contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
          />
          <Legend wrapperStyle={{ fontSize: 12, fontFamily: "DM Sans" }} />
          <Bar  yAxisId="spend" dataKey="spend" name="Spend"             fill="#BB2649" radius={[4, 4, 0, 0]} opacity={0.85} />
          <Line yAxisId="cpa"   dataKey="cpa"   name="CPA (Rp/Percakapan)" stroke="#2563EB" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
