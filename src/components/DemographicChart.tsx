"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useAudienceWithMessaging } from "@/hooks/useMetaData";
import { useTheme } from "@/hooks/useTheme";

type MetricKey = "impressions" | "reach" | "messaging_conversations";
interface Props { dateStart: string; dateStop: string; campaignIds?: string[]; metricKey?: MetricKey; }

const num = (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}jt` : v >= 1_000 ? `${(v/1_000).toFixed(0)}rb` : String(v);
const AGE_ORDER = ["13-17","18-24","25-34","35-44","45-54","55-64","65+"];
const METRIC_LABEL: Record<MetricKey, string> = { impressions: "Impresi", reach: "Jangkauan", messaging_conversations: "Percakapan" };

export function DemographicChart({ dateStart, dateStop, campaignIds = [], metricKey = "impressions" }: Props) {
  const { data, isLoading } = useAudienceWithMessaging("age,gender", dateStart, dateStop, campaignIds);
  const { theme } = useTheme();
  const gridColor = theme === "dark" ? "#34343A" : "#E5E5EA";
  const tickColor = theme === "dark" ? "#9B9BA3" : "#A1A1AA";
  const tooltipBg = theme === "dark" ? "#1F1F22" : "#FFFFFF";

  const metricLabel = METRIC_LABEL[metricKey];

  if (isLoading) return <div className="chart-card"><div className="chart-skeleton" style={{ height: 260 }} /></div>;

  const getValue = (row: { impressions: number; reach: number; messaging_conversations: number | null }) => {
    if (metricKey === "reach") return row.reach ?? 0;
    if (metricKey === "messaging_conversations") return row.messaging_conversations ?? 0;
    return row.impressions ?? 0;
  };

  const byAge = (data ?? []).reduce<Record<string, { age: string; perempuan: number; laki: number; lainnya: number }>>((acc, row) => {
    const age    = row.age    ?? "Unknown";
    const gender = row.gender ?? "unknown";
    const val    = getValue(row);
    if (!acc[age]) acc[age] = { age, perempuan: 0, laki: 0, lainnya: 0 };
    if (gender === "female")    acc[age].perempuan += val;
    else if (gender === "male") acc[age].laki      += val;
    else                        acc[age].lainnya   += val;
    return acc;
  }, {});

  const chartData = Object.values(byAge).sort((a, b) => {
    const ai = AGE_ORDER.indexOf(a.age);
    const bi = AGE_ORDER.indexOf(b.age);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const totalPerempuan = chartData.reduce((s, d) => s + d.perempuan, 0);
  const totalLaki      = chartData.reduce((s, d) => s + d.laki, 0);
  const totalLainnya   = chartData.reduce((s, d) => s + d.lainnya, 0);
  const totalAll       = totalPerempuan + totalLaki + totalLainnya;

  if (chartData.length === 0) return (
    <div className="chart-card">
      <h3 className="chart-title">Demografis Usia & Gender — {metricLabel}</h3>
      <div className="chart-empty">Belum ada data</div>
    </div>
  );

  return (
    <div className="chart-card">
      <div style={{ marginBottom: 8 }}>
        <h3 className="chart-title" style={{ marginBottom: 2 }}>Demografis Usia & Gender — {metricLabel}</h3>
        <div style={{ display: "flex", gap: 10, fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>
          <span>Est. Total: <strong style={{ color: "#1F1F22" }}>{num(totalAll)}</strong></span>
          <span>·</span>
          <span style={{ color: "#BB2649" }}>P: <strong>{num(totalPerempuan)}</strong></span>
          <span>·</span>
          <span style={{ color: "#2563EB" }}>L: <strong>{num(totalLaki)}</strong></span>
          {totalLainnya > 0 && <><span>·</span><span style={{ color: "#9B9BA3" }}>Lainnya: <strong>{num(totalLainnya)}</strong></span></>}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="age" tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} />
          <YAxis tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} tickFormatter={num} width={42} />
          <Tooltip
            formatter={(v: unknown, name: unknown) => [num(Number(v ?? 0)), String(name)]}
            contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "DM Sans" }} />
          <Bar dataKey="perempuan" name="Perempuan" stackId="a" fill="#BB2649" />
          <Bar dataKey="laki"      name="Laki-laki" stackId="a" fill="#2563EB" />
          <Bar dataKey="lainnya"   name="Lainnya"   stackId="a" fill="#9B9BA3" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
