"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAudienceRaw } from "@/hooks/useMetaData";
import { useTheme } from "@/hooks/useTheme";

interface Props { dateStart: string; dateStop: string; campaignIds?: string[]; }

const num = (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}jt` : v >= 1_000 ? `${(v/1_000).toFixed(0)}rb` : String(v);

const COLORS = ["#BB2649","#C94063","#D75A7D","#2563EB","#3B82F6","#60A5FA","#16A34A","#22C55E","#D97706","#F59E0B"];

export function RegionChart({ dateStart, dateStop, campaignIds = [] }: Props) {
  const { data, isLoading } = useAudienceRaw("region", dateStart, dateStop, campaignIds);
  const { theme } = useTheme();
  const gridColor = theme === "dark" ? "#34343A" : "#E5E5EA";
  const tickColor = theme === "dark" ? "#9B9BA3" : "#A1A1AA";
  const tooltipBg = theme === "dark" ? "#1F1F22" : "#FFFFFF";

  if (isLoading) return <div className="chart-card"><div className="chart-skeleton" style={{ height: 220 }} /></div>;

  const byRegion = (data ?? []).reduce<Record<string, { region: string; impressions: number }>>((acc, row) => {
    const region = row.region ?? "Unknown";
    if (!acc[region]) acc[region] = { region, impressions: 0 };
    acc[region].impressions += row.impressions ?? 0;
    return acc;
  }, {});

  const chartData = Object.values(byRegion)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  if (chartData.length === 0) return (
    <div className="chart-card">
      <h3 className="chart-title">Top 10 Wilayah</h3>
      <div className="chart-empty">Belum ada data</div>
    </div>
  );

  return (
    <div className="chart-card">
      <h3 className="chart-title">Top 10 Wilayah</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} tickFormatter={num} />
          <YAxis type="category" dataKey="region" tick={{ fontSize: 9, fill: tickColor, fontFamily: "DM Sans" }} width={80} />
          <Tooltip
            formatter={(v: unknown) => [num(Number(v ?? 0)), "Impresi"]}
            contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
          />
          <Bar dataKey="impressions" name="Impresi" radius={[0, 3, 3, 0]}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
