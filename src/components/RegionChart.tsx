"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAudienceWithMessaging } from "@/hooks/useMetaData";
import { useTheme } from "@/hooks/useTheme";

type MetricKey = "impressions" | "reach" | "messaging_conversations";
interface Props { dateStart: string; dateStop: string; campaignIds?: string[]; metricKey?: MetricKey; }

const num = (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}jt` : v >= 1_000 ? `${(v/1_000).toFixed(0)}rb` : String(v);

const COLORS = ["#BB2649","#C94063","#D75A7D","#2563EB","#3B82F6","#60A5FA","#16A34A","#22C55E","#D97706","#F59E0B"];
const METRIC_LABEL: Record<MetricKey, string> = { impressions: "Impresi", reach: "Jangkauan", messaging_conversations: "Percakapan" };

export function RegionChart({ dateStart, dateStop, campaignIds = [], metricKey = "impressions" }: Props) {
  const { data, isLoading } = useAudienceWithMessaging("region", dateStart, dateStop, campaignIds);
  const { theme } = useTheme();
  const gridColor = theme === "dark" ? "#34343A" : "#E5E5EA";
  const tickColor = theme === "dark" ? "#9B9BA3" : "#A1A1AA";
  const tooltipBg = theme === "dark" ? "#1F1F22" : "#FFFFFF";

  const metricLabel = METRIC_LABEL[metricKey];

  if (isLoading) return <div className="chart-card"><div className="chart-skeleton" style={{ height: 260 }} /></div>;

  const byRegion = (data ?? []).reduce<Record<string, { region: string; value: number }>>((acc, row) => {
    const region = row.region ?? "Unknown";
    if (!acc[region]) acc[region] = { region, value: 0 };
    const v = metricKey === "reach"
      ? (row.reach ?? 0)
      : metricKey === "messaging_conversations"
        ? (row.messaging_conversations ?? 0)
        : (row.impressions ?? 0);
    acc[region].value += v;
    return acc;
  }, {});

  const sortedRegionData = Object.values(byRegion)
    .sort((a, b) => b.value - a.value)
    .filter((row) => row.value > 0);

  const chartData   = sortedRegionData.slice(0, 10);
  const totalAll    = sortedRegionData.reduce((s, d) => s + d.value, 0);
  const regionCount = sortedRegionData.length;

  if (chartData.length === 0) return (
    <div className="chart-card">
      <h3 className="chart-title">Top 10 Wilayah — {metricLabel}</h3>
      <div className="chart-empty">Belum ada data</div>
    </div>
  );

  return (
    <div className="chart-card">
      <div style={{ marginBottom: 8 }}>
        <h3 className="chart-title" style={{ marginBottom: 2 }}>Top 10 Wilayah — {metricLabel}</h3>
        <div style={{ display: "flex", gap: 10, fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>
          <span>Est. Total: <strong style={{ color: "#BB2649" }}>{num(totalAll)}</strong></span>
          <span>·</span>
          <span>{regionCount} wilayah</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} tickFormatter={num} />
          <YAxis
            type="category"
            dataKey="region"
            interval={0}
            tick={{ fontSize: 9, fill: tickColor, fontFamily: "DM Sans" }}
            width={80}
          />
          <Tooltip
            formatter={(v: unknown) => [num(Number(v ?? 0)), metricLabel]}
            contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
          />
          <Bar dataKey="value" name={metricLabel} radius={[0, 3, 3, 0]}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
