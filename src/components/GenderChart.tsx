"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useAudienceRaw } from "@/hooks/useMetaData";
import { useTheme } from "@/hooks/useTheme";

interface Props { dateStart: string; dateStop: string; campaignIds?: string[]; }

const num = (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}jt` : v >= 1_000 ? `${(v/1_000).toFixed(0)}rb` : String(v);

const GENDER_CONFIG: Record<string, { label: string; color: string }> = {
  female:  { label: "Perempuan", color: "#BB2649" },
  male:    { label: "Laki-laki", color: "#2563EB" },
  unknown: { label: "Lainnya",   color: "#9B9BA3" },
};

export function GenderChart({ dateStart, dateStop, campaignIds = [] }: Props) {
  const { data, isLoading } = useAudienceRaw("age,gender", dateStart, dateStop, campaignIds);
  const { theme } = useTheme();
  const tooltipBg = theme === "dark" ? "#1F1F22" : "#FFFFFF";
  const gridColor  = theme === "dark" ? "#34343A" : "#E5E5EA";
  const labelColor = theme === "dark" ? "#9B9BA3" : "#6B7280";

  if (isLoading) return <div className="chart-card"><div className="chart-skeleton" style={{ height: 220 }} /></div>;

  const byGender = (data ?? []).reduce<Record<string, number>>((acc, row) => {
    const g = row.gender ?? "unknown";
    acc[g] = (acc[g] ?? 0) + (row.impressions ?? 0);
    return acc;
  }, {});

  const chartData = (["female", "male", "unknown"] as const)
    .map((g) => ({ key: g, name: GENDER_CONFIG[g].label, value: byGender[g] ?? 0, color: GENDER_CONFIG[g].color }))
    .filter((d) => d.value > 0);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  if (chartData.length === 0) return (
    <div className="chart-card">
      <h3 className="chart-title">Distribusi Gender</h3>
      <div className="chart-empty">Belum ada data</div>
    </div>
  );

  const renderLabel = (props: { cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; value?: number }) => {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, value = 0 } = props;
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
    const RAD = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontFamily: "DM Sans", fontWeight: 600 }}>
        {pct}%
      </text>
    );
  };

  return (
    <div className="chart-card">
      <h3 className="chart-title">Distribusi Gender</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            labelLine={false}
            label={renderLabel}
          >
            {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip
            formatter={(v: unknown, name: unknown) => [num(Number(v ?? 0)), String(name)]}
            contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ fontSize: 11, fontFamily: "DM Sans", color: labelColor }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
