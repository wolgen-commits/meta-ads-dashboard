"use client";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useSpendChart } from "@/hooks/useMetaData";

interface Props { dateStart: string; dateStop: string; campaignIds?: string[]; }

const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const idr = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export function SpendRoasChart({ dateStart, dateStop, campaignIds = [] }: Props) {
  const { chartData, isLoading } = useSpendChart(dateStart, dateStop, campaignIds);
  if (isLoading) return <div className="chart-skeleton" />;
  return (
    <div className="chart-card">
      <h3 className="chart-title">Spend harian &amp; ROAS</h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
          <YAxis yAxisId="spend" tickFormatter={(v) => `${(v/1_000_000).toFixed(1)}jt`} tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
          <YAxis yAxisId="roas" orientation="right" tickFormatter={(v) => `${v.toFixed(1)}x`} tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
          <Tooltip formatter={(value, name) => name === "spend" ? [idr(Number(value)), "Spend"] : [`${Number(value).toFixed(2)}x`, "ROAS"]} labelFormatter={(d) => fmt(String(d))} contentStyle={{ fontSize: 13 }} />
          <Legend />
          <Bar  yAxisId="spend" dataKey="spend" name="spend" fill="var(--blue)"   radius={[4,4,0,0]} opacity={0.85} />
          <Line yAxisId="roas"  dataKey="roas"  name="roas"  stroke="var(--orange)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
