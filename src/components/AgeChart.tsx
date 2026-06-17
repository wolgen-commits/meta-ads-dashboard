"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAudienceRaw } from "@/hooks/useMetaData";
import { useTheme } from "@/hooks/useTheme";

interface Props { dateStart: string; dateStop: string; campaignIds?: string[]; }

const num = (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}jt` : v >= 1_000 ? `${(v/1_000).toFixed(0)}rb` : String(v);

const AGE_ORDER = ["13-17","18-24","25-34","35-44","45-54","55-64","65+"];

export function AgeChart({ dateStart, dateStop, campaignIds = [] }: Props) {
  const { data, isLoading } = useAudienceRaw("age,gender", dateStart, dateStop, campaignIds);
  const { theme } = useTheme();
  const gridColor  = theme === "dark" ? "#34343A" : "#E5E5EA";
  const tickColor  = theme === "dark" ? "#9B9BA3" : "#A1A1AA";
  const tooltipBg  = theme === "dark" ? "#1F1F22" : "#FFFFFF";

  if (isLoading) return <div className="chart-card"><div className="chart-skeleton" style={{ height: 220 }} /></div>;

  const byAge = (data ?? []).reduce<Record<string, { age: string; impressions: number; spend: number }>>((acc, row) => {
    const age = row.age ?? "Unknown";
    if (!acc[age]) acc[age] = { age, impressions: 0, spend: 0 };
    acc[age].impressions += row.impressions ?? 0;
    acc[age].spend       += row.spend       ?? 0;
    return acc;
  }, {});

  const chartData = Object.values(byAge).sort((a, b) => {
    const ai = AGE_ORDER.indexOf(a.age);
    const bi = AGE_ORDER.indexOf(b.age);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  if (chartData.length === 0) return (
    <div className="chart-card">
      <h3 className="chart-title">Distribusi Usia</h3>
      <div className="chart-empty">Belum ada data</div>
    </div>
  );

  return (
    <div className="chart-card">
      <h3 className="chart-title">Distribusi Usia</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="age" tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} />
          <YAxis tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} tickFormatter={num} width={42} />
          <Tooltip
            formatter={(v: unknown) => [num(Number(v ?? 0)), "Impresi"]}
            contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
          />
          <Bar dataKey="impressions" name="Impresi" fill="#BB2649" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
