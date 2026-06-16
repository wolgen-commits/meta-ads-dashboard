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
      <h3 className="chart-title">Spend Harian & ROAS</h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
          <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 11, fill: "#A1A1AA", fontFamily: "DM Sans" }} />
          <YAxis yAxisId="spend" tickFormatter={(v) => `${(v/1_000_000).toFixed(1)}jt`} tick={{ fontSize: 11, fill: "#A1A1AA", fontFamily: "DM Sans" }} />
          <YAxis yAxisId="roas" orientation="right" tickFormatter={(v) => `${v.toFixed(1)}x`} tick={{ fontSize: 11, fill: "#A1A1AA", fontFamily: "DM Sans" }} />
          <Tooltip
            formatter={(value, name) => name === "spend" ? [idr(Number(value)), "Spend"] : [`${Number(value).toFixed(2)}x`, "ROAS"]}
            labelFormatter={fmt}
            contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: "1px solid #E5E5EA" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, fontFamily: "DM Sans" }} />
          <Bar  yAxisId="spend" dataKey="spend" name="spend" fill="#BB2649" radius={[4,4,0,0]} opacity={0.85} />
          <Line yAxisId="roas"  dataKey="roas"  name="roas"  stroke="#2563EB" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
