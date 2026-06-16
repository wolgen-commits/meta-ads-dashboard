"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEngagementSummary } from "@/hooks/useMetaData";
import { useTheme } from "@/hooks/useTheme";

interface Props { dateStart: string; dateStop: string; campaignIds?: string[]; }
const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

export function EngagementChart({ dateStart, dateStop, campaignIds = [] }: Props) {
  const { data, isLoading } = useEngagementSummary(dateStart, dateStop, campaignIds);
  const { theme } = useTheme();
  const gridColor = theme === "dark" ? "#34343A" : "#E5E5EA";
  const tickColor = theme === "dark" ? "#9B9BA3" : "#A1A1AA";
  const tooltipBg = theme === "dark" ? "#1F1F22" : "#FFFFFF";
  if (isLoading) return <div className="chart-skeleton" />;

  const byDate = Object.values(
    (data ?? []).reduce<Record<string, { date: string; reactions: number; comments: number; shares: number; saves: number }>>(
      (acc, row) => {
        const d = row.date_start;
        if (!acc[d]) acc[d] = { date: d, reactions: 0, comments: 0, shares: 0, saves: 0 };
        acc[d].reactions += row.total_reactions ?? 0;
        acc[d].comments  += row.total_comments  ?? 0;
        acc[d].shares    += row.total_shares    ?? 0;
        acc[d].saves     += row.total_saves     ?? 0;
        return acc;
      }, {},
    ),
  ).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="chart-card">
      <h3 className="chart-title">Engagement Breakdown</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={byDate} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#BB2649" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#BB2649" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 11, fill: tickColor, fontFamily: "DM Sans" }} />
          <YAxis tick={{ fontSize: 11, fill: tickColor, fontFamily: "DM Sans" }} />
          <Tooltip labelFormatter={fmt} contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }} />
          <Area type="monotone" dataKey="reactions" name="Reactions" stroke="#BB2649" fill="url(#gR)" strokeWidth={2} />
          <Area type="monotone" dataKey="comments"  name="Comments"  stroke="#2563EB"  fill="none"     strokeWidth={1.5} />
          <Area type="monotone" dataKey="shares"    name="Shares"    stroke="#16A34A"  fill="none"     strokeWidth={1.5} strokeDasharray="4 3" />
          <Area type="monotone" dataKey="saves"     name="Saves"     stroke="#D97706"  fill="none"     strokeWidth={1.5} strokeDasharray="4 3" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
