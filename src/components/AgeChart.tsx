"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAudienceWithMessaging } from "@/hooks/useMetaData";
import { useTheme } from "@/hooks/useTheme";

type MetricKey = "impressions" | "reach" | "messaging_conversations";
interface Props { dateStart: string; dateStop: string; campaignIds?: string[]; metricKey?: MetricKey; }

const num = (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}jt` : v >= 1_000 ? `${(v/1_000).toFixed(0)}rb` : String(v);

const AGE_ORDER = ["13-17","18-24","25-34","35-44","45-54","55-64","65+"];
const METRIC_LABEL: Record<MetricKey, string> = { impressions: "Impresi", reach: "Jangkauan", messaging_conversations: "Percakapan" };

export function AgeChart({ dateStart, dateStop, campaignIds = [], metricKey = "impressions" }: Props) {
  const { data, isLoading } = useAudienceWithMessaging("age,gender", dateStart, dateStop, campaignIds);
  const { theme } = useTheme();
  const gridColor  = theme === "dark" ? "#34343A" : "#E5E5EA";
  const tickColor  = theme === "dark" ? "#9B9BA3" : "#A1A1AA";
  const tooltipBg  = theme === "dark" ? "#1F1F22" : "#FFFFFF";

  if (isLoading) return <div className="chart-card"><div className="chart-skeleton" style={{ height: 220 }} /></div>;

  const metricLabel = METRIC_LABEL[metricKey];

  const byAge = (data ?? []).reduce<Record<string, { age: string; value: number }>>((acc, row) => {
    const age = row.age ?? "Unknown";
    if (!acc[age]) acc[age] = { age, value: 0 };
    const v = metricKey === "reach"
      ? (row.reach ?? 0)
      : metricKey === "messaging_conversations"
        ? (row.messaging_conversations ?? 0)
        : (row.impressions ?? 0);
    acc[age].value += v;
    return acc;
  }, {});

  const chartData = Object.values(byAge).sort((a, b) => {
    const ai = AGE_ORDER.indexOf(a.age);
    const bi = AGE_ORDER.indexOf(b.age);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  if (chartData.length === 0) return (
    <div className="chart-card">
      <h3 className="chart-title">Distribusi Usia — {metricLabel}</h3>
      <div className="chart-empty">Belum ada data</div>
    </div>
  );

  return (
    <div className="chart-card">
      <h3 className="chart-title">Distribusi Usia — {metricLabel}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="age" tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} />
          <YAxis tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} tickFormatter={num} width={42} />
          <Tooltip
            formatter={(v: unknown) => [num(Number(v ?? 0)), metricLabel]}
            contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
          />
          <Bar dataKey="value" name={metricLabel} fill="#BB2649" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
