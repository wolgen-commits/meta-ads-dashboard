"use client";
import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useEngagementSummary } from "@/hooks/useMetaData";
import { useTheme } from "@/hooks/useTheme";

interface Props { dateStart: string; dateStop: string; campaignIds?: string[]; adsetIds?: string[]; adIds?: string[]; }

const fmt = (d: unknown) => new Date(String(d)).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const num  = (v: number) => v >= 1_000 ? `${(v/1_000).toFixed(0)}rb` : String(v);

type Metric = "all" | "reactions" | "comments" | "shares" | "saves";

const METRICS: { key: Metric; label: string; color: string; field?: "post_reactions" | "post_comments" | "post_shares" | "post_saves" }[] = [
  { key: "all",       label: "Semua",    color: "#6366F1" },
  { key: "reactions", label: "Like",     color: "#BB2649", field: "post_reactions" },
  { key: "comments",  label: "Komentar", color: "#2563EB", field: "post_comments"  },
  { key: "shares",    label: "Bagikan",  color: "#16A34A", field: "post_shares"    },
  { key: "saves",     label: "Disimpan", color: "#D97706", field: "post_saves"     },
];

export function EngagementChart({ dateStart, dateStop, campaignIds = [], adsetIds = [], adIds = [] }: Props) {
  const [active, setActive] = useState<Metric>("all");
  const [platform, setPlatform] = useState<string>("all");
  const { data, isLoading } = useEngagementSummary(dateStart, dateStop, campaignIds, adsetIds, adIds, platform);
  const { theme } = useTheme();
  const gridColor = theme === "dark" ? "#34343A" : "#E5E5EA";
  const tickColor = theme === "dark" ? "#9B9BA3" : "#A1A1AA";
  const tooltipBg = theme === "dark" ? "#1F1F22" : "#FFFFFF";

  const selectBg = theme === "dark" ? "#1F1F22" : "#FFFFFF";
  const selectColor = theme === "dark" ? "#E5E5EA" : "#1F1F22";
  const selectBorder = theme === "dark" ? "#34343A" : "#E5E5EA";

  const metric = METRICS.find((m) => m.key === active)!;

  const byDate = Object.values(
    (data ?? []).reduce<Record<string, { date: string; reactions: number; comments: number; shares: number; saves: number }>>(
      (acc, row) => {
        const d = row.date_start;
        if (!acc[d]) acc[d] = { date: d, reactions: 0, comments: 0, shares: 0, saves: 0 };
        acc[d].reactions += row.post_reactions ?? 0;
        acc[d].comments  += row.post_comments  ?? 0;
        acc[d].shares    += row.post_shares    ?? 0;
        acc[d].saves     += row.post_saves     ?? 0;
        return acc;
      }, {},
    ),
  ).sort((a, b) => a.date.localeCompare(b.date));

  const chartData = byDate.map((d) => ({
    ...d,
    all: d.reactions + d.comments + d.shares + d.saves,
  }));

  return (
    <div className="chart-card">
      <div className="chart-header-row">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 className="chart-title" style={{ marginBottom: 0 }}>Engagement</h3>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            style={{
              padding: "2px 8px",
              borderRadius: 6,
              border: `1px solid ${selectBorder}`,
              background: selectBg,
              color: selectColor,
              fontSize: 11,
              fontFamily: "DM Sans",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">Semua Platform</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="messenger">Messenger</option>
            <option value="audience_network">Audience Network</option>
          </select>
        </div>
        <div className="eng-tabs">
          {METRICS.map((m) => (
            <button
              key={m.key}
              className={`eng-tab${active === m.key ? " active" : ""}`}
              style={active === m.key ? { borderColor: m.color, color: m.color } : undefined}
              onClick={() => setActive(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="chart-skeleton" style={{ height: 180, marginTop: 12 }} />
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {active === "all" ? (
                METRICS.filter((m) => m.key !== "all").map((m) => (
                  <linearGradient key={m.key} id={`eng-grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={m.color} stopOpacity={0.05} />
                    <stop offset="95%" stopColor={m.color} stopOpacity={0.01} />
                  </linearGradient>
                ))
              ) : (
                <linearGradient id={`eng-grad-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={metric.color} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={metric.color} stopOpacity={0.01} />
                </linearGradient>
              )}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} />
            <YAxis tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }} tickFormatter={num} width={38} />
            <Tooltip
              labelFormatter={fmt}
              formatter={(v: unknown, name: any) => [Number(v ?? 0).toLocaleString("id-ID"), name]}
              contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
            />
            {active === "all" ? (
              METRICS.filter((m) => m.key !== "all").map((m) => (
                <Area
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  name={m.label}
                  stroke={m.color}
                  fill={`url(#eng-grad-${m.key})`}
                  strokeWidth={2}
                />
              ))
            ) : (
              <Area
                type="monotone"
                dataKey={active}
                name={metric.label}
                stroke={metric.color}
                fill={`url(#eng-grad-${metric.key})`}
                strokeWidth={2}
              />
            )}
            {active === "all" && (
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Sans", marginTop: 4 }} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
